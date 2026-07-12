"use client";
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function DataQualityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/qa/data-quality').then(r => r.json()).then(d => { if (d.success) setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading...</div>;
  if (!data) return <div className="p-8 text-sm text-red-500">Failed to load</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-gray-900">Data Quality</h1><p className="text-xs text-gray-500">Completeness across {data.total} inquiries</p></div>
        <button onClick={() => window.location.reload()} className="p-1 hover:bg-gray-100"><RefreshCw size={14} /></button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-gray-900">{data.total}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Total Inquiries</div></div>
        <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-teal-600">{data.total - data.fields.reduce((s: number, f: any) => s + f.count, 0)}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Complete</div></div>
        <div className="bg-white border p-2.5 px-4 card-hover"><div className="text-sm font-bold text-amber-600">{data.fields.length}</div><div className="text-[9px] text-gray-500 uppercase tracking-wide">Missing Fields</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border p-3">
          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Fields with Missing Data</div>
          <div className="space-y-2">
            {data.fields.length === 0 ? <div className="text-xs text-gray-400">All fields are complete!</div> : data.fields.map((f: any) => (
              <div key={f.field} className="flex items-center gap-2">
                <div className="flex-1 text-xs text-gray-700 capitalize">{f.field.replace(/([A-Z])/g, ' $1')}</div>
                <div className="text-xs font-semibold" style={{ color: f.pct > 50 ? '#dc2626' : f.pct > 20 ? '#d97706' : '#0d9488' }}>{f.count} ({f.pct}%)</div>
                <div className="w-20 h-2 bg-gray-100">
                  <div className="h-full" style={{ width: `${f.pct}%`, backgroundColor: f.pct > 50 ? '#dc2626' : f.pct > 20 ? '#d97706' : '#0d9488' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border p-3">
          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Staff Data Quality (lowest first)</div>
          <div className="space-y-2">
            {data.staffQuality.length === 0 ? <div className="text-xs text-gray-400">No staff data</div> : data.staffQuality.map((s: any) => (
              <div key={s.email} className="flex items-center gap-2">
                <div className="flex-1 text-xs truncate">{s.name.split('@')[0]}</div>
                <div className="text-xs text-gray-400">{s.created} created</div>
                <div className="text-xs font-semibold" style={{ color: s.avgScore < 70 ? '#dc2626' : s.avgScore < 90 ? '#d97706' : '#0d9488' }}>{s.avgScore}%</div>
                <div className="w-16 h-2 bg-gray-100">
                  <div className="h-full" style={{ width: `${s.avgScore}%`, backgroundColor: s.avgScore < 70 ? '#dc2626' : s.avgScore < 90 ? '#d97706' : '#0d9488' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
