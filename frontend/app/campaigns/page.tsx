"use client";
import { useEffect, useState } from 'react';
import { Plus, Send, Pause, Play, Trash2, ChevronRight } from 'lucide-react';

type Campaign = {
  id: string; name: string; description?: string; type: string; status: string;
  sentCount: number; openedCount: number; createdAt: string; scheduleAt?: string;
  audience?: Record<string, unknown>;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'email', audience: '', subject: '', body: '', scheduleAt: '' });
  const [sending, setSending] = useState(false);

  const fetchList = () => {
    setLoading(true);
    fetch('/api/proxy/campaigns').then(r => r.json()).then(d => { if (d.campaigns) setCampaigns(d.campaigns); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, []);

  const createCampaign = async () => {
    if (!form.name) return;
    let audience = {};
    try { audience = form.audience ? JSON.parse(form.audience) : {}; } catch {}
    const r = await fetch('/api/proxy/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, type: form.type, audience, content: { subject: form.subject, body: form.body }, scheduleAt: form.scheduleAt || undefined }),
    });
    if (r.ok) { setShowCreate(false); fetchList(); setForm({ name: '', description: '', type: 'email', audience: '', subject: '', body: '', scheduleAt: '' }); }
  };

  const sendCampaign = async (id: string) => {
    setSending(true);
    await fetch(`/api/proxy/campaigns/${id}/send`, { method: 'POST' });
    setSending(false);
    fetchList();
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    await fetch(`/api/proxy/campaigns/${id}`, { method: 'DELETE' });
    fetchList();
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', scheduled: 'bg-blue-100 text-blue-700', sending: 'bg-amber-100 text-amber-700', sent: 'bg-green-100 text-green-700', completed: 'bg-emerald-100 text-emerald-700', paused: 'bg-yellow-100 text-yellow-700', failed: 'bg-red-100 text-red-700' };
    return map[s] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Campaigns</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create and send email, SMS, and multi-step campaigns to filtered leads</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700"><Plus size={14} /> New Campaign</button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full max-w-lg mx-4 p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">New Campaign</h2>
            <div className="space-y-3 text-sm">
              <div><label className="text-xs text-gray-500 block mb-0.5">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border px-2 py-1.5 text-sm">
                <option value="email">Email Blast</option><option value="sms">SMS Broadcast</option><option value="sequence">Multi-Step Sequence</option>
              </select></div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Audience (JSON, e.g. {"statusIn:['hot'],sourceEquals:'website'"})</label><input value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className="w-full border px-2 py-1.5 text-sm font-mono text-[11px]" placeholder='{"statusIn":["hot","warm"]}' /></div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Subject</label><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Body (use {"{{name}}"} for recipient name)</label><textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4} className="w-full border px-2 py-1.5 text-sm resize-none" /></div>
              <div><label className="text-xs text-gray-500 block mb-0.5">Schedule (leave blank to save as draft)</label><input type="datetime-local" value={form.scheduleAt} onChange={e => setForm({ ...form, scheduleAt: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div className="flex gap-2 pt-2">
                <button onClick={createCampaign} className="px-4 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700">Save Campaign</button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-1.5 border text-xs hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-gray-400">Loading...</div> : campaigns.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No campaigns yet. Create your first campaign to engage leads.</div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white border p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium ${statusColor(c.status)}`}>{c.status}</span>
                  <span className="text-[10px] text-gray-400 uppercase">{c.type}</span>
                </div>
                {c.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{c.description}</div>}
                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                  <span>Sent: {c.sentCount}</span>
                  <span>Opened: {c.openedCount}</span>
                  <span>Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                  {c.scheduleAt && <span>Scheduled: {new Date(c.scheduleAt).toLocaleString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.status === 'draft' && <button onClick={() => sendCampaign(c.id)} disabled={sending} className="p-1.5 hover:bg-green-50 text-green-600" title="Send now"><Send size={14} /></button>}
                {c.status === 'sent' && <button onClick={() => {}} className="p-1.5 hover:bg-blue-50 text-blue-600" title="View results"><ChevronRight size={14} /></button>}
                <button onClick={() => deleteCampaign(c.id)} className="p-1.5 hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
