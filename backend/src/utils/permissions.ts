import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

export type RolePerm = { name: string; permissions: string[] };
export type ModulesAccess = { [key: string]: string[] };
export type PermissionsModel = { roles: RolePerm[]; modules: ModulesAccess };

const PERMISSIONS_PATH = path.join(__dirname, '../../data/permissions.json');

let cached: PermissionsModel | null = null;
let mtime = 0;

function normalizePermissions(p: PermissionsModel): PermissionsModel {
	const roles = Array.isArray(p.roles) ? [...p.roles] : [];
	const hasSuperAdmin = roles.some(r => String(r?.name || '').toLowerCase() === 'super_admin');
	if (!hasSuperAdmin) {
		roles.unshift({ name: 'super_admin', permissions: ['all'] });
	}

	return {
		roles,
		modules: (p.modules || {}) as ModulesAccess,
	};
}

function ensureDefaults(): PermissionsModel {
	return {
		roles: [
			{ name: 'super_admin', permissions: ['all'] },
			{ name: 'admin', permissions: ['view','edit','export','delete','all'] },
			{ name: 'senior_staff', permissions: ['view','edit','export','delete','all'] },
			{ name: 'admissions_officer', permissions: ['view', 'edit'] },
			{ name: 'viewer', permissions: ['view'] }
		],
		modules: {
			cpanel: ['super_admin'],
			inquiries: ['admin','senior_staff','admissions_officer','viewer'],
			reports: ['admin','senior_staff'],
			settings: ['admin','senior_staff'],
			students: ['admin','senior_staff','admissions_officer'],
			followups: ['admin','senior_staff','admissions_officer'],
			admission_letters: ['admin','senior_staff','admissions_officer'],
			registrations: ['admin','senior_staff','admissions_officer'],
			campaigns: ['admin','senior_staff']
		}
	};
}

export function loadPermissions(): PermissionsModel {
	try {
		if (fs.existsSync(PERMISSIONS_PATH)) {
			const stat = fs.statSync(PERMISSIONS_PATH);
			if (!cached || stat.mtimeMs !== mtime) {
				const data = JSON.parse(fs.readFileSync(PERMISSIONS_PATH, 'utf8'));
				cached = normalizePermissions(data);
				mtime = stat.mtimeMs;
			}
			return cached!;
		}
	} catch {}
	// fallback to defaults
	cached = ensureDefaults();
	return cached;
}

export function savePermissions(p: PermissionsModel): void {
	try {
		fs.mkdirSync(path.dirname(PERMISSIONS_PATH), { recursive: true });
		fs.writeFileSync(PERMISSIONS_PATH, JSON.stringify(p, null, 2));
		cached = p;
		mtime = Date.now();
	} catch (e) {
		console.error('[permissions] Failed to write permissions file:', e);
		// Still update in-memory cache so current process sees the change
		cached = p;
	}
}

// ---------------------------------------------------------------------------
// DB-backed persistence — stores permissions inside the CpanelConfig row so
// they survive Render container restarts (ephemeral filesystem).
// ---------------------------------------------------------------------------

export async function loadPermissionsFromDb(): Promise<PermissionsModel> {
	try {
		const row = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
		const data = (row?.data as any)?.permissions;
		if (data?.roles) return normalizePermissions(data as PermissionsModel);
	} catch (e) {
		console.error('[permissions] DB load failed, falling back to file:', e);
	}
	return loadPermissions();
}

export async function savePermissionsToDb(p: PermissionsModel): Promise<void> {
	let dbOk = false;
	try {
		const existing = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
		const current: Record<string, unknown> = (existing?.data && typeof existing.data === 'object'
			? existing.data
			: {}) as Record<string, unknown>;
		await (prisma as any).cpanelConfig.upsert({
			where: { id: 1 },
			update: { data: { ...current, permissions: p } },
			create: { id: 1, data: { permissions: p } },
		});
		dbOk = true;
	} catch (e) {
		console.error('[permissions] DB save failed:', e);
	}
	// Always mirror to file as a secondary backup
	savePermissions(p);
	if (!dbOk) {
		throw new Error('Permissions saved to file only — DB write failed. Data may revert on restart.');
	}
}

