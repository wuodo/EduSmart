"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = React.useState<any>({});
  const [usage, setUsage] = React.useState<any>({ tenants: [] });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchJson('/analytics/summary').then(setSummary).catch(e=>setError(e.message));
    fetchJson('/usage').then(setUsage).catch(()=>{});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center">Analytics <Info text="Cross-tenant KPIs to understand adoption and activity. Filter via API if needed." /></h1>
        <p className="text-sm text-gray-500">Cross-tenant KPIs</p>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}

      <section className="grid md:grid-cols-4 gap-4">
        {[
          { label: 'Tenants', value: summary.tenants },
          { label: 'Users', value: summary.users },
          { label: 'Inquiries', value: summary.inquiries },
          { label: 'Followups', value: summary.followups },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded border border-gray-200 p-4">
            <div className="text-sm text-gray-600">{m.label}</div>
            <div className="text-2xl font-semibold text-gray-900">{m.value ?? '—'}</div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded border border-gray-200 p-4 overflow-auto">
        <h2 className="font-medium mb-3">Per-tenant Usage</h2>
        <table className="w-full text-[13px] min-w-[600px]">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Tenant</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Users</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Inquiries</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Followups</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {(usage.tenants||[]).map((t:any) => (
              <tr key={t.tenantId} className="border-t border-gray-100">
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
    </div>
  );
}


