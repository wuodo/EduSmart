"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function ReleasePage() {
  const [release, setRelease] = React.useState<any>({ enabled: false, canaryPercent: 0, targetedTenants: [] });
  const [tenantsInput, setTenantsInput] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { (async()=>{
    try { const d = await fetchJson('/release'); setRelease(d || {}); setTenantsInput((d?.targetedTenants||[]).join(',')); } catch (e:any) { setError(e.message); }
  })(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const targeted = tenantsInput.split(',').map(s=>s.trim()).filter(Boolean).map(n=>Number(n));
    const body = { ...release, targetedTenants: targeted };
    await fetchJson('/release', { method: 'PUT', body: JSON.stringify(body) });
    alert('Saved');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Release Control</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <form onSubmit={save} className="bg-white rounded border border-gray-200 p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!release.enabled} onChange={e=>setRelease({ ...release, enabled: e.target.checked })} />
          Enable phased rollout
        </label>
        <input type="number" value={release.canaryPercent || 0} onChange={e=>setRelease({ ...release, canaryPercent: Number(e.target.value||0) })} placeholder="Canary percent" className="w-full border border-gray-300 rounded px-3 py-2" />
        <input value={tenantsInput} onChange={e=>setTenantsInput(e.target.value)} placeholder="Targeted tenant IDs (comma separated)" className="w-full border border-gray-300 rounded px-3 py-2" />
        <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save</button>
      </form>
    </div>
  );
}



