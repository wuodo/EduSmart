"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function IncidentsPage() {
  const [list, setList] = React.useState<any[]>([]);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function load() {
    try { const d = await fetchJson('/incidents'); setList(d.incidents || []); } catch (e: any) { setError(e.message); }
  }
  React.useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    await fetchJson('/incidents', { method: 'POST', body: JSON.stringify({ title, body }) });
    setTitle(''); setBody('');
    await load();
  }

  async function setStatus(id: string, status: string) {
    await fetchJson(`/incidents/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Incident Center</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}

      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-medium mb-3">Create Incident</h2>
        <form className="space-y-3" onSubmit={create}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="w-full border border-gray-300 rounded px-3 py-2" required />
          <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Details (optional)" className="w-full border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Create</button>
        </form>
      </div>

      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-medium mb-3">Open Incidents</h2>
        <div className="space-y-3">
          {list.length === 0 && <div className="text-sm text-gray-600">No incidents</div>}
          {list.map(i=> (
            <div key={i.id} className="border border-gray-200 rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-gray-600">Status: {i.status}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setStatus(i.id,'monitoring')} className="text-xs bg-gray-800 text-white rounded px-2 py-1">Monitoring</button>
                <button onClick={()=>setStatus(i.id,'closed')} className="text-xs bg-btngreen text-white rounded px-2 py-1">Close</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



