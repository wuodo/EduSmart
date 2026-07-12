"use client";
import { useEffect, useState, useCallback } from 'react';
import { Check, X, RefreshCw, Flag, UserPlus, Search } from 'lucide-react';

type QaItem = {
  id: string; type: 'inquiry' | 'admission_letter' | 'followup'; refId: number;
  refName: string; score: number; flags: string[]; status: string;
  assignedTo?: string; reviewedBy?: string; reviewComment?: string;
  reviewedAt?: string; createdAt: string;
};

export default function QaReviewPage() {
  const [items, setItems] = useState<QaItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [comment, setComment] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      if (typeFilter) params.set('type', typeFilter);
      const [iRes, sRes] = await Promise.all([
        fetch(`/api/proxy/qa?${params}`),
        fetch('/api/proxy/qa/stats'),
      ]);
      const iData = await iRes.json();
      const sData = await sRes.json();
      if (iData.items) setItems(iData.items);
      if (sData.stats) setStats(sData.stats);
    } catch {}
    setLoading(false);
  }, [filter, typeFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const autoFlag = async () => {
    await fetch('/api/proxy/qa/auto-flag', { method: 'POST' });
    fetchAll();
  };

  const review = async (id: string, status: string) => {
    await fetch(`/api/proxy/qa/${id}/review`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment }),
    });
    setComment(''); setReviewingId(null); fetchAll();
  };

  const assign = async (id: string) => {
    await fetch(`/api/proxy/qa/${id}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: assignEmail }),
    });
    setAssignEmail(''); setAssignId(null); fetchAll();
  };

  const filtered = items.filter(i => {
    if (search) { const q = search.toLowerCase(); return i.refName.toLowerCase().includes(q) || i.flags.some(f => f.toLowerCase().includes(q)); }
    return true;
  });

  const typeColors: Record<string, string> = { inquiry: 'bg-blue-100 text-blue-700', admission_letter: 'bg-purple-100 text-purple-700', followup: 'bg-amber-100 text-amber-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-lg font-bold text-gray-900">QA Review</h1><p className="text-xs text-gray-500">Review inquiry data quality, admission letters, and follow-ups before they go out</p></div>
        <div className="flex items-center gap-2">
          <button onClick={autoFlag} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"><Flag size={12} /> Auto-Flag Issues</button>
          <button onClick={fetchAll} className="p-1.5 hover:bg-gray-100"><RefreshCw size={14} className="text-gray-500" /></button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-gray-900">{stats.total}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Total</div></div>
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-amber-600">{stats.pending}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Pending</div></div>
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-green-600">{stats.approved}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Approved</div></div>
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-red-600">{stats.rejected}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Rejected</div></div>
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-blue-600">{stats.byType?.inquiry || 0}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Inquiries</div></div>
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-purple-600">{stats.byType?.admission_letter || 0}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Letters</div></div>
          <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-amber-600">{stats.byType?.followup || 0}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Follow-ups</div></div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 p-0.5">
          {['', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs font-medium ${filter === s ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{s || 'All'}</button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border px-2 py-1 text-xs">
          <option value="">All types</option><option value="inquiry">Inquiry</option><option value="admission_letter">Admission Letter</option><option value="followup">Follow-up</option>
        </select>
        <div className="relative flex-1 max-w-[200px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-7 pr-2 py-1.5 text-xs border w-full" />
        </div>
      </div>

      {/* Review Queue */}
      {loading ? <div className="text-sm text-gray-400 py-8 text-center">Loading...</div> : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 border-2 border-dashed border-gray-200">No items to review. Run "Auto-Flag Issues" to scan for data quality problems.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(item => (
            <div key={item.id} className={`bg-white border p-3 ${item.status === 'approved' ? 'border-l-4 border-l-green-500' : item.status === 'rejected' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-amber-500'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{item.refName}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-medium ${typeColors[item.type] || 'bg-gray-100 text-gray-700'}`}>{item.type.replace('_', ' ')}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-medium ${item.score >= 80 ? 'bg-green-100 text-green-700' : item.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>Score: {item.score}</span>
                    {item.status !== 'pending' && <span className={`text-[9px] ${item.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>{item.status} by {item.reviewedBy?.split('@')[0]}</span>}
                  </div>
                  {item.flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.flags.map((f, i) => <span key={i} className="px-1.5 py-0.5 text-[9px] bg-red-50 text-red-600 border border-red-100">{f}</span>)}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                    <span>#{item.refId}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.assignedTo && <span>Assigned: {item.assignedTo.split('@')[0]}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'pending' && (
                    <>
                      {reviewingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional comment..." className="border px-1.5 py-1 text-[10px] w-32" />
                          <button onClick={() => review(item.id, 'approved')} className="p-1 hover:bg-green-50 text-green-600"><Check size={14} /></button>
                          <button onClick={() => review(item.id, 'rejected')} className="p-1 hover:bg-red-50 text-red-600"><X size={14} /></button>
                          <button onClick={() => setReviewingId(null)} className="p-1 text-gray-400">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(item.id)} className="px-2 py-1 text-[10px] border hover:bg-gray-50">Review</button>
                      )}
                      {assignId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="Email..." className="border px-1.5 py-1 text-[10px] w-28" />
                          <button onClick={() => assign(item.id)} className="p-1 text-teal-600">✓</button>
                          <button onClick={() => setAssignId(null)} className="p-1 text-gray-400">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setAssignId(item.id)} className="p-1.5 hover:bg-teal-50 text-teal-600" title="Assign to reviewer"><UserPlus size={14} /></button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {item.reviewComment && <div className="mt-1.5 text-[10px] text-gray-500 bg-gray-50 p-1.5 rounded">Comment: {item.reviewComment}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
