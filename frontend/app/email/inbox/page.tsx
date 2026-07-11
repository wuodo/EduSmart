"use client";
import { useEffect, useState, useCallback } from 'react';
import { Mail, Inbox, Send, Archive, Trash2, Reply, Forward, CornerUpLeft, CornerUpRight, RefreshCw, Loader, Search, X, Check } from 'lucide-react';

type EmailMsg = {
  id: string; direction: 'outgoing' | 'incoming'; from: string; to: string;
  subject: string; body: string; html?: string; status: string; createdAt: string;
  readAt?: string; archived?: boolean; parentId?: string; reference?: string; inquiryId?: number;
};

export default function InboxPage() {
  const [messages, setMessages] = useState<EmailMsg[]>([]);
  const [selected, setSelected] = useState<EmailMsg | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inbox' | 'sent' | 'archived'>('inbox');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeSent, setComposeSent] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [search, setSearch] = useState('');
  const [templates, setTemplates] = useState<{ id: string; title: string; body: string }[]>([]);

  const fetchMessages = useCallback(() => {
    setLoading(true);
    const url = `/api/proxy/email/list${tab === 'archived' ? '?archived=true' : ''}`;
    fetch(url).then(r => r.json()).then(d => { if (d.success) setMessages(d.messages); setLoading(false); }).catch(() => setLoading(false));
  }, [tab]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const filtered = messages.filter(m => {
    if (tab === 'inbox') return m.direction === 'incoming' && !m.archived;
    if (tab === 'sent') return m.direction === 'outgoing' && !m.archived;
    if (tab === 'archived') return m.archived;
    return true;
  }).filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.subject.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.to.toLowerCase().includes(q) || m.body.toLowerCase().includes(q);
  });

  const openCompose = (mode: 'new' | 'reply' | 'forward', msg?: EmailMsg) => {
    setComposeMode(mode);
    setComposeSent(false);
    setComposeError('');
    if (mode === 'new') { setComposeTo(''); setComposeSubject(''); setComposeBody(''); }
    else if (msg) {
      if (mode === 'reply') { setComposeTo(msg.from); setComposeSubject(`Re: ${msg.subject}`); setComposeBody(`\n\n--- Original message ---\nFrom: ${msg.from}\nDate: ${new Date(msg.createdAt).toLocaleString()}\nSubject: ${msg.subject}\n\n${msg.body}`); }
      else { setComposeTo(''); setComposeSubject(`Fwd: ${msg.subject}`); setComposeBody(`\n\n--- Forwarded message ---\nFrom: ${msg.from}\nDate: ${new Date(msg.createdAt).toLocaleString()}\nSubject: ${msg.subject}\nTo: ${msg.to}\n\n${msg.body}`); }
    }
    fetch('/api/proxy/email/templates').then(r => r.json()).then(d => { if (d.templates) setTemplates(d.templates); }).catch(() => {});
    setComposeOpen(true);
  };

  const handleComposeSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) { setComposeError('To, subject, and message required'); return; }
    setComposeSending(true); setComposeError('');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch('/api/proxy/email/send', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody, html: composeBody.replace(/\n/g, '<br>') }),
      });
      clearTimeout(timeoutId);
      const d = await r.json();
      if (d.success && d.sent) { setComposeSent(true); setTimeout(() => { setComposeOpen(false); fetchMessages(); }, 1500); }
      else setComposeError(d.error || 'Failed to send');
    } catch (e: any) {
      clearTimeout(timeoutId);
      setComposeError(e.name === 'AbortError' ? 'Timed out — check SMTP settings' : e.message);
    }
    setComposeSending(false);
  };

  const archiveMessage = async (id: string) => {
    await fetch(`/api/proxy/email/${id}/archive`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) });
    if (selected?.id === id) setSelected(null);
    fetchMessages();
  };

  const deleteMessage = async (id: string) => {
    await fetch(`/api/proxy/email/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    fetchMessages();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Email</h1>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['inbox', 'sent', 'archived'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium capitalize ${tab === t ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'inbox' ? <Inbox size={14} /> : t === 'sent' ? <Send size={14} /> : <Archive size={14} />} {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails..." className="pl-8 pr-3 py-1.5 text-xs border rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-teal-500" />
          </div>
          <button onClick={() => openCompose('new')} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700"><Mail size={14} /> Compose</button>
          <button onClick={fetchMessages} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw size={14} className="text-gray-500" /></button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="w-80 bg-white rounded-xl border flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto divide-y">
            {loading ? (
              <div className="flex items-center justify-center p-8"><Loader size={20} className="animate-spin text-gray-400" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No messages</div>
            ) : filtered.map(m => (
              <button key={m.id} onClick={() => { setSelected(m); if (!m.readAt && m.direction === 'incoming') fetch(`/api/proxy/email/${m.id}/read`, { method: 'PUT' }); fetchMessages(); }} className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selected?.id === m.id ? 'bg-teal-50 border-l-2 border-teal-500' : ''} ${!m.readAt && m.direction === 'incoming' ? 'bg-blue-50/40 font-semibold' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${!m.readAt && m.direction === 'incoming' ? 'font-semibold' : ''}`}>{m.direction === 'incoming' ? m.from : `To: ${m.to}`}</span>
                  <span className="text-[10px] text-gray-400 ml-2 shrink-0">{new Date(m.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-sm truncate mt-0.5">{m.subject || '(No subject)'}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{m.body?.slice(0, 80)}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${m.status === 'sent' ? 'bg-green-100 text-green-700' : m.status === 'received' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span>
                  {m.direction === 'incoming' && !m.readAt && <span className="text-[9px] text-blue-600 font-medium">NEW</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border flex flex-col min-h-0">
          {selected ? (
            <>
              <div className="px-5 py-4 border-b flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{selected.subject || '(No subject)'}</h2>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">{selected.direction === 'incoming' ? 'From' : 'To'}:</span> {selected.direction === 'incoming' ? selected.from : selected.to}
                    <span className="mx-2">·</span>
                    {new Date(selected.createdAt).toLocaleString()}
                    <span className="mx-2">·</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selected.status === 'sent' ? 'bg-green-100 text-green-700' : selected.status === 'received' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{selected.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {selected.direction === 'incoming' && <button onClick={() => openCompose('reply', selected)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Reply"><CornerUpLeft size={16} /></button>}
                  {selected.direction === 'incoming' && <button onClick={() => openCompose('forward', selected)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Forward"><CornerUpRight size={16} /></button>}
                  <button onClick={() => archiveMessage(selected.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="Archive"><Archive size={16} /></button>
                  <button onClick={() => deleteMessage(selected.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500" title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {selected.html && !selected.html.startsWith('<') ? (
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selected.body}</div>
                ) : selected.html ? (
                  <div className="text-sm text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.html }} />
                ) : (
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selected.body}</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a message to view</div>
          )}
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-sm font-semibold text-gray-800 capitalize">{composeMode === 'forward' ? 'Forward' : composeMode === 'reply' ? 'Reply' : 'Compose'} Email</h2>
              <button onClick={() => setComposeOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            {composeSent ? (
              <div className="p-8 text-center text-green-600 font-medium"><Check size={24} className="mx-auto mb-2" /> Sent successfully!</div>
            ) : (
              <>
                <div className="px-4 py-3 space-y-3 flex-1 overflow-y-auto">
                  <div><label className="text-xs text-gray-500 block mb-0.5">To</label><input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="email@example.com" /></div>
                  <div><label className="text-xs text-gray-500 block mb-0.5">Subject</label><input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500 block mb-0.5">Quick Templates</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {templates.map(t => (
                        <button key={t.id} onClick={() => setComposeBody(composeBody + '\n' + t.body)} className="px-2 py-1 text-[10px] border border-gray-300 hover:bg-gray-100">{t.title}</button>
                      ))}
                      <button onClick={async () => {
                        const title = prompt('Template name:'); if (!title) return;
                        const body = prompt('Template body:'); if (!body) return;
                        await fetch('/api/proxy/email/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) });
                        fetch('/api/proxy/email/templates').then(r => r.json()).then(d => { if (d.templates) setTemplates(d.templates); }).catch(() => {});
                      }} className="px-2 py-1 text-[10px] border border-dashed border-gray-400 text-gray-500 hover:bg-gray-50">+ Add</button>
                    </div>
                  </div>
                  <div><label className="text-xs text-gray-500 block mb-0.5">Message</label><textarea className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none" rows={10} value={composeBody} onChange={e => setComposeBody(e.target.value)} /></div>
                  {composeError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{composeError}</p>}
                </div>
                <div className="px-4 py-3 border-t flex justify-end">
                  <button onClick={handleComposeSend} disabled={composeSending} className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                    {composeSending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                    {composeSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
