"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function BackupsPage() {
  const [schedule, setSchedule] = React.useState<any>({});
  const [tenantId, setTenantId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [maintenance, setMaintenance] = React.useState<any>({});
  const [emailTo, setEmailTo] = React.useState('');

  React.useEffect(() => {
    fetchJson('/backups/schedule').then(setSchedule).catch(e=>setError(e.message));
    fetchJson('/config').then(cfg=>setMaintenance(cfg.maintenance||{})).catch(()=>{});
  }, []);

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const enabled = (e.target as any).enabled.checked;
    const cron = (e.target as any).cron.value;
    const emailEnabled = (e.target as any).emailEnabled.checked;
    const emailToVal = (e.target as any).emailTo.value;
    try { const r = await fetchJson('/backups/schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, cron, emailEnabled, emailTo: emailToVal }) }); setSchedule(r.schedule); } catch (e:any) { setError(e.message); }
  }

  async function killSwitch(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const readOnly = (e.target as any).readOnly.checked;
    const list = (e.target as any).kill.value.split(',').map((x:string)=>x.trim()).filter(Boolean).map((x:string)=>Number(x));
    try { const r = await fetchJson('/maintenance', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readOnly, killSwitchTenants: list }) }); setMaintenance(r.maintenance); } catch (e:any) { setError(e.message); }
  }

  async function purgeOld(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const retentionDays = Number((e.target as any).days.value || 30);
    try { await fetchJson(`/tenants/${tenantId}/purge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retentionDays }) }); alert('Purge initiated'); } catch (e:any) { setError(e.message); }
  }

  async function backupNow(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { const r = await fetch(`/api/cpanel/tenants/${tenantId}/backup`, { method: 'POST', credentials: 'include' }); if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `tenant-${tenantId}-backup.json`; a.click(); URL.revokeObjectURL(url); } else { const j = await r.json(); throw new Error(j.error || 'Failed'); } } catch(e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Backups & Maintenance</h1>
        <p className="text-sm text-gray-500">Backup schedule, kill switch, purge</p>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">Backup Schedule <Info text="Configure automatic backups. Set a cron time and optionally email backups to the super admin for offsite storage." /></h2>
        <form onSubmit={saveSchedule} className="grid md:grid-cols-6 gap-3 items-center">
          <label className="inline-flex items-center space-x-2 md:col-span-2"><input name="enabled" type="checkbox" defaultChecked={!!schedule?.enabled} /><span>Enabled</span></label>
          <input name="cron" defaultValue={schedule?.cron || '0 3 * * *'} className="border rounded px-3 py-2 md:col-span-2" />
          <label className="inline-flex items-center space-x-2 md:col-span-2"><input name="emailEnabled" type="checkbox" defaultChecked={!!schedule?.emailEnabled} /><span>Email backup</span></label>
          <input name="emailTo" defaultValue={schedule?.emailTo || ''} placeholder="Email for backups" className="border rounded px-3 py-2 md:col-span-3" />
          <div className="md:col-span-3 text-right"><button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button></div>
        </form>
      </section>

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">Maintenance / Kill Switch <Info text="Put the platform in read-only mode or suspend access for specific tenants. Use kill switch cautiously." /></h2>
        <form onSubmit={killSwitch} className="grid md:grid-cols-3 gap-3 items-center">
          <label className="inline-flex items-center space-x-2"><input name="readOnly" type="checkbox" defaultChecked={!!maintenance?.readOnly} /><span>Read-only mode</span></label>
          <input name="kill" defaultValue={(maintenance?.killSwitchTenants||[]).join(', ')} placeholder="Tenant IDs (comma separated)" className="border rounded px-3 py-2 md:col-span-2" />
          <div className="md:col-span-3"><button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button></div>
        </form>
      </section>

      <section className="bg-white/95 border rounded p-3 space-y-3">
        <h2 className="font-medium flex items-center">On-demand Backup / Purge <Info text="Create a tenant backup for download or purge old data past a retention period. You can also download or email a system-wide configuration backup." /></h2>
        <form onSubmit={backupNow} className="grid md:grid-cols-3 gap-3 items-center">
          <input value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="Tenant ID" className="border rounded px-3 py-2" />
          <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Backup now</button>
        </form>
        <div className="grid md:grid-cols-3 gap-3 items-center">
          <input value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="Send system backup to email" className="border rounded px-3 py-2" />
          <button onClick={async()=>{ try { await fetchJson('/backups/system/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailTo }) } as any); alert('Backup email queued'); } catch(e:any){ setError(e.message); } }} className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Email system backup</button>
          <a href="/api/cpanel/system/backup" className="text-center px-3 py-2 rounded border hover:bg-gray-50">Download system backup</a>
        </div>
        <form onSubmit={purgeOld} className="grid md:grid-cols-3 gap-3 items-center">
          <input placeholder="Retention days" name="days" defaultValue={30} className="border rounded px-3 py-2" />
          <button className="bg-btngreen text-white rounded px-4 py-2 hover:opacity-90">Purge old data</button>
        </form>
      </section>
    </div>
  );
}


