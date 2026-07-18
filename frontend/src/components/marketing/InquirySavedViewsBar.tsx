"use client";
import { useCallback, useEffect, useState } from 'react';
import type { InquiryFilterSnapshot } from '@/lib/inquirySavedViews';
import { deleteSavedView, loadSavedViews, saveNamedView, type SavedInquiryView } from '@/lib/inquirySavedViews';
import { BookmarkIcon, TrashIcon, X } from 'lucide-react';

export default function InquirySavedViewsBar({ snapshot, onApply, isAdmin }: {
  snapshot: InquiryFilterSnapshot;
  onApply: (filters: InquiryFilterSnapshot) => void;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedInquiryView[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = useCallback(() => { setViews(loadSavedViews()); }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = () => {
    const n = name.trim();
    if (!n) { setMsg('Enter a name.'); return; }
    const toSave = { ...snapshot };
    if (!isAdmin) toSave.owner = '';
    saveNamedView(n, toSave);
    setName(''); refresh();
    setMsg(`Saved "${n}".`);
    setTimeout(() => setMsg(''), 2000);
  };

  const remove = () => {
    if (!selectedId) return;
    deleteSavedView(selectedId);
    setSelectedId(''); refresh();
    setMsg('Deleted.');
    setTimeout(() => setMsg(''), 2000);
  };

  const load = (id: string) => {
    const v = views.find(x => x.id === id);
    if (!v) return;
    const f = { ...v.filters };
    if (!isAdmin) f.owner = '';
    onApply(f);
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => { setOpen(true); refresh(); }} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border hover:bg-gray-50 shrink-0" title="Saved views">
        <BookmarkIcon size={12} /> Views
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-sm mx-4 p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Saved Views</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100"><X size={16} /></button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
              {views.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">No saved views yet</div>
              ) : views.map(v => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <button onClick={() => load(v.id)} className="flex-1 text-left px-2 py-1.5 border hover:bg-gray-50 truncate">{v.name}</button>
                  <button onClick={() => { setSelectedId(v.id); remove(); }} className="p-1 hover:bg-red-50 text-red-500 shrink-0"><TrashIcon size={12} /></button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t pt-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name for current filters..." className="flex-1 border px-2 py-1.5 text-xs" />
              <button onClick={save} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700">Save Current</button>
            </div>
            {msg && <p className="text-xs text-gray-500 mt-2">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
