"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function DomainsPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [tenantId, setTenantId] = React.useState('');
  const [domain, setDomain] = React.useState('');

  async function load(){ const d = await fetchJson('/domains'); setItems(d.items||[]); }
  React.useEffect(()=>{ load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await fetchJson('/domains', { method: 'POST', body: JSON.stringify({ tenantId: Number(tenantId), domain }) });
    setTenantId(''); setDomain(''); await load();
  }
  async function verify(d: string, status: string) {
    await fetchJson('/domains/verify', { method: 'PUT', body: JSON.stringify({ domain: d, status }) });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Custom Domains</h1>
      <form onSubmit={add} className="bg-white rounded border border-gray-200 p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-2">
          <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="Tenant ID" className="border border-gray-300 rounded px-3 py-2" />
          <input value={domain} onChange={e=>setDomain(e.target.value)} placeholder="domain.example.com" className="border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4">Add</button>
        </div>
      </form>
      <div className="bg-white rounded border border-gray-200 p-4">
        <div className="font-medium mb-2">Domains</div>
        <div className="space-y-2">
          {items.map((x:any)=> (
            <div key={x.tenantId+':'+x.domain} className="flex items-center justify-between border border-gray-200 rounded px-3 py-2">
              <div className="text-sm">{x.domain} — <span className="text-gray-600">{x.status}</span></div>
              <div className="flex gap-2">
                <button onClick={()=>verify(x.domain,'verified')} className="text-xs bg-btngreen text-white rounded px-2 py-1">Mark verified</button>
                <button onClick={()=>verify(x.domain,'invalid')} className="text-xs bg-gray-800 text-white rounded px-2 py-1">Mark invalid</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



