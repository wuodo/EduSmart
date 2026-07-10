import prisma from '../lib/prisma';

export async function getNextLetterNumber(userEmail: string): Promise<number> {
  const key = `letter_user_${userEmail.toLowerCase()}`;
  const result = await prisma.$queryRawUnsafe<Array<{ value: number }>>(
    `INSERT INTO "letter_counters" (key, value, year) VALUES ($1, 1, $2)
     ON CONFLICT (key, year) DO UPDATE SET value = "letter_counters".value + 1
     RETURNING value`,
    key, new Date().getFullYear()
  );
  return result[0]?.value ?? 1;
}

export async function getNextIntakeInitialCounter(intakeInitial: string): Promise<number> {
  const key = `intake_${intakeInitial}`;
  const result = await prisma.$queryRawUnsafe<Array<{ value: number }>>(
    `INSERT INTO "letter_counters" (key, value, year) VALUES ($1, 1, $2)
     ON CONFLICT (key, year) DO UPDATE SET value = "letter_counters".value + 1
     RETURNING value`,
    key, new Date().getFullYear()
  );
  return result[0]?.value ?? 1;
}

export async function getNextTenantLetterCounter(tenantId: number): Promise<number> {
  const key = `tenant_${tenantId}_letter`;
  const result = await prisma.$queryRawUnsafe<Array<{ value: number }>>(
    `INSERT INTO "letter_counters" (key, value, year) VALUES ($1, 1, $2)
     ON CONFLICT (key, year) DO UPDATE SET value = "letter_counters".value + 1
     RETURNING value`,
    key, new Date().getFullYear()
  );
  return result[0]?.value ?? 1;
}

export async function ensureLetterCountersTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "letter_counters" (
        key TEXT NOT NULL,
        year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
        value INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (key, year)
      )
    `);
  } catch {}
}
