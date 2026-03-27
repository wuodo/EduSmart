#!/usr/bin/env node
/**
 * Render start script.
 *
 * Problem: the database was bootstrapped with `prisma db push` which does NOT
 * write to the _prisma_migrations history table. When `prisma migrate deploy`
 * then runs it sees a non-empty schema with no migration history → P3005.
 *
 * Solution: detect that situation, mark every existing migration directory as
 * already applied (baseline), then run `migrate deploy` (which becomes a
 * no-op for those migrations but will apply any future ones correctly).
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: 'inherit', ...opts });
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

console.log('[render-start] Running prisma migrate deploy...');
const migrateResult = run('npx prisma migrate deploy');

if (migrateResult.status === 0) {
  console.log('[render-start] Migrations applied successfully.');
} else {
  // Check if it's P3005 (schema not empty, no migration history)
  const errOutput = runCapture('npx prisma migrate deploy 2>&1');
  if (errOutput.includes('P3005') || errOutput.includes('not empty')) {
    console.warn('[render-start] P3005 detected — database was created with prisma db push.');
    console.warn('[render-start] Baselining: marking all existing migrations as applied...');

    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    let migrationDirs = [];
    try {
      migrationDirs = fs
        .readdirSync(migrationsDir)
        .filter((name) => fs.statSync(path.join(migrationsDir, name)).isDirectory())
        .sort();
    } catch (e) {
      console.error('[render-start] Could not read migrations directory:', e.message);
      process.exit(1);
    }

    console.log(`[render-start] Found ${migrationDirs.length} migration(s) to baseline.`);
    for (const name of migrationDirs) {
      console.log(`[render-start]   Resolving: ${name}`);
      const r = run(`npx prisma migrate resolve --applied "${name}"`);
      if (r.status !== 0) {
        // "Already marked as applied" is not a failure — ignore non-zero exits from resolve
        console.warn(`[render-start]   Warning: resolve returned non-zero for ${name} (may already be applied, continuing)`);
      }
    }

    console.log('[render-start] Baseline complete. Running prisma migrate deploy...');
    const retryResult = run('npx prisma migrate deploy');
    if (retryResult.status !== 0) {
      console.error('[render-start] prisma migrate deploy failed after baseline. Aborting.');
      process.exit(1);
    }
    console.log('[render-start] Migrations applied successfully after baseline.');
  } else {
    console.error('[render-start] prisma migrate deploy failed with unexpected error:');
    console.error(errOutput);
    process.exit(1);
  }
}

console.log('[render-start] Starting server...');
const server = run('node dist/server.js');
process.exit(server.status ?? 0);
