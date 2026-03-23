"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function SupportPage() {
  const [tickets, setTickets] = React.useState<any[]>([]);
  const [tenantId, setTenantId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try { const r = await fetchJson('/support/tickets'); setTickets(r.tickets||[]); } catch (e:any) { setError(e.message); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson('/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: tenantId?Number(tenantId):undefined, title, body }) }); setTenantId(''); setTitle(''); setBody(''); await load(); } catch (e:any) { setError(e.message); }
  }

  async function closeTicket(id: string) {
    try { await fetchJson(`/support/tickets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed' }) }); await load(); } catch (e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">Support <Info text="Track and resolve system-wide support issues from tenants or staff." /></h1>
        <p className="text-sm text-gray-500">Manage support tickets</p>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}

      <form onSubmit={createTicket} className="bg-white rounded border border-gray-200 p-3 grid md:grid-cols-4 gap-3">
        <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="Tenant ID (optional)" className="border rounded px-3 py-2" />
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="border rounded px-3 py-2 md:col-span-2" required />
        <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Create</button>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Details" className="border rounded px-3 py-2 md:col-span-4 min-h-[100px]" />
      </form>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">ID</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Tenant</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Title</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Status</th>
              <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No tickets</td></tr>
            ) : tickets.map(t => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
                <td className="px-3 py-2">{t.tenantId || '-'}</td>
                <td className="px-3 py-2">{t.title}</td>
                <td className="px-3 py-2">{t.status}</td>
                <td className="px-3 py-2 text-right">
                  {t.status !== 'closed' && <button onClick={()=>closeTicket(t.id)} className="px-3 py-1 rounded border hover:bg-gray-50">Close</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


