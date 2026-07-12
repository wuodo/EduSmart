"use client";
import { useEffect, useState } from 'react';
import { Search, Save } from 'lucide-react';

const ALL_FIELDS = ['fullName','phone','email','programOfInterest','intakePeriod','studyMode','source','preferredContactMethod','kcseGrade','gender'];

export default function MassUpdatePage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetField, setTargetField] = useState('programOfInterest');
  const [defaultValue, setDefaultValue] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState('');

  const scan = async () => {
    setLoading(true);
    const r = await fetch('/api/proxy/inquiries?limit=200');
    const d = await r.json();
    const list = d.inquiries || d.data || [];
    setInquiries(Array.isArray(list) ? list : []);
    setLoading(false);
  };

  useEffect(() => { scan(); }, []);

  const generatePreview = () => {
    const missing = inquiries.filter((i: any) => !i[targetField] || i[targetField] === '' || i[targetField] === 'Unknown');
    setPreview(missing.slice(0, 20).map((i: any) => ({ id: i.id, name: i.fullName, current: i[targetField] || '—' })));
  };

  const apply = async () => {
    if (!defaultValue) { setMsg('Enter a default value first'); return; }
    setApplying(true); setMsg('');
    const missing = inquiries.filter((i: any) => !i[targetField] || i[targetField] === '' || i[targetField] === 'Unknown');
    let updated = 0;
    for (const i of missing) {
      try {
        const r = await fetch(`/api/proxy/inquiries/${i.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [targetField]: defaultValue }),
        });
        if (r.ok) updated++;
      } catch {}
    }
    setMsg(`Updated ${updated} of ${missing.length} inquiries`);
    setApplying(false);
    scan();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-bold text-gray-900">Mass Update</h1>
      <p className="text-xs text-gray-500">Set a default value for a missing field across all inquiries.</p>

      <div className="bg-white border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-20">Field:</label>
          <select value={targetField} onChange={e => setTargetField(e.target.value)} className="border px-2 py-1.5 text-xs flex-1">
            {ALL_FIELDS.map(f => <option key={f} value={f}>{f.replace(/([A-Z])/g, ' $1')}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-20">Set to:</label>
          <input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="e.g. Website" className="border px-2 py-1.5 text-xs flex-1" />
        </div>
        <div className="flex gap-2">
          <button onClick={generatePreview} className="flex items-center gap-1 px-3 py-1.5 border text-xs hover:bg-gray-50"><Search size={12} /> Preview</button>
          <button onClick={apply} disabled={applying} className="flex items-center gap-1 px-4 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-50"><Save size={12} /> {applying ? 'Applying...' : 'Apply to All'}</button>
        </div>
        {msg && <p className={`text-xs ${msg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
      </div>

      {preview.length > 0 && (
        <div className="bg-white border overflow-x-auto">
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-b">Preview — first {preview.length} of {inquiries.filter((i: any) => !i[targetField]).length} affected inquiries</div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50"><tr><th className="text-left px-3 py-1.5">Name</th><th className="text-left px-3 py-1.5">Current</th><th className="text-left px-3 py-1.5">New</th></tr></thead>
            <tbody className="divide-y">
              {preview.map(p => <tr key={p.id}><td className="px-3 py-1.5">{p.name}</td><td className="px-3 py-1.5 text-gray-400">{p.current}</td><td className="px-3 py-1.5 text-teal-700">{defaultValue || '—'}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className="text-xs text-gray-400">Loading inquiries...</div>}
    </div>
  );
}
