import fs from 'fs';
import path from 'path';

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
			{ name: 'admissions_officer', permissions: ['view'] },
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

export function savePermissions(p: PermissionsModel) {
	try {
		fs.mkdirSync(path.dirname(PERMISSIONS_PATH), { recursive: true });
		fs.writeFileSync(PERMISSIONS_PATH, JSON.stringify(p, null, 2));
		cached = p;
		mtime = Date.now();
	} catch (e) {
		// swallow for now
	}
}

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
