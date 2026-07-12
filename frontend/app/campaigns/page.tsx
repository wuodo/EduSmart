"use client";
import { useEffect, useState } from 'react';
import { Plus, Send, Pause, Play, Trash2, ChevronRight, Copy, Eye, Edit3 } from 'lucide-react';

type Campaign = {
  id: string; name: string; description?: string; type: string; status: string;
  sentCount: number; openedCount: number; repliedCount: number; bouncedCount: number;
  createdAt: string; scheduleAt?: string; completedAt?: string;
  audience?: Record<string, unknown>; content?: Record<string, unknown>;
  steps?: { stepOrder: number; delayDays: number; type: string }[];
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ name: '', description: '', type: 'email', statusIn: [] as string[], sourceEquals: '', programEquals: '', subject: '', body: '', scheduleAt: '' });
  const [sending, setSending] = useState<string | null>(null);

  const fetchList = () => {
    setLoading(true);
    fetch('/api/proxy/campaigns').then(r => r.json()).then(d => { if (d.campaigns) setCampaigns(d.campaigns); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { fetchList(); }, []);

  const resetForm = () => setForm({ name: '', description: '', type: 'email', statusIn: [], sourceEquals: '', programEquals: '', subject: '', body: '', scheduleAt: '' });

  const openEdit = (c: Campaign) => {
    setEditingCampaign(c);
    setForm({
      name: c.name, description: c.description || '',
      type: c.type as any, statusIn: (c.audience as any)?.statusIn || [],
      sourceEquals: (c.audience as any)?.sourceEquals || '',
      programEquals: (c.audience as any)?.programEquals || '',
      subject: (c.content as any)?.subject || '',
      body: (c.content as any)?.body || '',
      scheduleAt: c.scheduleAt || '',
    });
    setShowCreate(true);
  };

  const saveCampaign = async () => {
    if (!form.name) return;
    const audience: Record<string, unknown> = {};
    if (form.statusIn.length > 0) audience.statusIn = form.statusIn;
    if (form.sourceEquals) audience.sourceEquals = form.sourceEquals;
    if (form.programEquals) audience.programEquals = form.programEquals;
    const payload = { name: form.name, description: form.description, type: form.type, audience, content: { subject: form.subject, body: form.body }, scheduleAt: form.scheduleAt || undefined };

    if (editingCampaign) {
      await fetch(`/api/proxy/campaigns/${editingCampaign.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/proxy/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowCreate(false); setEditingCampaign(null); resetForm(); fetchList();
  };

  const sendCampaign = async (id: string) => {
    setSending(id);
    await fetch(`/api/proxy/campaigns/${id}/send`, { method: 'POST' });
    setSending(null); fetchList();
  };

  const duplicateCampaign = async (c: Campaign) => {
    await fetch('/api/proxy/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${c.name} (copy)`, description: c.description, type: c.type, audience: c.audience, content: c.content }),
    });
    fetchList();
  };

  const togglePause = async (c: Campaign) => {
    await fetch(`/api/proxy/campaigns/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: c.status === 'paused' ? 'draft' : 'paused' }) });
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
        <div><h1 className="text-lg font-bold text-gray-900">Campaigns</h1><p className="text-xs text-gray-500 mt-0.5">Create and send email, SMS, and multi-step campaigns to filtered leads</p></div>
        <button onClick={() => { setEditingCampaign(null); resetForm(); setShowCreate(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700"><Plus size={14} /> New Campaign</button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowCreate(false); setEditingCampaign(null); }}>
          <div className="bg-white w-full max-w-2xl mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2 sm:col-span-1"><label className="text-xs text-gray-500 block mb-0.5">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div className="col-span-2 sm:col-span-1"><label className="text-xs text-gray-500 block mb-0.5">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border px-2 py-1.5 text-sm">
                <option value="email">Email Blast</option><option value="sms">SMS Broadcast</option><option value="sequence">Multi-Step Sequence</option>
              </select></div>
              <div className="col-span-2"><label className="text-xs text-gray-500 block mb-0.5">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500 block mb-0.5">Target Audience</label>
                <div className="flex flex-wrap gap-2">
                  <select multiple value={form.statusIn} onChange={e => setForm({ ...form, statusIn: Array.from(e.target.selectedOptions, o => o.value) })} className="border px-2 py-1.5 text-xs flex-1 min-w-[120px]"><option value="hot">Hot leads</option><option value="warm">Warm leads</option><option value="cold">Cold leads</option></select>
                  <select value={form.sourceEquals} onChange={e => setForm({ ...form, sourceEquals: e.target.value })} className="border px-2 py-1.5 text-xs flex-1 min-w-[120px]"><option value="">Any source</option><option value="website">Website</option><option value="facebook">Facebook</option><option value="whatsapp">WhatsApp</option><option value="referral">Referral</option><option value="walk-in">Walk-in</option></select>
                  <input value={form.programEquals} onChange={e => setForm({ ...form, programEquals: e.target.value })} placeholder="Program (optional)" className="border px-2 py-1.5 text-xs flex-1 min-w-[120px]" />
                </div>
                <div className="text-[10px] text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple statuses.</div>
              </div>
              <div className="col-span-2 sm:col-span-1"><label className="text-xs text-gray-500 block mb-0.5">Subject</label><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div className="col-span-2 sm:col-span-1"><label className="text-xs text-gray-500 block mb-0.5">Schedule</label><input type="datetime-local" value={form.scheduleAt} onChange={e => setForm({ ...form, scheduleAt: e.target.value })} className="w-full border px-2 py-1.5 text-sm" /></div>
              <div className="col-span-2"><label className="text-xs text-gray-500 block mb-0.5">Body (use {"{{name}}"} for recipient name)</label><textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={4} className="w-full border px-2 py-1.5 text-sm resize-none" /></div>
            </div>
            <div className="flex gap-2 pt-4 border-t mt-4">
              <button onClick={saveCampaign} className="px-5 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700">{editingCampaign ? 'Update Campaign' : 'Save Campaign'}</button>
              <button onClick={() => { setShowCreate(false); setEditingCampaign(null); }} className="px-5 py-1.5 border text-xs hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewingCampaign(null)}>
          <div className="bg-white w-full max-w-xl mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold">{viewingCampaign.name}</h2><button onClick={() => setViewingCampaign(null)} className="p-1 hover:bg-gray-100 text-gray-500">✕</button></div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Status</span><span className={`px-1.5 py-0.5 text-[10px] font-medium ${statusColor(viewingCampaign.status)}`}>{viewingCampaign.status}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Type</span><span>{viewingCampaign.type}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Audience</span><span className="text-right max-w-[60%] truncate">{JSON.stringify(viewingCampaign.audience)}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Sent / Opened</span><span>{viewingCampaign.sentCount} / {viewingCampaign.openedCount}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Bounced</span><span>{viewingCampaign.bouncedCount}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Created</span><span>{new Date(viewingCampaign.createdAt).toLocaleString()}</span></div>
              {viewingCampaign.scheduleAt && <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Scheduled</span><span>{new Date(viewingCampaign.scheduleAt).toLocaleString()}</span></div>}
              {viewingCampaign.completedAt && <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Completed</span><span>{new Date(viewingCampaign.completedAt).toLocaleString()}</span></div>}
            </div>
            <div className="flex justify-end mt-4"><button onClick={() => setViewingCampaign(null)} className="px-4 py-1.5 border text-xs hover:bg-gray-50">Close</button></div>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-gray-400 py-8 text-center">Loading...</div> : campaigns.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400 border-2 border-dashed border-gray-200">No campaigns yet. Click "New Campaign" to create your first one.</div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white border p-3 flex items-center justify-between gap-3 hover:border-teal-200 transition-colors">
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setViewingCampaign(c)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium ${statusColor(c.status)}`}>{c.status}</span>
                  <span className="text-[10px] text-gray-400 uppercase">{c.type}</span>
                </div>
                {c.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{c.description}</div>}
                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                  <span>Sent: <strong>{c.sentCount}</strong></span>
                  <span>Opened: <strong>{c.openedCount}</strong></span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                  {c.scheduleAt && <span>Scheduled: {new Date(c.scheduleAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 text-gray-500" title="Edit"><Edit3 size={14} /></button>
                <button onClick={() => duplicateCampaign(c)} className="p-1.5 hover:bg-purple-50 text-purple-500" title="Duplicate"><Copy size={14} /></button>
                {c.status === 'draft' && <button onClick={() => sendCampaign(c.id)} disabled={sending === c.id} className="p-1.5 hover:bg-green-50 text-green-600" title="Send now">{sending === c.id ? '...' : <Send size={14} />}</button>}
                {(c.status === 'sending' || c.status === 'sent') && <button onClick={() => togglePause(c)} className="p-1.5 hover:bg-yellow-50 text-yellow-600" title={c.status === 'paused' ? 'Resume' : 'Pause'}>{c.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}</button>}
                <button onClick={() => setViewingCampaign(c)} className="p-1.5 hover:bg-blue-50 text-blue-500" title="View details"><Eye size={14} /></button>
                <button onClick={() => deleteCampaign(c.id)} className="p-1.5 hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
