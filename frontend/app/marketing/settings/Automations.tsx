'use client'

import { useCallback, useEffect, useState } from 'react'
import { Workflow, Play, ScrollText, Plus, Trash2 } from 'lucide-react'

type AutomationTrigger = 'inquiry_created' | 'inquiry_status_changed' | 'followup_completed'

type When = {
  statusIn?: string[]
  sourceEquals?: string
  fromStatus?: string
  toStatus?: string
  followupTypeEquals?: string
}

type AutomationAction =
  | { type: 'create_followup'; followupType: string; daysFromNow: number; notes?: string }
  | { type: 'assign_inquiry'; assignTo: string }
  | { type: 'add_tags'; tags: string[] }

type Rule = {
  id: string
  enabled: boolean
  trigger: AutomationTrigger
  when?: When
  action: AutomationAction
}

type LogEntry = { ts: string; ruleId: string; inquiryId: number; action: string; ok: boolean; message?: string }

const DEFAULT_RULES: Rule[] = [
  {
    id: 'hot-followup',
    enabled: true,
    trigger: 'inquiry_created',
    when: { statusIn: ['hot'] },
    action: { type: 'create_followup', followupType: 'call', daysFromNow: 2, notes: 'Automatic reminder: contact hot lead' },
  },
  {
    id: 'whatsapp-source',
    enabled: false,
    trigger: 'inquiry_created',
    when: { sourceEquals: 'whatsapp' },
    action: { type: 'create_followup', followupType: 'whatsapp', daysFromNow: 1, notes: 'Automatic reminder: WhatsApp source' },
  },
  {
    id: 'warm-to-hot-tags',
    enabled: false,
    trigger: 'inquiry_status_changed',
    when: { fromStatus: 'warm', toStatus: 'hot' },
    action: { type: 'add_tags', tags: ['priority-follow-up'] },
  },
  {
    id: 'call-done-next',
    enabled: false,
    trigger: 'followup_completed',
    when: { followupTypeEquals: 'call' },
    action: { type: 'create_followup', followupType: 'whatsapp', daysFromNow: 3, notes: 'Automatic: follow up after completed call' },
  },
]

const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  inquiry_created: 'Inquiry created',
  inquiry_status_changed: 'Inquiry status changed',
  followup_completed: 'Follow-up marked completed',
}

function defaultActionForType(t: AutomationAction['type']): AutomationAction {
  if (t === 'assign_inquiry') return { type: 'assign_inquiry', assignTo: '__creator__' }
  if (t === 'add_tags') return { type: 'add_tags', tags: [] }
  return { type: 'create_followup', followupType: 'call', daysFromNow: 2, notes: '' }
}

function normalizeLoadedRules(raw: unknown): Rule[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_RULES
  return raw.map((r: any) => {
    const trigger: AutomationTrigger =
      r?.trigger === 'inquiry_status_changed' ||
      r?.trigger === 'followup_completed' ||
      r?.trigger === 'inquiry_created'
        ? r.trigger
        : 'inquiry_created'
    let action: AutomationAction = defaultActionForType('create_followup')
    const a = r?.action
    if (a?.type === 'create_followup') {
      action = {
        type: 'create_followup',
        followupType: String(a.followupType || 'call'),
        daysFromNow: Math.max(0, Number(a.daysFromNow) || 1),
        notes: a.notes != null ? String(a.notes) : '',
      }
    } else if (a?.type === 'assign_inquiry') {
      action = { type: 'assign_inquiry', assignTo: String(a.assignTo || '__creator__') }
    } else if (a?.type === 'add_tags') {
      action = { type: 'add_tags', tags: Array.isArray(a.tags) ? a.tags.map(String) : [] }
    }
    return {
      id: String(r.id || `rule-${Math.random().toString(36).slice(2)}`),
      enabled: !!r.enabled,
      trigger,
      when: r.when && typeof r.when === 'object' ? { ...r.when } : {},
      action,
    }
  })
}

