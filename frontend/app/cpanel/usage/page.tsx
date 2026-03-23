"use client";
import React from 'react';

async function fetchJson(path: string) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include' });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function ApiUsagePage() {
  const [data, setData] = React.useState<any>({ byEndpoint: [], totals: {} });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { (async()=>{ try { setData(await fetchJson('/analytics/api-usage')); } catch(e:any){ setError(e.message); } })(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">API Usage</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="bg-white rounded border border-gray-200 p-4">
        <div className="text-sm text-gray-700">Totals</div>
        <div className="text-sm text-gray-600">Requests: {data.totals?.requests || 0} · Errors: {data.totals?.errors || 0} · p95: {data.totals?.p95 || 0}ms</div>
      </div>
      <div className="bg-white rounded border border-gray-200 p-4">
        <div className="font-medium mb-2">By endpoint</div>
        {(data.byEndpoint||[]).length === 0 && <div className="text-sm text-gray-600">No data</div>}
      </div>
    </div>
  );
}