// Bootstrap: on startup load permissions from DB into the in-memory cache so
// that all synchronous loadPermissions() calls see DB state, not the wiped
// ephemeral file. On Render free-tier the container FS is wiped on every
// restart, so file-based fallback would always return hardcoded defaults.
async function bootstrapPermissionsFromDb(): Promise<void> {
	try {
		const row = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
		const dbPerms = (row?.data as any)?.permissions;
		if (dbPerms?.roles) {
			// DB has saved permissions — load them into in-memory cache NOW so
			// subsequent sync loadPermissions() calls use the real saved state.
			cached = normalizePermissions(dbPerms as PermissionsModel);
			// Ensure admissions_officer has 'edit' permission for followups, etc.
			const ao = cached.roles.find(r => r.name === 'admissions_officer');
			if (ao && !ao.permissions.includes('edit')) {
				ao.permissions.push('edit');
				// Persist the fix back to DB so it survives restarts
				try {
					const row = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
					const current: Record<string, unknown> = (row?.data && typeof row.data === 'object'
						? row.data
						: {}) as Record<string, unknown>;
					await (prisma as any).cpanelConfig.upsert({
						where: { id: 1 },
						update: { data: { ...current, permissions: cached } },
						create: { id: 1, data: { permissions: cached } },
					});
					console.log('[permissions] Added "edit" to admissions_officer in DB.');
				} catch (e) {
					console.warn('[permissions] Failed to persist permissions fix:', e);
				}
			}
			mtime = Date.now(); // prevent stale file from overwriting cached
			console.log('[permissions] Loaded permissions from DB into memory cache.');
		} else {
			// No permissions in DB yet — seed from file (or defaults), then persist.
			const initial = loadPermissions();
			const current: Record<string, unknown> = (row?.data && typeof row.data === 'object'
				? row.data
				: {}) as Record<string, unknown>;
			await (prisma as any).cpanelConfig.upsert({
				where: { id: 1 },
				update: { data: { ...current, permissions: initial } },
				create: { id: 1, data: { permissions: initial } },
			});
			cached = initial;
			mtime = Date.now();
			console.log('[permissions] Seeded permissions into DB from file/defaults.');
		}
	} catch (e) {
		console.error('[permissions] Bootstrap DB load failed, using file/defaults:', e);
	}
}

;(async () => {
	await bootstrapPermissionsFromDb();
	// Refresh in-memory cache from DB every 5 minutes so long-running processes
	// stay in sync if another instance saved changes.
	setInterval(async () => {
		try {
			const row = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
			const dbPerms = (row?.data as any)?.permissions;
			if (dbPerms?.roles) {
				cached = normalizePermissions(dbPerms as PermissionsModel);
				mtime = Date.now();
			}
		} catch { /* silent — do not crash the process on a periodic refresh failure */ }
	}, 5 * 60 * 1000).unref();
})();

export function allowedMethodsFor(role: string): Set<string> {
	const perms = (loadPermissions().roles.find(r => r.name === role)?.permissions || []).map(p => p.toLowerCase());
	const set = new Set<string>();
	if (perms.includes('view')) set.add('GET');
	if (perms.includes('edit') || perms.includes('all')) { ['POST','PUT','PATCH'].forEach(m => set.add(m)); }
	if (perms.includes('delete') || perms.includes('all')) set.add('DELETE');
	if (perms.includes('export') || perms.includes('all')) set.add('GET');
	return set.size ? set : new Set(['GET']);
}

export function roleHasModuleAccess(moduleName: string, role: string): boolean {
	const perms = (loadPermissions().roles.find(r => r.name === role)?.permissions || []).map(p => p.toLowerCase());
	if (perms.includes('all')) return true; // super permission grants access to any module
	const mods = loadPermissions().modules || {};
	const roles = mods[moduleName] || [];
	return roles.map(r => r.toLowerCase()).includes(role.toLowerCase());
}
