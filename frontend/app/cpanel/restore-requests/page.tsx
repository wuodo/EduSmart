"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data;
}

export default function RestoreRequestsPage() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJson('/restore-requests');
      setItems(Array.isArray(data?.requests) ? data.requests : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load restore requests');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: number) => {
    const ok = window.confirm('Approve and restore this deleted record now?');
    if (!ok) return;
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      await fetchJson(`/restore-requests/${id}/approve`, { method: 'POST' });
      setSuccess('Restore completed successfully.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to approve restore request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Restore Requests</h1>
          <p className="text-sm text-gray-600">Approve requests to restore archived deleted records.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded border hover:bg-gray-50 text-sm font-medium"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="px-3 py-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm">{error}</div>
      ) : null}
      {success ? (
        <div className="px-3 py-2 rounded border border-green-200 bg-green-50 text-green-700 text-sm">{success}</div>
      ) : null}

      <div className="border rounded bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left border-b">Request ID</th>
              <th className="px-3 py-2 text-left border-b">Archive ID</th>
              <th className="px-3 py-2 text-left border-b">Requested By</th>
              <th className="px-3 py-2 text-left border-b">Reason</th>
              <th className="px-3 py-2 text-left border-b">Created</th>
              <th className="px-3 py-2 text-left border-b">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={6}>Loading...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={6}>No pending restore requests.</td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(r.itemId || '')}</td>
                  <td className="px-3 py-2">{r.requestedBy || '-'}</td>
                  <td className="px-3 py-2">{r.reason || '-'}</td>
                  <td className="px-3 py-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => approve(Number(r.id))}
                      disabled={busyId === Number(r.id)}
                      className="px-3 py-1.5 rounded bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {busyId === Number(r.id) ? 'Restoring...' : 'Approve & Restore'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