function statusInDisplay(w?: When) {
  return Array.isArray(w?.statusIn) ? w.statusIn.join(', ') : ''
}

function tagsDisplay(a: AutomationAction) {
  if (a.type === 'add_tags') return a.tags.join(', ')
  return ''
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? 'bg-teal-600' : 'bg-gray-300'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

export default function Automations() {
  const [enabled, setEnabled] = useState(false)
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES)
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/marketing/settings/automation', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const a = d?.automation
        if (a) {
          setEnabled(!!a.enabled)
          setRules(normalizeLoadedRules(a.rules))
          setLog(Array.isArray(a.log) ? a.log : [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const patchRule = useCallback(
    (id: string, patch: Partial<Rule> & { when?: Partial<When>; replaceWhen?: boolean }) => {
      setRules((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          const { replaceWhen, when: whenPatch, ...rulePatch } = patch
          const next: Rule = { ...r, ...rulePatch }
          if (replaceWhen) next.when = { ...(whenPatch || {}) }
          else if (whenPatch !== undefined) next.when = { ...r.when, ...whenPatch }
          if (patch.action) {
            next.action =
              patch.action.type === r.action.type
                ? ({ ...r.action, ...patch.action } as AutomationAction)
                : (patch.action as AutomationAction)
          }
          return next
        }),
      )
    },
    [],
  )

  const setActionType = useCallback((id: string, t: AutomationAction['type']) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, action: defaultActionForType(t) } : r)))
  }, [])

  const addRule = useCallback(() => {
    const id = `rule-${Date.now()}`
    setRules((prev) => [
      ...prev,
      {
        id,
        enabled: true,
        trigger: 'inquiry_created',
        when: {},
        action: defaultActionForType('create_followup'),
      },
    ])
  }, [])

  const removeRule = useCallback((id: string) => {
    setRules((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }, [])

  const persist = async (payload: { enabled: boolean; rules: Rule[]; log: LogEntry[] }) => {
    const res = await fetch('/api/marketing/settings/automation', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automation: payload }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as any)?.error || 'Save failed')
    }
    const data = await res.json()
    if (data?.automation?.log) setLog(data.automation.log)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await persist({ enabled, rules, log })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const clearLog = async () => {
    setSaving(true)
    setError('')
    try {
      setLog([])
      await persist({ enabled, rules, log: [] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px] text-gray-600 dark:text-gray-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full min-w-0">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Workflow className="h-7 w-7 text-primary" />
          Automations
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Server-side rules when inquiries are created or updated, or when a follow-up is completed. Includes schedule follow-up,
          assign owner, and add tags. Runs are logged below.
        </p>
      </div>

      {error && (
        <div className="text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {saved && <div className="text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">Saved.</div>}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Play className="h-6 w-6 text-teal-600" />
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">Run automations</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Applies on inquiry create (and bulk import), inquiry status change, and follow-up completed.
            </p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Add rule
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((r) => (
          <section
            key={r.id}
            className={`rounded-xl border overflow-hidden ${r.enabled ? 'border-teal-200 dark:border-teal-800' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800/80`}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{r.id}</span>
                  <button
                    type="button"
                    onClick={() => removeRule(r.id)}
                    disabled={rules.length <= 1}
                    className="text-gray-400 hover:text-rose-600 disabled:opacity-30"
                    title="Remove rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <label className="block mt-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Trigger</span>
                  <select
                    value={r.trigger}
                    onChange={(e) => {
                      const trigger = e.target.value as AutomationTrigger
                      patchRule(r.id, {
                        trigger,
                        when: {},
                        replaceWhen: true,
                        action: defaultActionForType('create_followup'),
                      })
                    }}
                    className="mt-1 w-full max-w-md border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                  >
                    {(Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map((t) => (
                      <option key={t} value={t}>
                        {TRIGGER_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-gray-500 mt-2">{describeWhen(r.trigger, r.when)}</p>
              </div>
              <Toggle checked={r.enabled} onChange={(v) => patchRule(r.id, { enabled: v })} />
            </div>

            {r.enabled && (
              <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 text-sm space-y-3">
                {r.trigger === 'inquiry_created' && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block sm:col-span-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Match status (comma-separated)</span>
                      <input
                        value={statusInDisplay(r.when)}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          patchRule(r.id, {
                            when: {
                              statusIn: raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                              sourceEquals: r.when?.sourceEquals,
                            },
                          })
                        }}
                        placeholder="e.g. hot, warm"
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Or match source</span>
                      <input
                        value={r.when?.sourceEquals || ''}
                        onChange={(e) =>
                          patchRule(r.id, {
                            when: {
                              statusIn: r.when?.statusIn,
                              sourceEquals: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        placeholder="e.g. whatsapp"
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                  </div>
                )}

                {r.trigger === 'inquiry_status_changed' && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">From status (optional)</span>
                      <input
                        value={r.when?.fromStatus || ''}
                        onChange={(e) =>
                          patchRule(r.id, {
                            when: {
                              ...r.when,
                              fromStatus: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">To status (optional)</span>
                      <input
                        value={r.when?.toStatus || ''}
                        onChange={(e) =>
                          patchRule(r.id, {
                            when: {
                              ...r.when,
                              toStatus: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                    <label className="block sm:col-span-3 md:col-span-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">New status in list (optional)</span>
                      <input
                        value={statusInDisplay(r.when)}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          patchRule(r.id, {
                            when: {
                              ...r.when,
                              statusIn: raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                            },
                          })
                        }}
                        placeholder="hot, enrolled"
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                    <label className="block sm:col-span-3">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">And source equals (optional)</span>
                      <input
                        value={r.when?.sourceEquals || ''}
                        onChange={(e) =>
                          patchRule(r.id, {
                            when: {
                              ...r.when,
                              sourceEquals: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                  </div>
                )}

                {r.trigger === 'followup_completed' && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Follow-up type (optional filter)</span>
                      <select
                        value={r.when?.followupTypeEquals || ''}
                        onChange={(e) =>
                          patchRule(r.id, {
                            when: {
                              ...r.when,
                              followupTypeEquals: e.target.value.trim() || undefined,
                            },
                          })
                        }
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      >
                        <option value="">Any type</option>
                        {['call', 'whatsapp', 'sms', 'email'].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Inquiry status in list (optional)</span>
                      <input
                        value={statusInDisplay(r.when)}
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          patchRule(r.id, {
                            when: {
                              ...r.when,
                              statusIn: raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                            },
                          })
                        }}
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Action</span>
                  <select
                    value={r.action.type}
                    onChange={(e) => setActionType(r.id, e.target.value as AutomationAction['type'])}
                    className="mt-1 w-full max-w-md border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                  >
                    <option value="create_followup">Create follow-up</option>
                    <option value="assign_inquiry">Assign inquiry</option>
                    <option value="add_tags">Add tags</option>
                  </select>
                </label>

                {r.action.type === 'create_followup' && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Follow-up type</span>
                      <select
                        value={r.action.type === 'create_followup' ? r.action.followupType : 'call'}
                        onChange={(e) => {
                          if (r.action.type !== 'create_followup') return
                          patchRule(r.id, {
                            action: { ...r.action, followupType: e.target.value },
                          })
                        }}
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      >
                        {['call', 'whatsapp', 'sms', 'email'].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Due in (days)</span>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={r.action.type === 'create_followup' ? r.action.daysFromNow : 2}
                        onChange={(e) => {
                          if (r.action.type !== 'create_followup') return
                          patchRule(r.id, {
                            action: { ...r.action, daysFromNow: Number(e.target.value) },
                          })
                        }}
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Notes</span>
                      <input
                        value={r.action.type === 'create_followup' ? r.action.notes || '' : ''}
                        onChange={(e) => {
                          if (r.action.type !== 'create_followup') return
                          patchRule(r.id, { action: { ...r.action, notes: e.target.value } })
                        }}
                        className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                      />
                    </label>
                  </div>
                )}

                {r.action.type === 'assign_inquiry' && (
                  <label className="block max-w-lg">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Assign to</span>
                    <input
                      value={r.action.type === 'assign_inquiry' ? r.action.assignTo : ''}
                      onChange={(e) => {
                        if (r.action.type !== 'assign_inquiry') return
                        patchRule(r.id, { action: { ...r.action, assignTo: e.target.value } })
                      }}
                      placeholder="__creator__, __assignee__, or staff@email"
                      className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                    />
                    <span className="text-[11px] text-gray-500 mt-1 block">
                      Use <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">__creator__</code> for inquiry creator,{' '}
                      <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">__assignee__</code> for current assignee, or a staff email.
                    </span>
                  </label>
                )}

                {r.action.type === 'add_tags' && (
                  <label className="block max-w-lg">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Tags (comma-separated)</span>
                    <input
                      value={tagsDisplay(r.action)}
                      onChange={(e) => {
                        const tags = e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                        patchRule(r.id, { action: { type: 'add_tags', tags } })
                      }}
                      placeholder="vip, callback"
                      className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                    />
                  </label>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-5 py-2 rounded-lg text-white font-semibold bg-primary disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save automations'}
      </button>

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-gray-500" />
            <span className="font-semibold text-gray-900 dark:text-white">Recent runs (last 100)</span>
          </div>
          <button
            type="button"
            onClick={clearLog}
            disabled={saving || log.length === 0}
            className="text-sm px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-40"
          >
            Clear log
          </button>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="text-left p-2 font-semibold">Time</th>
                <th className="text-left p-2 font-semibold">Rule</th>
                <th className="text-left p-2 font-semibold">Inquiry</th>
                <th className="text-left p-2 font-semibold">Action</th>
                <th className="text-left p-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-gray-500 text-center">
                    No runs yet. Enable automations and create or update records.
                  </td>
                </tr>
              ) : (
                log.map((e, i) => (
                  <tr key={`${e.ts}-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-2 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                    <td className="p-2 font-mono">{e.ruleId}</td>
                    <td className="p-2">{e.inquiryId}</td>
                    <td className="p-2 font-mono">{e.action}</td>
                    <td className="p-2">
                      <span className={e.ok ? 'text-emerald-700' : 'text-rose-700'}>{e.ok ? 'OK' : 'Failed'}</span>
                      {e.message && <span className="block text-gray-500 truncate max-w-xs">{e.message}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function describeWhen(trigger: AutomationTrigger, w?: When) {
  if (trigger === 'inquiry_created') {
    if (w?.statusIn?.length) return `Runs when new inquiry status is one of: ${w.statusIn.join(', ')}`
    if (w?.sourceEquals) return `Runs when source is: ${w.sourceEquals}`
    return 'Runs for every new inquiry'
  }
  if (trigger === 'inquiry_status_changed') {
    const parts: string[] = ['Runs when inquiry status changes']
    if (w?.fromStatus) parts.push(`from ${w.fromStatus}`)
    if (w?.toStatus) parts.push(`to ${w.toStatus}`)
    if (w?.statusIn?.length) parts.push(`(new status in: ${w.statusIn.join(', ')})`)
    if (w?.sourceEquals) parts.push(`and source is ${w.sourceEquals}`)
    return parts.join(' ')
  }
  if (trigger === 'followup_completed') {
    if (w?.followupTypeEquals) return `Runs when a ${w.followupTypeEquals} follow-up is marked completed`
    return 'Runs when any follow-up is marked completed'
  }
  return ''
}
