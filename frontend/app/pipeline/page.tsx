"use client";
import { useEffect, useState, useCallback } from 'react';
import { Phone, Mail, MessageCircle, RefreshCw } from 'lucide-react';

type InquiryCard = { id: number; fullName: string; phone: string; email: string; programOfInterest?: string; score?: number; assignedTo?: string; status: string };
type StageStat = { stage: string; total: number; converted: number; conversionRate: number };

export default function PipelinePage() {
  const [inquiries, setInquiries] = useState<InquiryCard[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [stats, setStats] = useState<StageStat[]>([]);
  const [overallRate, setOverallRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, cRes] = await Promise.all([
        fetch('/api/proxy/inquiries?limit=200'),
        fetch('/api/proxy/pipeline/config'),
      ]);
      const iData = await iRes.json();
      const cData = await cRes.json();
      const list = iData.inquiries || iData.data || [];
      setInquiries(Array.isArray(list) ? list : []);
      if (cData.success) { setStages(cData.stages); setStats(cData.stats); setOverallRate(cData.overallRate); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const moveCard = async (id: number, newStatus: string) => {
    setError('');
    const r = await fetch(`/api/proxy/pipeline/inquiries/${id}/stage`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) { setError('Failed to update stage'); return; }
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    fetchAll();
  };

  const handleDragStart = (id: number) => setDraggedId(id);
  const handleDrop = (newStatus: string) => { if (draggedId) { moveCard(draggedId, newStatus); setDraggedId(null); } };

  const stageInquiries = (stage: string) => inquiries.filter(i => (i.status || 'Pending') === stage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Pipeline</h1>
          <p className="text-xs text-gray-500 mt-0.5">Drag cards between columns to update lead status. Click icons to call/email/WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Overall conversion: <strong className="text-teal-700">{overallRate}%</strong></span>
          <button onClick={fetchAll} className="p-1 hover:bg-gray-100"><RefreshCw size={14} /></button>
        </div>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 p-2">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading pipeline...</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {stages.map((stage) => {
            const cards = stageInquiries(stage);
            const stat = stats.find(s => s.stage === stage);
            const stageTotal = stat?.total || 0;
            const stageRate = stat?.conversionRate ?? 0;
            return (
              <div key={stage} className="flex-shrink-0 w-64 bg-gray-50 border flex flex-col" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(stage)}>
                <div className="px-3 py-2 border-b bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize text-gray-800">{stage}</span>
                    <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5">{cards.length}</span>
                  </div>
                  <span className={`text-[10px] font-medium ${stageRate >= 50 ? 'text-green-600' : stageRate >= 20 ? 'text-amber-600' : 'text-gray-400'}`}>{stageRate}%</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                  {cards.map(c => (
                    <div key={c.id} draggable onDragStart={() => handleDragStart(c.id)} className="bg-white border p-2.5 cursor-grab active:cursor-grabbing hover:border-teal-300 transition-colors card-hover">
                      <div className="text-xs font-semibold text-gray-900 truncate">{c.fullName}</div>
                      <div className="text-[10px] text-gray-500 truncate mt-0.5">{c.programOfInterest || '—'}</div>
                      {c.score !== undefined && c.score > 0 && <div className="text-[10px] text-teal-600 mt-0.5">Score: {c.score}</div>}
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
                        {c.phone && <a href={`tel:${c.phone}`} className="p-1 hover:bg-green-50 text-green-600" title={`Call ${c.phone}`}><Phone size={12} /></a>}
                        {c.email && <a href={`mailto:${c.email}`} className="p-1 hover:bg-blue-50 text-blue-600" title={`Email ${c.email}`}><Mail size={12} /></a>}
                        {c.phone && <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-emerald-50 text-emerald-600" title="WhatsApp"><MessageCircle size={12} /></a>}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <div className="text-[10px] text-gray-400 text-center py-4">Drag leads here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
