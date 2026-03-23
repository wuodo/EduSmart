"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function SlaPage() {
  const [planId, setPlanId] = React.useState('pro');
  const [responseMins, setResponseMins] = React.useState<number | ''>('' as any);
  const [resolutionMins, setResolutionMins] = React.useState<number | ''>('' as any);
  const [perPlan, setPerPlan] = React.useState<any>({});

  async function load(){ const d = await fetchJson('/sla'); setPerPlan(d.perPlan||{}); }
  React.useEffect(()=>{ load(); }, []);

  async function save(e: React.FormEvent){
    e.preventDefault();
    await fetchJson(`/sla/${planId}`, { method: 'PUT', body: JSON.stringify({ responseMins: responseMins||undefined, resolutionMins: resolutionMins||undefined }) });
    setResponseMins('' as any); setResolutionMins('' as any); await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">SLAs per Plan</h1>
      <form onSubmit={save} className="bg-white rounded border border-gray-200 p-4 grid md:grid-cols-4 gap-2">
        <input value={planId} onChange={e=>setPlanId(e.target.value)} placeholder="Plan ID" className="border border-gray-300 rounded px-3 py-2" />
        <input type="number" value={responseMins as any} onChange={e=>setResponseMins(Number(e.target.value||0) as any)} placeholder="Response (mins)" className="border border-gray-300 rounded px-3 py-2" />
        <input type="number" value={resolutionMins as any} onChange={e=>setResolutionMins(Number(e.target.value||0) as any)} placeholder="Resolution (mins)" className="border border-gray-300 rounded px-3 py-2" />
        <button className="bg-btnblue text-white text-sm rounded px-4">Save</button>
      </form>
      <div className="bg-white rounded border border-gray-200 p-4">
        <div className="font-medium mb-2">Configured</div>
        <ul className="text-sm list-disc pl-5">
          {Object.entries(perPlan).map(([p,val]: any)=> (<li key={p}>{p}: resp {val.responseMins||'-'}m, resolve {val.resolutionMins||'-'}m</li>))}
        </ul>
      </div>
    </div>
  );
}



