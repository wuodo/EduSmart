"use client";
import React from 'react';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error((data as any)?.error || 'Request failed');
  return data;
}

export default function SsoScimPage() {
  const [sso, setSso] = React.useState<any>({});
  const [scim, setScim] = React.useState<any>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { (async()=>{
    try {
      const sec = await fetchJson('/security');
      setSso(sec.sso || {});
      const sc = await fetchJson('/security/scim');
      setScim(sc || {});
    } catch(e:any){ setError(e.message); }
  })(); }, []);

  async function saveSso(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    await fetchJson('/security/sso', { method: 'PUT', body: JSON.stringify(sso) });
    alert('SSO saved');
  }
  async function saveScim(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    await fetchJson('/security/scim', { method: 'PUT', body: JSON.stringify(scim) });
    alert('SCIM saved');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">SSO & SCIM</h1>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="grid md:grid-cols-2 gap-4">
        <form onSubmit={saveSso} className="bg-white rounded border border-gray-200 p-4 space-y-3">
          <h2 className="font-medium">SSO (SAML)</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!sso.enabled} onChange={e=>setSso({ ...sso, enabled: e.target.checked })}/> Enable SSO</label>
          <input value={sso.saml?.entityId || ''} onChange={e=>setSso({ ...sso, saml: { ...(sso.saml||{}), entityId: e.target.value } })} placeholder="Entity ID" className="w-full border border-gray-300 rounded px-3 py-2" />
          <input value={sso.saml?.ssoUrl || ''} onChange={e=>setSso({ ...sso, saml: { ...(sso.saml||{}), ssoUrl: e.target.value } })} placeholder="SSO URL" className="w-full border border-gray-300 rounded px-3 py-2" />
          <textarea value={sso.saml?.certificate || ''} onChange={e=>setSso({ ...sso, saml: { ...(sso.saml||{}), certificate: e.target.value } })} placeholder="X509 Certificate" className="w-full border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save SSO</button>
        </form>

        <form onSubmit={saveScim} className="bg-white rounded border border-gray-200 p-4 space-y-3">
          <h2 className="font-medium">SCIM Provisioning</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!scim.enabled} onChange={e=>setScim({ ...scim, enabled: e.target.checked })}/> Enable SCIM</label>
          <input value={scim.baseUrl || ''} onChange={e=>setScim({ ...scim, baseUrl: e.target.value })} placeholder="Base URL" className="w-full border border-gray-300 rounded px-3 py-2" />
          <input value={scim.token || ''} onChange={e=>setScim({ ...scim, token: e.target.value })} placeholder="Bearer token" className="w-full border border-gray-300 rounded px-3 py-2" />
          <button className="bg-btnblue text-white text-sm rounded px-4 py-2">Save SCIM</button>
        </form>
      </div>
    </div>
  );
}



