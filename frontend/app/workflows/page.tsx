"use client";
import { useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical, Play, Pause, ArrowDown, Zap, ChevronRight } from 'lucide-react';

type TriggerType = 'inquiry_created' | 'inquiry_status_changed' | 'followup_completed';
type ActionType = 'create_followup' | 'assign_inquiry' | 'add_tags';

type When = { statusIn?: string[]; sourceEquals?: string; fromStatus?: string; toStatus?: string; followupTypeEquals?: string };
type Action = { type: ActionType; followupType?: string; daysFromNow?: number; notes?: string; assignTo?: string; tags?: string[] };

type Rule = {
  id: string; enabled: boolean; order: number; trigger: TriggerType; when?: When; action: Action;
  subsequentActions?: Action[];
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  inquiry_created: 'Inquiry Created',
  inquiry_status_changed: 'Status Changed',
  followup_completed: 'Follow-up Completed',
};
const ACTION_LABELS: Record<ActionType, string> = {
  create_followup: 'Create Follow-up',
  assign_inquiry: 'Assign to Staff',
  add_tags: 'Add Tags',
};

function FlowCard({ rule, index, onChange, onDelete }: { rule: Rule; index: number; onChange: (r: Rule) => void; onDelete: () => void }) {
  const addSubAction = () => {
    const newAction: Action = rule.subsequentActions ? [...rule.subsequentActions, { type: 'create_followup', followupType: 'call', daysFromNow: 1 }] : [{ type: 'create_followup', followupType: 'call', daysFromNow: 1 }];
    onChange({ ...rule, subsequentActions: newAction });
  };
  const updateSubAction = (idx: number, a: Action) => {
    const arr = rule.subsequentActions ? [...rule.subsequentActions] : [];
    arr[idx] = a;
    onChange({ ...rule, subsequentActions: arr });
  };
  const removeSubAction = (idx: number) => {
    const arr = rule.subsequentActions ? [...rule.subsequentActions] : [];
    arr.splice(idx, 1);
    onChange({ ...rule, subsequentActions: arr });
  };
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-700">
        <GripVertical size={14} className="text-gray-400 cursor-move" />
        <span className="text-teal-600">#{index + 1}</span>
        <span className="text-[10px] text-gray-500">Order: {rule.order}</span>
        <select value={rule.trigger} onChange={e => onChange({ ...rule, trigger: e.target.value as TriggerType, when: {} })} className="ml-2 text-xs border rounded px-1 py-0.5">
          {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="ml-auto flex items-center gap-1 text-[10px]">
          <input type="checkbox" checked={rule.enabled} onChange={e => onChange({ ...rule, enabled: e.target.checked })} />
          Active
        </label>
        <button onClick={onDelete} className="p-0.5 hover:bg-red-50 rounded text-red-500"><Trash2 size={12} /></button>
      </div>
      <div className="p-3 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-teal-700 font-medium"><Zap size={14} /> WHEN</div>
        {rule.trigger === 'inquiry_created' && (
          <div className="flex flex-wrap gap-2">
            <label>Status is:<select multiple value={rule.when?.statusIn || []} onChange={e => onChange({ ...rule, when: { ...rule.when, statusIn: Array.from(e.target.selectedOptions, o => o.value) } })} className="text-xs border rounded px-1 py-0.5"><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></label>
            <label>Source equals:<input value={rule.when?.sourceEquals || ''} onChange={e => onChange({ ...rule, when: { ...rule.when, sourceEquals: e.target.value } })} className="border rounded px-1 py-0.5 w-24" /></label>
          </div>
        )}
        {rule.trigger === 'inquiry_status_changed' && (
          <div className="flex flex-wrap gap-2">
            <label>From:<select value={rule.when?.fromStatus || ''} onChange={e => onChange({ ...rule, when: { ...rule.when, fromStatus: e.target.value } })} className="text-xs border rounded px-1 py-0.5"><option value="">Any</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></label>
            <label>To:<select value={rule.when?.toStatus || ''} onChange={e => onChange({ ...rule, when: { ...rule.when, toStatus: e.target.value } })} className="text-xs border rounded px-1 py-0.5"><option value="">Any</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select></label>
          </div>
        )}
        {rule.trigger === 'followup_completed' && (
          <label>Type:<select value={rule.when?.followupTypeEquals || ''} onChange={e => onChange({ ...rule, when: { ...rule.when, followupTypeEquals: e.target.value } })} className="text-xs border rounded px-1 py-0.5"><option value="">Any</option><option value="call">Call</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></label>
        )}
        <div className="border-t pt-2 mt-2">
          <div className="flex items-center gap-2 text-teal-700 font-medium mb-2"><ChevronRight size={14} /> THEN DO</div>
          <ActionEditor action={rule.action} onChange={a => onChange({ ...rule, action: a })} />
          {rule.subsequentActions?.map((a, i) => (
            <div key={i} className="ml-4 mt-2 border-l-2 border-teal-200 pl-3">
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1"><ArrowDown size={12} /> Step {i + 2}</div>
              <ActionEditor action={a} onChange={na => updateSubAction(i, na)} />
              <button onClick={() => removeSubAction(i)} className="text-red-500 text-[10px] mt-1 hover:underline">Remove step</button>
            </div>
          ))}
          <button onClick={addSubAction} className="mt-2 flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-800"><Plus size={12} /> Add next step</button>
        </div>
      </div>
    </div>
  );
}

