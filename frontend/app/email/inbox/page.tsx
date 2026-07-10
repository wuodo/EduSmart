"use client";
import { useEffect, useState } from 'react';
import { Mail, MailOpen, Send, Inbox } from 'lucide-react';

type EmailMsg = {
  id: string; direction: 'outgoing' | 'incoming'; from: string; to: string;
  subject: string; body: string; status: string; createdAt: string; readAt?: string;
};

export default function InboxPage() {
  const [messages, setMessages] = useState<EmailMsg[]>([]);
  const [selected, setSelected] = useState<EmailMsg | null>(null);
  const [tab, setTab] = useState<'all' | 'inbox' | 'sent'>('all');

  useEffect(() => {
    fetch('/api/proxy/email/list').then(r => r.json()).then(d => {
      if (d.success) setMessages(d.messages);
    }).catch(() => {});
  }, []);

  const filtered = messages.filter(m => {
    if (tab === 'inbox') return m.direction === 'incoming';
    if (tab === 'sent') return m.direction === 'outgoing';
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      <div className="w-80 bg-white rounded-xl border flex flex-col">
        <div className="flex gap-1 p-2 border-b">
          {(['all', 'inbox', 'sent'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md font-medium ${tab === t ? 'bg-teal-100 text-teal-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t === 'inbox' ? <Inbox size={14} /> : t === 'sent' ? <Send size={14} /> : <Mail size={14} />} {t === 'all' ? 'All' : t === 'inbox' ? 'Inbox' : 'Sent'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {filtered.map(m => (
            <button key={m.id} onClick={() => { setSelected(m); if (!m.readAt && m.direction === 'incoming') { fetch(`/api/proxy/email/${m.id}/read`, { method: 'PUT' }); } }} className={`w-full text-left p-3 hover:bg-gray-50 ${selected?.id === m.id ? 'bg-teal-50' : ''} ${!m.readAt && m.direction === 'incoming' ? 'font-semibold bg-blue-50/50' : ''}`}>
              <div className="text-xs text-gray-500">{m.direction === 'incoming' ? m.from : `To: ${m.to}`}</div>
              <div className="text-sm truncate">{m.subject}</div>
              <div className="text-xs text-gray-400 truncate mt-0.5">{m.body?.slice(0, 80)}</div>
              <div className="text-[10px] text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
            </button>
          ))}
          {filtered.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No messages</div>}
        </div>
      </div>
      <div className="flex-1 bg-white rounded-xl border p-6 overflow-y-auto">
        {selected ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{selected.subject}</h2>
            <div className="text-sm text-gray-500 mb-4">
              <span className="font-medium">{selected.direction === 'incoming' ? 'From' : 'To'}:</span> {selected.direction === 'incoming' ? selected.from : selected.to}
              <span className="mx-2">·</span>
              {new Date(selected.createdAt).toLocaleString()}
              <span className="mx-2">·</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selected.status === 'sent' ? 'bg-green-100 text-green-700' : selected.status === 'received' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{selected.status}</span>
            </div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selected.body}</div>
            {selected.html && <div className="mt-4 border-t pt-4" dangerouslySetInnerHTML={{ __html: selected.html }} />}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a message to view</div>
        )}
      </div>
    </div>
  );
}
