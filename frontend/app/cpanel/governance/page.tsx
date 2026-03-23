"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function GovernancePage() {
  const [roles, setRoles] = React.useState<any[]>([]);
  const [name, setName] = React.useState('');
  const [perms, setPerms] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    try { const d = await fetchJson('/rbac/roles'); setRoles(d.roles || []); } catch(e:any){ setError(e.message); }
  }
  React.useEffect(()=>{ load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const permissions = perms.split(',').map(s=>s.trim()).filter(Boolean);
    await fetchJson('/rbac/roles', { method: 'POST', body: JSON.stringify({ name, permissions }) });
    setName(''); setPerms(''); await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Governance & Roles</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <form onSubmit={create} className="bg-white rounded border border-gray-200 p-4 space-y-3">
          <h2 className="font-medium">Create Role</h2>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Role name" className="w-full border border-gray-300 rounded px-3 py-2" />
          <input value={perms} onChange={e=>setPerms(e.target.value)} placeholder="Permissions (comma separated)" className="w-full border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Add Role</button>
        </form>
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="font-medium mb-2">Existing Roles</h2>
          <ul className="text-sm list-disc pl-5">
            {roles.map((r:any)=> (<li key={r.name}>{r.name} — {Array.isArray(r.permissions)? r.permissions.join(', '): ''}</li>))}
          </ul>
        </div>
      </div>
    </div>
  );
}



