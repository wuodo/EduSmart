import { useEffect, useMemo, useState } from 'react';

const API_URL = '/api/marketing/settings/permissions';

const ALL_PERMISSIONS = ['view', 'edit', 'export', 'delete', 'all'] as const;
const MODULES = ['inquiries', 'followups', 'admission_letters', 'registrations', 'reports', 'campaigns', 'settings', 'students'] as const;
const ROLES = ['admin', 'senior_staff', 'admissions_officer', 'viewer'] as const;

type RolePerm = { name: string; permissions: string[] };

type ModulesAccess = { [key: string]: string[] };

function userHeaders() {
  return {};
}

export default function Permissions() {
  const [roles, setRoles] = useState<RolePerm[]>([]);
  const [modules, setModules] = useState<ModulesAccess>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [currentRole, setCurrentRole] = useState<string>('');

  useEffect(() => {
    // Detect current user role from cookie/localStorage so we can
    // prevent non-super admins from editing super_admin permissions.
    try {
      const m = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|; )role=([^;]+)/)
        : null;
      const r = m ? decodeURIComponent(m[1]) : localStorage.getItem('userRole') || '';
      if (r) setCurrentRole(r.toLowerCase());
    } catch {
      // ignore
    }

    (async () => {
      try {
        const res = await fetch(API_URL, { headers: userHeaders() });
        const data = await res.json();
        setRoles(data.roles);
        setModules(data.modules);
      } catch (e) {
        setError('Failed to load permissions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived helpers
  const roleIndexByName = useMemo(
    () => Object.fromEntries(roles.map((r, i) => [r.name, i])),
    [roles]
  );

  const toggleRolePermission = (roleIdx: number, perm: string) => {
    setRoles(prev => prev.map((role, idx) => {
      if (idx !== roleIdx) return role;
      let next = role.permissions;
      const has = next.includes(perm);
      if (perm === 'all') {
        return { ...role, permissions: has ? next.filter(p => p !== 'all') : Array.from(new Set([...next, 'view','edit','export','delete','all'])) };
      }
      next = has ? next.filter(p => p !== perm) : [...next, perm];
      const basics = ['view','edit','export','delete'];
      const hasAllBasics = basics.every(p => next.includes(p));
      if (hasAllBasics && !next.includes('all')) next = [...next, 'all'];
      if (!hasAllBasics) next = next.filter(p => p !== 'all');
      return { ...role, permissions: next };
    }));
  };

  const selectAllPermsForRole = (roleIdx: number) => {
    setRoles(prev => prev.map((r,i) => i===roleIdx ? { ...r, permissions: ['view','edit','export','delete','all'] } : r));
  };
  const clearPermsForRole = (roleIdx: number) => {
    setRoles(prev => prev.map((r,i) => i===roleIdx ? { ...r, permissions: [] } : r));
  };

  const toggleModuleAccess = (module: string, role: string) => {
    setModules(m => {
      const current = m[module] || [];
      const has = current.includes(role);
      return { ...m, [module]: has ? current.filter(r => r !== role) : [...current, role] };
    });
  };

  const grantAllRolesForModule = (module: string) => {
    setModules(m => ({ ...m, [module]: Array.from(new Set([...(m[module]||[]), ...ROLES])) }));
  };
  const clearRolesForModule = (module: string) => {
    setModules(m => ({ ...m, [module]: [] }));
  };

  const handleSave = async () => {
    // Non-super admins cannot modify super_admin role permissions
    const isSuperAdmin = currentRole === 'super_admin';
    const payloadRoles = isSuperAdmin
      ? roles
      : roles.filter(r => r.name.toLowerCase() !== 'super_admin');

    try {
      setSaving(true);
      setError('');
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({ roles: payloadRoles, modules }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSuccess('Permissions saved!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetLocal = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_URL, { headers: userHeaders(), cache: 'no-store' });
      const data = await res.json();
      setRoles(data.roles);
      setModules(data.modules);
    } catch (e) {
      setError('Failed to reset from server');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-semibold">Permissions & Access Control</h2>
        <div className="flex items-center gap-2">
          <button onClick={resetLocal} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm">Reset</button>
          <button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded text-sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      {success && <div className="mb-2 text-green-700 bg-green-50 border border-green-200 rounded px-4 py-2">{success}</div>}
      {error && <div className="mb-2 text-rose-700 bg-rose-50 border border-rose-200 rounded px-4 py-2">{error}</div>}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Role Permissions</h3>
          <div className="text-xs text-gray-500">Toggle “all” to grant all CRUD permissions</div>
        </div>
        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
          <table className="min-w-full text-[13px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Role</th>
                {ALL_PERMISSIONS.map(perm => (
                  <th key={perm} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left capitalize">{perm}</th>
                ))}
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles
                // Hide super_admin row from non-super admins
                .filter(role => currentRole === 'super_admin' || role.name.toLowerCase() !== 'super_admin')
                .map((role, idx) => {
                  const roleIdx = roleIndexByName[role.name] ?? idx;
                  return (
                    <tr
                      key={role.name}
                      className={
                        idx % 2 === 0
                          ? 'bg-white dark:bg-gray-900'
                          : 'bg-gray-50 dark:bg-gray-800/70'
                      }
                    >
                      <td className="px-3 py-2 text-[13px] font-medium capitalize">
                        {role.name.replace('_', ' ')}
                      </td>
                      {ALL_PERMISSIONS.map(perm => (
                        <td key={perm} className="px-3 py-2 text-[13px]">
                          <input
                            aria-label={`${role.name}-${perm}`}
                            type="checkbox"
                            checked={role.permissions.includes(perm)}
                            onChange={() => toggleRolePermission(roleIdx, perm)}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-[13px]">
                        <div className="flex gap-2">
                          <button
                            onClick={() => selectAllPermsForRole(roleIdx)}
                            className="px-2 py-1 rounded border text-xs"
                          >
                            All
                          </button>
                          <button
                            onClick={() => clearPermsForRole(roleIdx)}
                            className="px-2 py-1 rounded border text-xs"
                          >
                            None
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Module Access</h3>
          <div className="text-xs text-gray-500">Grant which roles can access each module</div>
        </div>
        <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-800">
          <table className="min-w-full text-[13px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Module</th>
                {ROLES.map(role => (
                  <th key={role} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left capitalize">{role.replace('_',' ')}</th>
                ))}
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((module, i) => (
                <tr key={module} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/70'}>
                  <td className="px-3 py-2 text-[13px] font-medium capitalize">{module.replace('_',' ')}</td>
                  {ROLES.map(role => (
                    <td key={role} className="px-3 py-2 text-[13px]">
                      <input aria-label={`${module}-${role}`} type="checkbox" checked={(modules[module] || []).includes(role)} onChange={() => toggleModuleAccess(module, role)} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-[13px]">
                    <div className="flex gap-2">
                      <button onClick={() => grantAllRolesForModule(module)} className="px-2 py-1 rounded border text-xs">All</button>
                      <button onClick={() => clearRolesForModule(module)} className="px-2 py-1 rounded border text-xs">None</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 