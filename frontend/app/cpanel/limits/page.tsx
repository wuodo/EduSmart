"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function LimitsPage() {
  const [globalLimits, setGlobalLimits] = React.useState<any>({});
  const [tenantId, setTenantId] = React.useState('');
  const [tenantLimits, setTenantLimits] = React.useState<any>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const d = await fetchJson('/limits');
        setGlobalLimits(d.global || {});
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  async function saveGlobal(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    await fetchJson('/limits/global', { method: 'PUT', body: JSON.stringify(globalLimits) });
    alert('Saved');
  }

  async function loadTenant() {
    setTenantLimits({}); setError(null);
    const d = await fetchJson('/limits');
    const per = (d.perTenant || {}) as any;
    setTenantLimits(per[String(tenantId)] || {});
  }

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!tenantId) { setError('Enter tenant ID'); return; }
    await fetchJson(`/limits/tenant/${tenantId}`, { method: 'PUT', body: JSON.stringify(tenantLimits) });
    alert('Saved');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Limits & Quotas</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="font-medium mb-3">Global Limits</h2>
          <form className="space-y-3" onSubmit={saveGlobal}>
            <input type="number" value={globalLimits.apiPerDay || ''} onChange={e=>setGlobalLimits({ ...globalLimits, apiPerDay: Number(e.target.value||0) })} placeholder="API per day" className="w-full border border-gray-300 rounded px-3 py-2" />
            <input type="number" value={globalLimits.storageMB || ''} onChange={e=>setGlobalLimits({ ...globalLimits, storageMB: Number(e.target.value||0) })} placeholder="Storage MB" className="w-full border border-gray-300 rounded px-3 py-2" />
            <input type="number" value={globalLimits.users || ''} onChange={e=>setGlobalLimits({ ...globalLimits, users: Number(e.target.value||0) })} placeholder="Users" className="w-full border border-gray-300 rounded px-3 py-2" />
            <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save</button>
          </form>
        </div>
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="font-medium mb-3">Tenant Override</h2>
          <div className="flex gap-2 mb-3">
            <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="Tenant ID" className="border border-gray-300 rounded px-3 py-2" />
            <button className="bg-gray-800 text-white text-sm rounded px-3" onClick={loadTenant} type="button">Load</button>
          </div>
          <form className="space-y-3" onSubmit={saveTenant}>
            <input type="number" value={tenantLimits.apiPerDay || ''} onChange={e=>setTenantLimits({ ...tenantLimits, apiPerDay: Number(e.target.value||0) })} placeholder="API per day" className="w-full border border-gray-300 rounded px-3 py-2" />
            <input type="number" value={tenantLimits.storageMB || ''} onChange={e=>setTenantLimits({ ...tenantLimits, storageMB: Number(e.target.value||0) })} placeholder="Storage MB" className="w-full border border-gray-300 rounded px-3 py-2" />
            <input type="number" value={tenantLimits.users || ''} onChange={e=>setTenantLimits({ ...tenantLimits, users: Number(e.target.value||0) })} placeholder="Users" className="w-full border border-gray-300 rounded px-3 py-2" />
            <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save</button>
          </form>
        </div>
      </div>
    </div>
  );
}



