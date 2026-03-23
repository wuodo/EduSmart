"use client";
import React from 'react';
import Info from '../_components/Info';

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`/api/cpanel${path}`, { credentials: 'include', ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function SecurityPage() {
  const [cfg, setCfg] = React.useState<any>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { fetchJson('/security').then(setCfg).catch(e=>setError(e.message)); }, []);

  async function saveIp(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const allow = (e.target as any).allow.value.split(',').map((x:string)=>x.trim()).filter(Boolean);
    const deny = (e.target as any).deny.value.split(',').map((x:string)=>x.trim()).filter(Boolean);
    try { await fetchJson('/security/ip', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allow, deny }) }); const s = await fetchJson('/security'); setCfg(s); } catch (e:any) { setError(e.message); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const minLength = Number((e.target as any).minLength.value || 8);
    const requireUpper = (e.target as any).requireUpper.checked;
    const requireNumber = (e.target as any).requireNumber.checked;
    const requireSymbol = (e.target as any).requireSymbol.checked;
    try { await fetchJson('/security/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minLength, requireUpper, requireNumber, requireSymbol }) }); const s = await fetchJson('/security'); setCfg(s); } catch (e:any) { setError(e.message); }
  }

  async function saveTwoFA(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const enforced = (e.target as any).enforced.checked;
    try { await fetchJson('/security/twofa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enforced, methods: ['totp'] }) }); const s = await fetchJson('/security'); setCfg(s); } catch (e:any) { setError(e.message); }
  }

  async function saveSSO(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const enabled = (e.target as any).enabled.checked;
    const entityId = (e.target as any).entityId.value;
    const ssoUrl = (e.target as any).ssoUrl.value;
    try { await fetchJson('/security/sso', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, saml: { entityId, ssoUrl } }) }); const s = await fetchJson('/security'); setCfg(s); } catch (e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Security</h1>
        <p className="text-sm text-gray-600">IP policy, Passwords, 2FA, SSO</p>
      </div>
      {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-3 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded border border-gray-300 shadow-sm p-3 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center">IP Allow/Deny <Info text="Restrict access to trusted IPs or block known malicious addresses. Use CIDR or exact IPs." /></h2>
          <form onSubmit={saveIp} className="space-y-3">
            <input name="allow" defaultValue={(cfg?.ip?.allow||[]).join(', ')} placeholder="Allow (comma separated)" className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 placeholder-gray-500" />
            <input name="deny" defaultValue={(cfg?.ip?.deny||[]).join(', ')} placeholder="Deny (comma separated)" className="border border-gray-300 rounded px-3 py-2 w-full text-gray-900 placeholder-gray-500" />
            <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button>
          </form>
        </section>

        <section className="bg-white rounded border border-gray-300 shadow-sm p-3 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center">Password Policy <Info text="Set minimum complexity to protect accounts. Changes apply to new passwords and resets." /></h2>
          <form onSubmit={savePassword} className="space-y-3 text-gray-700">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm text-gray-700">Min length</label>
              <input name="minLength" type="number" min={6} max={128} defaultValue={cfg?.password?.minLength || 8} className="w-24 border border-gray-300 rounded px-3 py-2 text-gray-900" />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input name="requireUpper" type="checkbox" defaultChecked={!!cfg?.password?.requireUpper} />Uppercase</label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input name="requireNumber" type="checkbox" defaultChecked={!!cfg?.password?.requireNumber} />Number</label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700"><input name="requireSymbol" type="checkbox" defaultChecked={!!cfg?.password?.requireSymbol} />Symbol</label>
            </div>
            <div>
              <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button>
            </div>
          </form>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded border border-gray-300 shadow-sm p-3 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center">Two-Factor Authentication <Info text="Enforce TOTP-based 2FA for stronger authentication. Users will be prompted to enroll." /></h2>
          <form onSubmit={saveTwoFA} className="space-y-3 text-gray-700">
            <label className="inline-flex items-center space-x-2"><input name="enforced" type="checkbox" defaultChecked={!!cfg?.twoFA?.enforced} /><span className="text-gray-700">Enforce 2FA</span></label>
            <div>
              <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded border border-gray-300 shadow-sm p-3 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center">SAML SSO <Info text="Connect your identity provider to centralize authentication and enforce enterprise policies." /></h2>
          <form onSubmit={saveSSO} className="grid md:grid-cols-2 gap-3 text-gray-700">
            <label className="inline-flex items-center space-x-2 md:col-span-2"><input name="enabled" type="checkbox" defaultChecked={!!cfg?.sso?.enabled} /><span className="text-gray-700">Enable SSO</span></label>
            <input name="entityId" defaultValue={cfg?.sso?.saml?.entityId || ''} placeholder="Entity ID" className="border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500" />
            <input name="ssoUrl" defaultValue={cfg?.sso?.saml?.ssoUrl || ''} placeholder="SSO URL" className="border border-gray-300 rounded px-3 py-2 text-gray-900 placeholder-gray-500" />
            <div className="md:col-span-2">
              <button className="bg-btnblue text-white rounded px-4 py-2 hover:opacity-90">Save</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}


