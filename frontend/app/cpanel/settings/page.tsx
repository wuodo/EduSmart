"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function SettingsPage() {
  const [cfg, setCfg] = React.useState<any>({ plans: [], flags: { global: {}, perTenant: {} }, providers: {}, templates: [] });
  const [tenantId, setTenantId] = React.useState('');
  const [flagKey, setFlagKey] = React.useState('');
  const [flagVal, setFlagVal] = React.useState(true);
  const [tmplName, setTmplName] = React.useState('');
  const [tmplType, setTmplType] = React.useState('notification');
  const [tmplContent, setTmplContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try { const c = await fetchJson('/config'); setCfg(c); } catch (e:any) { setError(e.message); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function saveGlobalFlag(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson('/flags/global', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [flagKey]: !!flagVal }) }); await load(); } catch (e:any) { setError(e.message); }
  }

  async function saveTenantFlag(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson(`/flags/tenant/${tenantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [flagKey]: !!flagVal }) }); await load(); } catch (e:any) { setError(e.message); }
  }

  async function saveProviders(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const emailProvider = (e.target as any).emailProvider.value;
    const emailFrom = (e.target as any).emailFrom.value;
    const smsProvider = (e.target as any).smsProvider.value;
    const smsFrom = (e.target as any).smsFrom.value;
    try { await fetchJson('/providers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: { provider: emailProvider, from: emailFrom }, sms: { provider: smsProvider, from: smsFrom } }) }); await load(); } catch (e:any) { setError(e.message); }
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await fetchJson('/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: tmplType, name: tmplName, content: tmplContent }) }); setTmplName(''); setTmplContent(''); await load(); } catch (e:any) { setError(e.message); }
  }

  async function updateTemplate(id: string, name: string, content: string) {
    try { await fetchJson(`/templates/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, content }) }); await load(); } catch (e:any) { setError(e.message); }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete template?')) return;
    try { await fetchJson(`/templates/${id}`, { method: 'DELETE' }); await load(); } catch (e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">Settings & Feature Flags <Info text="Configure providers (email/SMS), turn features on or off, and manage templates used across the app." /></h1>
        <p className="text-sm text-gray-500">Providers, flags, and templates</p>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">Global Feature Flags <Info text="Enable or disable features globally for all tenants." /></h2>
        <form onSubmit={saveGlobalFlag} className="grid md:grid-cols-3 gap-3 items-center">
          <input value={flagKey} onChange={e=>setFlagKey(e.target.value)} placeholder="flag key (e.g. chat_enabled)" className="border rounded px-3 py-2" />
          <select value={String(flagVal)} onChange={e=>setFlagVal(e.target.value === 'true')} className="border rounded px-3 py-2"><option value="true">true</option><option value="false">false</option></select>
          <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button>
        </form>
        <div className="text-sm text-gray-600">Current: {Object.keys(cfg?.flags?.global||{}).length} flags</div>
      </section>

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">Per-tenant Flags <Info text="Override features for a specific tenant (e.g., pilot features)." /></h2>
        <form onSubmit={saveTenantFlag} className="grid md:grid-cols-4 gap-3 items-center">
          <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="Tenant ID" className="border rounded px-3 py-2" />
          <input value={flagKey} onChange={e=>setFlagKey(e.target.value)} placeholder="flag key" className="border rounded px-3 py-2" />
          <select value={String(flagVal)} onChange={e=>setFlagVal(e.target.value === 'true')} className="border rounded px-3 py-2"><option value="true">true</option><option value="false">false</option></select>
          <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button>
        </form>
      </section>

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">Providers <Info text="Configure email and SMS providers and from addresses used by the system." /></h2>
        <form onSubmit={saveProviders} className="grid md:grid-cols-4 gap-3 items-center">
          <select name="emailProvider" defaultValue={cfg?.providers?.email?.provider || 'smtp'} className="border rounded px-3 py-2">
            <option value="smtp">SMTP</option>
            <option value="resend">Resend</option>
            <option value="sendgrid">Sendgrid</option>
          </select>
          <input name="emailFrom" defaultValue={cfg?.providers?.email?.from || ''} placeholder="Email from" className="border rounded px-3 py-2" />
          <select name="smsProvider" defaultValue={cfg?.providers?.sms?.provider || 'mock'} className="border rounded px-3 py-2">
            <option value="mock">Mock</option>
            <option value="twilio">Twilio</option>
            <option value="africas_talking">Africa's Talking</option>
          </select>
          <input name="smsFrom" defaultValue={cfg?.providers?.sms?.from || ''} placeholder="SMS from" className="border rounded px-3 py-2" />
          <div className="md:col-span-4"><button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button></div>
        </form>
      </section>

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">Templates <Info text="Manage content templates for letters, notifications, and follow-up scripts." /></h2>
        <form onSubmit={createTemplate} className="grid md:grid-cols-4 gap-3 items-start">
          <select value={tmplType} onChange={e=>setTmplType(e.target.value)} className="border rounded px-3 py-2">
            <option value="letter">Letter</option>
            <option value="notification">Notification</option>
            <option value="followup_script">Follow-up Script</option>
          </select>
          <input value={tmplName} onChange={e=>setTmplName(e.target.value)} placeholder="Name" className="border rounded px-3 py-2" required />
          <button className="bg-btngreen text-white rounded px-4 py-2 hover:opacity-90">Create</button>
          <textarea value={tmplContent} onChange={e=>setTmplContent(e.target.value)} placeholder="Content" className="border rounded px-3 py-2 md:col-span-4 min-h-[100px]" />
        </form>

        <div className="overflow-auto">
          <table className="w-full text-[13px] min-w-[600px]">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Name</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Type</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Updated</th>
                <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(cfg?.templates||[]).map((t:any) => (
                <tr key={t.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2">{t.type}</td>
                  <td className="px-3 py-2">{new Date(t.updatedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button onClick={()=>updateTemplate(t.id, t.name, t.content)} className="px-3 py-1 rounded border hover:bg-gray-50">Save</button>
                    <button onClick={()=>deleteTemplate(t.id)} className="px-3 py-1 rounded border border-rose-300 text-rose-500 hover:bg-rose-50">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


