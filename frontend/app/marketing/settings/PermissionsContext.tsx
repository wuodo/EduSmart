'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type RolePerm = { name: string; permissions: string[] };

type PermissionsState = {
  roles: RolePerm[];
  modules: { [key: string]: string[] };
};

const PermissionsContext = createContext<any>(null);

function readRoleFromCookie(): string {
  try {
    const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : ''
  } catch { return '' }
}

function normalizeAppRoleToDbRole(role: string): string {
  // Some parts of the UI map backend roles to manager/staff.
  // The permissions/RBAC logic expects DB role names.
  const r = String(role || '').toLowerCase()
  if (r === 'manager') return 'senior_staff'
  if (r === 'staff') return 'admissions_officer'
  return String(role || '')
}

function readRoleFromStorage(): string {
  try {
    // Prefer localStorage keys set by the login flow
    const ls = localStorage.getItem('dbRole') || localStorage.getItem('userRole') || ''
    if (ls) return ls
  } catch { /* SSR or private-browsing */ }
  return readRoleFromCookie()
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionsState>({ roles: [], modules: {} });
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    // Pre-seed role synchronously from storage so canView() is never evaluated
    // with role='' during the async fetch window.
    const stored = readRoleFromStorage();
    if (stored) setRole(normalizeAppRoleToDbRole(stored));

    // Run both fetches in parallel and only clear loading when both are done.
    // Previously permissions resolved first → loading=false with role still ''
    // → canView()=false → "no access" flash for ~1-5 seconds.
    const mePromise = fetch('/api/proxy/users/me', { credentials: 'include', cache: 'no-store' })
      .then(res => res.ok ? res.json().catch(() => ({})) : {})
      .then((me: any) => { if (me?.role) setRole(normalizeAppRoleToDbRole(String(me.role))) })
      .catch(() => {});

    const permsPromise = fetch('/api/marketing/settings/permissions')
      .then(res => res.json())
      .then((data: any) => { if (data) setState({ roles: data.roles || [], modules: data.modules || {} }) })
      .catch(() => {});

    Promise.all([mePromise, permsPromise]).finally(() => setLoading(false));
  }, []);

  const rolePerms = useMemo(() => (state.roles.find(r => r.name === role)?.permissions || []).map((p: string) => p.toLowerCase()), [state.roles, role]);
  const isSuper = rolePerms.includes('all');

  const canView = (module: string) => {
    if (isSuper) return true;
    const mlist = state.modules[module] || [];
    const hasModule = mlist.includes(role) || role.toLowerCase() === 'admin';
    return hasModule && (rolePerms.includes('view') || rolePerms.includes('all'));
  };
  const canEdit = (module: string) => (isSuper ? true : (canView(module) && (rolePerms.includes('edit') || rolePerms.includes('all'))));
  const canDelete = (module: string) => (isSuper ? true : (canView(module) && (rolePerms.includes('delete') || rolePerms.includes('all'))));
  const canExport = (module: string) => (isSuper ? true : (canView(module) && (rolePerms.includes('export') || rolePerms.includes('all'))));

  return (
    <PermissionsContext.Provider value={{ loading, role, canView, canEdit, canDelete, canExport }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function Guard({ module, children }: { module: string; children: React.ReactNode }) {
  const { loading, canView } = usePermissions();
  if (loading) return null;
  if (!canView(module)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">WELCOME TO EDUSMART</h2>
          <p className="text-gray-500">Your current role does not have access to this section.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
} 