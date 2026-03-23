"use client";
import React from 'react';

async function fetchJson(path: string) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function DashboardPage() {
  const [tenants, setTenants] = React.useState<any[]>([]);
  const [usage, setUsage] = React.useState<any>({ tenants: [] });
  const [config, setConfig] = React.useState<any>({ plans: [], apiKeys: [], webhooks: [], announcements: [], flags: { global: {}, perTenant: {} }, support: { tickets: [] }, maintenance: {}, backups: {} });
  const [deleteRequests, setDeleteRequests] = React.useState<any[]>([]);
  const [observability, setObservability] = React.useState<any>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      fetchJson('/tenants').then(r=>r.tenants).catch(()=>[]),
      fetchJson('/usage').catch(()=>({ tenants: [] })),
      fetchJson('/config').catch(()=>({})),
      fetchJson('/delete-requests').then(r=>r.requests).catch(()=>[]),
      fetchJson('/observability').catch(()=>({}))
    ]).then(([tenantsList, usageData, cfg, delReqs, obs]) => {
      setTenants(tenantsList || []);
      setUsage(usageData || { tenants: [] });
      setConfig(cfg || {});
      setDeleteRequests(delReqs || []);
      setObservability(obs || {});
    }).catch(e=>setError(e.message));
  }, []);

  const activeTenants = tenants.filter(t=>t.isActive).length;
  const suspendedTenants = tenants.length - activeTenants;
  const openTickets = (config?.support?.tickets || []).filter((t:any)=>t.status !== 'closed').length;
  const cards = [
    { label: 'Tenants', value: tenants.length },
    { label: 'Active Tenants', value: activeTenants },
    { label: 'Suspended Tenants', value: suspendedTenants },
    { label: 'Plans', value: (config?.plans || []).length },
    { label: 'API Keys', value: (config?.apiKeys || []).length },
    { label: 'Webhooks', value: (config?.webhooks || []).length },
    { label: 'Delete Requests', value: deleteRequests.length },
    { label: 'Open Tickets', value: openTickets },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Overview and quick stats</p>
      </div>
      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}
      <section className="grid md:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-sm text-gray-600 dark:text-gray-300">{c.label}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{c.value ?? '—'}</div>
          </div>
        ))}
      </section>
      <div className="grid md:grid-cols-3 gap-4">
        <section className="md:col-span-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3 overflow-auto">
          <h2 className="font-medium mb-3">Top tenants by activity</h2>
          <table className="w-full text-[13px] min-w-[600px]">
            <thead className="bg-gray-50/80 dark:bg-gray-700/90">
              <tr>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Tenant</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Users</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Inquiries</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Followups</th>
                <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {(usage.tenants||[]).slice(0,8).map((t:any) => (
                <tr key={t.tenantId} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 font-medium">{t.tenant}</td>
                  <td className="px-3 py-2">{t.users}</td>
                  <td className="px-3 py-2">{t.inquiries}</td>
                  <td className="px-3 py-2">{t.followups}</td>
                  <td className="px-3 py-2">{t.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-3">
          <h2 className="font-medium mb-3">System status</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-300">Maintenance</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{config?.maintenance?.readOnly ? 'Read-only' : 'Normal'}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-300">Kill Switch Tenants</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{(config?.maintenance?.killSwitchTenants || []).length}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-300">Backup Schedule</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{config?.backups?.schedule?.enabled ? config.backups.schedule.cron : 'Disabled'}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-300">Errors (24h)</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{observability?.last24hErrors ?? 0}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-300">Slow Queries</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{observability?.slowQueries ?? 0}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-300">Queue Depth</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">{observability?.queueDepth ?? 0}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/cpanel/tenants" className="px-2.5 py-1.5 rounded border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Manage Tenants</a>
            <a href="/cpanel/users" className="px-2.5 py-1.5 rounded border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Invite Admin</a>
            <a href="/cpanel/billing" className="px-2.5 py-1.5 rounded border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Billing & Plans</a>
            <a href="/cpanel/security" className="px-2.5 py-1.5 rounded border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Security</a>
          </div>
        </section>
      </div>
    </div>
  );
}