function ActionEditor({ action, onChange }: { action: Action; onChange: (a: Action) => void }) {
  return (
    <div className="flex flex-wrap gap-2 items-start">
      <select value={action.type} onChange={e => onChange({ ...action, type: e.target.value as ActionType })} className="text-xs border rounded px-1 py-0.5">
        {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      {action.type === 'create_followup' && (
        <>
          <select value={action.followupType || 'call'} onChange={e => onChange({ ...action, followupType: e.target.value })} className="text-xs border rounded px-1 py-0.5"><option value="call">Call</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select>
          <label>in <input type="number" value={action.daysFromNow || 1} onChange={e => onChange({ ...action, daysFromNow: Number(e.target.value) || 1 })} className="border rounded px-1 py-0.5 w-12 text-xs" /> days</label>
          <input value={action.notes || ''} onChange={e => onChange({ ...action, notes: e.target.value })} placeholder="Notes..." className="border rounded px-1 py-0.5 text-xs w-32" />
        </>
      )}
      {action.type === 'assign_inquiry' && (
        <input value={action.assignTo || ''} onChange={e => onChange({ ...action, assignTo: e.target.value })} placeholder="Email or __creator__" className="border rounded px-1 py-0.5 text-xs w-40" />
      )}
      {action.type === 'add_tags' && (
        <input value={(action.tags || []).join(', ')} onChange={e => onChange({ ...action, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="tag1, tag2" className="border rounded px-1 py-0.5 text-xs w-40" />
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/proxy/marketing-settings/automation').then(r => r.json()).then(d => {
      if (d.success) {
        setEnabled(d.automation?.enabled ?? false);
        const raw = d.automation?.rules || [];
        setRules(raw.map((r: any, i: number) => ({ ...r, order: r.order ?? i + 1 })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const ordered = rules.map((r, i) => ({ ...r, order: i + 1 }));
    const cfg = { enabled, rules: ordered, log: [] };
    await fetch('/api/proxy/marketing-settings/automation', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cfg, log: [] }),
    });
    setRules(ordered);
    setSaving(false);
  };

  const addRule = () => {
    const newRule: Rule = { id: `rule-${Date.now()}`, enabled: true, order: rules.length + 1, trigger: 'inquiry_created', action: { type: 'create_followup', followupType: 'call', daysFromNow: 2 } };
    setRules([...rules, newRule]);
  };

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workflow Automations</h1>
          <p className="text-sm text-gray-500 mt-1">Visual automation rules — run in numbered order</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            {enabled ? <><Play size={14} className="text-green-600" /> Active</> : <><Pause size={14} className="text-gray-400" /> Paused</>}
          </label>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-teal-600 text-white text-sm rounded font-medium hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Rules'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <FlowCard key={rule.id} rule={rule} index={i} onChange={r => { const arr = [...rules]; arr[i] = r; setRules(arr); }} onDelete={() => setRules(rules.filter((_, idx) => idx !== i))} />
        ))}
      </div>

      <button onClick={addRule} className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-teal-400 hover:text-teal-600 rounded text-sm w-full justify-center">
        <Plus size={16} /> Add Automation Rule
      </button>

      <div className="bg-gray-50 border rounded p-3 text-xs text-gray-500">
        <strong className="text-gray-700">How it works:</strong> Rules run in numbered order when events trigger. Each rule can have multiple actions (steps). Only the first matching rule executes per trigger type unless multi-step is configured.
      </div>
    </div>
  );
}
