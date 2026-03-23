"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const headers = {
    'Accept': 'application/json',
    ...(init?.headers || {})
  };

  const res = await fetch(`/api/cpanel${path}`, {
    ...init,
    credentials: 'include',
    headers
  });

  if (res.status === 204) return {};

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    try {
      const raw = await res.text();
      data = { raw };
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || data?.raw || 'Request failed';
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }

  return data;
}

export default function TenantsPage() {
  const [loading, setLoading] = React.useState(true);
  const [tenants, setTenants] = React.useState<any[]>([]);
  const [plans, setPlans] = React.useState<any[]>([]);
  const [settingsMap, setSettingsMap] = React.useState<Record<string, any>>({});
  const [usageByTenant, setUsageByTenant] = React.useState<Record<string, any>>({});
  const [search, setSearch] = React.useState('');
  const [selectedTenantIds, setSelectedTenantIds] = React.useState<number[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [name, setName] = React.useState('');
  const [subdomain, setSubdomain] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    try {
      setLoading(true);
      if (!opts?.silent) setError(null);
      const [list, cfg, usage] = await Promise.all([
        fetchJson('/tenants'),
        fetchJson('/config'),
        fetchJson('/usage').catch(() => ({ tenants: [] }))
      ]);
      setTenants(list.tenants || []);
      setPlans(cfg.plans || []);
      const map: Record<string, any> = {};
      (usage.tenants || []).forEach((t: any) => {
        if (!t.tenantId) return;
        map[String(t.tenantId)] = t;
      });
      setUsageByTenant(map);
    } catch (e: any) {
      if (!opts?.silent) setError(e.message || 'Failed to load');
      console.error('Load tenants error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filteredTenants = tenants.filter((t: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(t.name || '').toLowerCase().includes(q) ||
      String(t.subdomain || '').toLowerCase().includes(q) ||
      String(t.domain || '').toLowerCase().includes(q)
    );
  });

  const visibleTenantIds = filteredTenants.map((t: any) => t.id);
  const allVisibleSelected = visibleTenantIds.length > 0 && visibleTenantIds.every((id: number) => selectedTenantIds.includes(id));

  async function createTenant(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const requestedName = name;
    const requestedSubdomain = subdomain;
    const requestedDomain = domain;
    
    try {
      const res = await fetch('/api/cpanel/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: requestedName, subdomain: requestedSubdomain, domain: requestedDomain }),
      });

      // Some backend paths can return an error while the DB write still succeeds.
      // So we verify by re-reading tenants by name before deciding UI success/failure.
      let serverError: string | null = null;
      if (!res.ok) {
        try {
          const data = await res.json();
          serverError = data?.error || data?.message || 'Failed to create tenant';
        } catch {
          // ignore JSON parse errors for non-JSON responses
          serverError = 'Failed to create tenant';
        }
      }

      const check = await fetchJson('/tenants');
      const created = (check.tenants || []).find((t: any) => t?.name === requestedName);
      if (created) {
        setSuccess(`Tenant "${requestedName}" created successfully!`);
        setName(''); setSubdomain(''); setDomain('');
        await load({ silent: true });
        return true;
      }

      setError(serverError || 'Failed to create tenant');
      return false;
    } catch (e: any) {
      // Last resort: re-check by name before showing error.
      try {
        const check = await fetchJson('/tenants');
        const created = (check.tenants || []).find((t: any) => t?.name === requestedName);
        if (created) {
          setSuccess(`Tenant "${requestedName}" created successfully!`);
          setName(''); setSubdomain(''); setDomain('');
          await load({ silent: true });
          return true;
        }
      } catch {}
      setError(e.message || 'Failed to create tenant');
      console.error('Create tenant error:', e);
      return false;
    }
  }

  async function suspend(id: number) {
    if (!confirm('Are you sure you want to suspend this tenant?')) return;
    setError(null);
    setSuccess(null);
    try { 
      await fetchJson(`/tenants/${id}/suspend`, { method: 'POST' }); 
      setSuccess('Tenant suspended successfully!');
      await load({ silent: true });
    } catch (e: any) {
      // If the DB updated but API returned error, treat as success after verifying state.
      try {
        const check = await fetchJson('/tenants');
        const t = (check.tenants || []).find((x: any) => x?.id === id);
        if (t && t.isActive === false) {
          setSuccess('Tenant suspended successfully!');
          await load({ silent: true });
          return;
        }
      } catch {}
      setError(e.message);
    }
  }

  async function unsuspend(id: number) {
    if (!confirm('Unsuspend this tenant? The institution will regain access.')) return;
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true })
      });
      setSuccess('Tenant unsuspended successfully!');
      await load({ silent: true });
    } catch (e: any) {
      try {
        const check = await fetchJson('/tenants');
        const t = (check.tenants || []).find((x: any) => x?.id === id);
        if (t && t.isActive === true) {
          setSuccess('Tenant unsuspended successfully!');
          await load({ silent: true });
          return;
        }
      } catch {}
      setError(e.message);
    }
  }

  async function hardDelete(id: number) {
    if (!confirm('PERMANENTLY DELETE this tenant and ALL associated data? This cannot be undone!')) return;
    setError(null);
    setSuccess(null);
    try { 
      await fetchJson(`/tenants/${id}?hard=true`, { method: 'DELETE' }); 
      setSuccess('Tenant deleted successfully!');
      await load({ silent: true });
    } catch (e: any) {
      // If DB updated but API returned error, treat as success if tenant is gone.
      try {
        const check = await fetchJson('/tenants');
        const t = (check.tenants || []).find((x: any) => x?.id === id);
        if (!t) {
          setSuccess('Tenant deleted successfully!');
          await load({ silent: true });
          return;
        }
      } catch {}
      setError(e.message);
    }
  }

  async function bulkHardDeleteSelected() {
    if (selectedTenantIds.length === 0) return;
    const ids = [...selectedTenantIds];
    if (!confirm(`PERMANENTLY DELETE ${ids.length} tenant(s) and ALL associated data? This cannot be undone!`)) return;
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`/tenants/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, hard: true })
      });
      setSelectedTenantIds([]);
      setSuccess(`Deleted ${ids.length} tenant(s) successfully!`);
      await load({ silent: true });
    } catch (e: any) {
      setError(e.message || 'Failed to bulk delete tenants');
    }
  }

  async function uploadLogo(id: number, file: File | null) {
    if (!file) return;
    setError(null);
    setSuccess(null);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      await fetchJson(`/tenants/${id}/logo`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ imageBase64: b64 }) 
      });
      setSuccess('Logo uploaded successfully!');
      await load({ silent: true });
    } catch (e:any) { setError(e.message || 'Failed to upload logo'); }
  }

  async function loadSettings(id: number) {
    try {
      const r = await fetchJson(`/tenants/${id}/settings`);
      setSettingsMap(prev => ({ ...prev, [String(id)]: r.settings || {} }));
    } catch {}
  }

  async function assignPlan(id: number, planId: string) {
    setError(null);
    setSuccess(null);
    try {
      await fetchJson(`/tenants/${id}/plan`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ planId }) 
      });
      setSuccess('Plan assigned successfully!');
      await loadSettings(id);
    } catch (e:any) { setError(e.message || 'Failed to assign plan'); }
  }

  return (
    <div className="space-y-8">
      {/* Header + quick stats */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold flex items-center">
              Tenants <Info text="Create and manage institutions (tenants), control branding and plans, and suspend or delete when needed." />
            </h1>
            <p className="text-sm text-gray-500">Institution directory and platform-wide tenant controls.</p>
          </div>
          {/* create action is in the search bar */}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <div className="px-3 py-2 bg-sky-600 text-white rounded-none">
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Total tenants</div>
            <div className="mt-1 text-2xl font-bold">{tenants.length}</div>
          </div>
          <div className="px-3 py-2 bg-emerald-600 text-white rounded-none">
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Active</div>
            <div className="mt-1 text-2xl font-bold">{tenants.filter(t => t.isActive).length}</div>
          </div>
          <div className="px-3 py-2 bg-amber-500 text-gray-900 rounded-none">
            <div className="text-[11px] font-semibold uppercase tracking-wide">Suspended</div>
            <div className="mt-1 text-2xl font-bold">{tenants.filter(t => !t.isActive).length}</div>
          </div>
          <div className="px-3 py-2 bg-slate-700 text-white rounded-none hidden md:block">
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Plans</div>
            <div className="mt1 text-2xl font-bold">{plans.length}</div>
          </div>
        </div>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError(null)} className="text-rose-900 hover:text-rose-700">✕</button>
      </div>}
      
      {success && <div className="bg-green-50 text-green-700 border border-green-200 rounded p-3 text-sm flex items-center justify-between">
        <span>{success}</span>
        <button onClick={() => setSuccess(null)} className="text-green-900 hover:text-green-700">✕</button>
      </div>}

      {/* Search + tenant table */}
      <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">Tenants</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, subdomain, or domain"
            className="border border-gray-300 px-2 py-1.5 text-xs md:text-sm w-[240px] md:w-[320px] min-w-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={bulkHardDeleteSelected}
            disabled={selectedTenantIds.length === 0}
            className="bg-red-600 text-white px-3 py-1.5 text-xs md:text-sm rounded-none hover:opacity-90 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete selected{selectedTenantIds.length > 0 ? ` (${selectedTenantIds.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="bg-btnblue text-white px-3 py-1.5 text-xs md:text-sm rounded-none hover:opacity-90 whitespace-nowrap"
          >
            + Create tenant
          </button>
        </div>
      </div>

      <div className="bg-white rounded-none border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 text-sm text-gray-600 border-b flex items-center">Tenant list <Info text="All tenants in the system. Use actions to suspend, delete, upload logo, or assign a plan." /></div>
        <table className="w-full text-[11px] md:text-[12px]">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800 w-[34px]">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedTenantIds(visibleTenantIds);
                    else setSelectedTenantIds([]);
                  }}
                />
              </th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800 w-[70px]">ID</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Name</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Subdomain</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Domain</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Active</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Users</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Inquiries</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Followups</th>
              <th className="text-left px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Plan</th>
              <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider text-teal-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-gray-500">No tenants</td></tr>
            ) : (
              filteredTenants.map((t: any) => {
                  const usage = usageByTenant[String(t.id)] || {};
                  return (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedTenantIds.includes(t.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedTenantIds(prev => {
                          if (checked) return Array.from(new Set([...prev, t.id]));
                          return prev.filter((id: number) => id !== t.id);
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-1.5 w-[70px] text-xs text-gray-700">{t.id}</td>
                  <td className="px-3 py-1.5 font-medium">{t.name}</td>
                  <td className="px-3 py-1.5">{t.subdomain || '-'}</td>
                  <td className="px-3 py-1.5">{t.domain || '-'}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-1 rounded text-xs ${t.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{t.isActive ? 'Active' : 'Suspended'}</span>
                  </td>
                  <td className="px-3 py-1.5">{usage.users ?? '—'}</td>
                  <td className="px-3 py-1.5">{usage.inquiries ?? '—'}</td>
                  <td className="px-3 py-1.5">{usage.followups ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <select
                        className="border px-2 py-1 text-[11px]"
                        onFocus={()=>loadSettings(t.id)}
                        value={String(settingsMap[String(t.id)]?.planId || '')}
                        onChange={e=>assignPlan(t.id, e.target.value)}
                      >
                        <option value="">Select plan</option>
                        {plans.map((p:any)=> (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right space-x-1 md:space-x-2 whitespace-nowrap">
                    {t.isActive ? (
                      <button
                        onClick={()=>suspend(t.id)}
                        className="inline-flex items-center px-2.5 py-1 text-[11px] border border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={()=>unsuspend(t.id)}
                        className="inline-flex items-center px-2.5 py-1 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Unsuspend
                      </button>
                    )}
                    <button
                      onClick={()=>hardDelete(t.id)}
                      className="inline-flex items-center px-2.5 py-1 text-[11px] bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <label className="inline-flex items-center px-2.5 py-1 text-[11px] border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer">
                      Upload Logo
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={e=>uploadLogo(t.id, e.target.files?.[0] || null)} />
                    </label>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      {/* Create tenant modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-none border border-gray-300 w-full max-w-xl">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <div className="text-sm font-semibold text-gray-800">Create tenant</div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-gray-500 hover:text-gray-800 text-lg"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                const ok = await createTenant(e);
                if (ok) setShowCreate(false);
              }}
              className="p-4 grid md:grid-cols-2 gap-3"
            >
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Institution name</label>
                <input
                  value={name}
                  onChange={e=>setName(e.target.value)}
                  placeholder="e.g. Green Valley Institute"
                  className="border px-3 py-2 w-full text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Subdomain</label>
                <input
                  value={subdomain}
                  onChange={e=>setSubdomain(e.target.value)}
                  placeholder="e.g. green-valley"
                  className="border px-3 py-2 w-full text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">Optional; used for routing and branding.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Custom domain</label>
                <input
                  value={domain}
                  onChange={e=>setDomain(e.target.value)}
                  placeholder="e.g. portal.school.ac.ke"
                  className="border px-3 py-2 w-full text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">Map when DNS is ready.</p>
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 text-xs border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-btnblue text-white hover:opacity-90"
                >
                  Create tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


