"use client";
import { useEffect, useState } from 'react';

type SmtpConfig = {
  host: string; port: number; secure: boolean;
  user: string; pass: string; from: string;
};

type Tenant = { id: number; name: string; subdomain?: string };

export default function SmtpPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [config, setConfig] = useState<SmtpConfig>({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/cpanel/tenants').then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.tenants)) { setTenants(d.tenants); if (d.tenants.length > 0) setSelectedTenantId(d.tenants[0].id); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    setMsg('');
    fetch(`/api/proxy/cpanel/tenants/${selectedTenantId}/smtp`).then(r => r.json()).then(d => {
      if (d.success && d.smtp) {
        setConfig({ host: d.smtp.host || '', port: d.smtp.port || 587, secure: d.smtp.secure || false, user: d.smtp.user || '', pass: '', from: d.smtp.from || '' });
      }
    }).catch(() => {});
  }, [selectedTenantId]);

  const save = async () => {
    if (!selectedTenantId) return;
    setSaving(true); setMsg('');
    const body: any = { host: config.host, port: config.port, secure: config.secure, user: config.user, from: config.from };
    if (config.pass) body.pass = config.pass;
    const r = await fetch(`/api/proxy/cpanel/tenants/${selectedTenantId}/smtp`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await r.json();
    setMsg(d.success ? 'Saved successfully' : 'Error: ' + (d.error || 'unknown'));
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-gray-500">Loading tenants...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">SMTP Settings</h1>
      <p className="text-sm text-gray-500">Configure email sending for each tenant (used for daily digests, reminders, and alerts).</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
        <select className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm" value={selectedTenantId ?? ''} onChange={e => setSelectedTenantId(Number(e.target.value) || null)}>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.subdomain || '—'})</option>)}
        </select>
      </div>

      {selectedTenantId && (
        <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} placeholder="mail.yourdomain.com" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={config.port} onChange={e => setConfig({ ...config, port: Number(e.target.value) || 587 })} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={config.secure} onChange={e => setConfig({ ...config, secure: e.target.checked })} className="rounded" />
                SSL/TLS
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={config.user} onChange={e => setConfig({ ...config, user: e.target.value })} placeholder="noreply@domain.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={config.pass} onChange={e => setConfig({ ...config, pass: e.target.value })} placeholder={config.pass ? 'Leave blank to keep current' : 'Enter password'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={config.from} onChange={e => setConfig({ ...config, from: e.target.value })} placeholder="noreply@domain.com" />
          </div>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save SMTP Settings'}
          </button>
          {msg && <p className={`text-sm ${msg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
