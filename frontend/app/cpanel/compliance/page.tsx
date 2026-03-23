"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function CompliancePage() {
  const [retentions, setRetentions] = React.useState<any[]>([]);
  const [holds, setHolds] = React.useState<any[]>([]);
  const [entity, setEntity] = React.useState('students');
  const [days, setDays] = React.useState(365);
  const [subject, setSubject] = React.useState('');
  const [reason, setReason] = React.useState('');

  async function load() {
    const d = await fetchJson('/compliance');
    setRetentions(d.retention||[]); setHolds(d.legalHolds||[]);
  }
  React.useEffect(()=>{ load(); }, []);

  async function saveRetention(e: React.FormEvent) {
    e.preventDefault();
    await fetchJson('/compliance/retention', { method: 'POST', body: JSON.stringify({ entity, days: Number(days) }) });
    await load();
  }
  async function createHold(e: React.FormEvent) {
    e.preventDefault();
    await fetchJson('/compliance/legal-holds', { method: 'POST', body: JSON.stringify({ subject, reason }) });
    setSubject(''); setReason(''); await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Compliance</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <form onSubmit={saveRetention} className="bg-white rounded border border-gray-200 p-4 space-y-3">
          <h2 className="font-medium">Retention Policy</h2>
          <input value={entity} onChange={e=>setEntity(e.target.value)} placeholder="Entity" className="w-full border border-gray-300 rounded px-3 py-2" />
          <input type="number" value={days} onChange={e=>setDays(Number(e.target.value||0))} placeholder="Days" className="w-full border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save</button>
        </form>

        <form onSubmit={createHold} className="bg-white rounded border border-gray-200 p-4 space-y-3">
          <h2 className="font-medium">Legal Hold</h2>
          <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" className="w-full border border-gray-300 rounded px-3 py-2" />
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)" className="w-full border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Create</button>
        </form>
      </div>
      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-medium mb-2">Existing Policies</h2>
        <div className="text-sm text-gray-700">{retentions.map((r:any)=> `${r.entity}: ${r.days} days`).join(' · ') || 'None'}</div>
      </div>
      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-medium mb-2">Legal Holds</h2>
        <ul className="text-sm list-disc pl-5">{holds.map((h:any)=> (<li key={h.id}>{h.subject} ({h.active?'active':'inactive'})</li>))}</ul>
      </div>
    </div>
  );
}



