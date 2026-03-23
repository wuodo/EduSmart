import { useEffect, useState } from 'react';

const API_URL = '/api/marketing/settings/communication';

export default function Communication() {
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [whatsapp, setWhatsapp] = useState({ enabled: false, apiKey: '', senderNumber: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        setEmailTemplates(data.emailTemplates);
        setWhatsapp(data.whatsapp);
        setLoading(false);
      });
  }, []);

  const handleEmailTemplateChange = (idx: number, field: string, value: string) => {
    setEmailTemplates(tpls => tpls.map((tpl, i) => i === idx ? { ...tpl, [field]: value } : tpl));
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailTemplates, whatsapp }),
      credentials: 'include',
    });
    setSaving(false);
    setSuccess('Settings saved!');
    setTimeout(() => setSuccess(''), 2000);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Communication Settings</h2>
      {success && <div className="mb-4 text-green-700 bg-green-50 border border-green-200 rounded px-4 py-2">{success}</div>}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Email Templates</h3>
        <div className="space-y-6">
          {emailTemplates.map((tpl, idx) => (
            <div key={tpl.id} className="border rounded p-4 bg-white">
              <div className="mb-2 font-medium">{tpl.name}</div>
              <div className="mb-2">
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={tpl.subject} onChange={e => handleEmailTemplateChange(idx, 'subject', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea className="w-full border rounded px-3 py-2" rows={3} value={tpl.body} onChange={e => handleEmailTemplateChange(idx, 'body', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">WhatsApp Integration</h3>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block font-medium mb-1">Enable WhatsApp</label>
            <input type="checkbox" checked={whatsapp.enabled} onChange={e => setWhatsapp(w => ({ ...w, enabled: e.target.checked }))} />
          </div>
          <div>
            <label className="block font-medium mb-1">API Key</label>
            <input type="text" className="w-full border rounded px-3 py-2" value={whatsapp.apiKey} onChange={e => setWhatsapp(w => ({ ...w, apiKey: e.target.value }))} />
          </div>
          <div>
            <label className="block font-medium mb-1">Sender Number</label>
            <input type="text" className="w-full border rounded px-3 py-2" value={whatsapp.senderNumber} onChange={e => setWhatsapp(w => ({ ...w, senderNumber: e.target.value }))} />
          </div>
        </div>
      </div>
      <button onClick={handleSave} className="bg-primary text-white px-4 py-2 rounded" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
    </div>
  );
} 