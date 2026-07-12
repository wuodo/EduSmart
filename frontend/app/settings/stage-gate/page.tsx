"use client";
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

type Rule = { from: string; to: string; requiredFields: string[] };

const ALL_FIELDS = ['fullName','phone','email','programOfInterest','intakePeriod','studyMode','source','preferredContactMethod','kcseGrade','gender'];

export default function StageGatePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/proxy/tenants/me/crm').then(r => r.json()).then(d => {
      if (d.crm?.stageGateRules) setRules(d.crm.stageGateRules);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    const r = await fetch('/api/proxy/tenants/me/crm', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageGateRules: rules }),
    });
    const d = await r.json();
    setMsg(d.success ? 'Saved' : 'Error: ' + (d.error || 'unknown'));
    setSaving(false);
  };

  const addRule = () => setRules([...rules, { from: '', to: '', requiredFields: [] }]);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-lg font-bold text-gray-900">Stage-Gate Validation</h1>
      <p className="text-xs text-gray-500">Require specific fields to be filled before an inquiry can move to the next pipeline stage.</p>
      <div className="space-y-2">
        {rules.map((r, i) => (
          <div key={i} className="bg-white border p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <select value={r.from} onChange={e => { const a = [...rules]; a[i].from = e.target.value; setRules(a); }} className="border px-2 py-1 text-xs"><option value="">From stage</option><option value="new">new</option><option value="contacted">contacted</option><option value="qualified">qualified</option><option value="proposal">proposal</option><option value="negotiated">negotiated</option><option value="won">won</option><option value="lost">lost</option></select>
              <span className="text-xs text-gray-400">→</span>
              <select value={r.to} onChange={e => { const a = [...rules]; a[i].to = e.target.value; setRules(a); }} className="border px-2 py-1 text-xs"><option value="">To stage</option><option value="new">new</option><option value="contacted">contacted</option><option value="qualified">qualified</option><option value="proposal">proposal</option><option value="negotiated">negotiated</option><option value="won">won</option><option value="lost">lost</option></select>
              <button onClick={() => setRules(rules.filter((_, idx) => idx !== i))} className="p-1 hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
            </div>
            <div className="flex flex-wrap gap-1">
              {ALL_FIELDS.map(f => (
                <label key={f} className={`px-2 py-0.5 text-[10px] cursor-pointer border ${r.requiredFields.includes(f) ? 'bg-teal-100 border-teal-400 text-teal-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  <input type="checkbox" checked={r.requiredFields.includes(f)} onChange={e => { const a = [...rules]; if (e.target.checked) a[i].requiredFields.push(f); else a[i].requiredFields = a[i].requiredFields.filter(x => x !== f); setRules(a); }} className="hidden" />
                  {f.replace(/([A-Z])/g, ' $1')}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={addRule} className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 hover:border-teal-400 hover:text-teal-600 text-xs"><Plus size={12} /> Add Rule</button>
      <button onClick={save} disabled={saving} className="flex items-center gap-1 px-4 py-1.5 bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-50"><Save size={14} /> {saving ? 'Saving...' : 'Save Rules'}</button>
      {msg && <p className={`text-xs ${msg.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
    </div>
  );
}
