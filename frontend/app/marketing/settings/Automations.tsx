'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, HelpCircle } from 'lucide-react'

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

const INPUT =
  'mt-1 w-full border rounded px-2 py-1.5 text-[13px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'

const TIP = {
  master:
    'When on, the server runs your rules after new inquiries (including bulk import), when an inquiry status changes, or when a follow-up is marked completed.',
  ruleOn: 'Turn this rule off to keep it saved but never run.',
  trigger:
    'Pick the moment the system should check this rule. Example: "Inquiry created" runs when someone adds a new lead.',
  statusListNew:
    'Optional. If you list statuses (comma-separated), the rule only runs for new inquiries whose status is one of these. Leave empty to ignore status.',
  sourceEquals:
    'Optional. If filled, the rule only runs when the lead source matches this text (e.g. whatsapp). Leave empty to ignore source.',
  fromStatus:
    'Optional. For status-change rules: only run if the old status matched this (e.g. warm). Leave empty for any previous status.',
  toStatus:
    'Optional. For status-change rules: only run if the new status matches this (e.g. hot). Leave empty for any new status.',
  statusListAfter:
    'Optional. After a status change, require the new status to be one of these values. Comma-separated.',
  sourceChanged: 'Optional. Also require the inquiry source to equal this value.',
  fuType: 'Optional. Only run when the completed follow-up was this type. Pick "Any" to run for all types.',
  statusListFu: 'Optional. When the follow-up completes, the inquiry status must be one of these.',
  actionType:
    'What happens when the rule matches: schedule a follow-up, assign the inquiry to someone, or add tags to the lead.',
  fuActionType: 'Channel for the new task (call, WhatsApp, etc.).',
  days: 'How many days from today the follow-up due date should be.',
  notes: 'Text stored on the new follow-up so staff see why it was created.',
  assignTo:
    'Staff email, or __creator__ (person who created the inquiry), or __assignee__ (current assignee). The server resolves these when the rule runs.',
  tags: 'Comma-separated labels added to the inquiry; existing tags are kept.',
} as const

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

function rulePlainEnglish(r: Rule): string {
  const when = describeWhen(r.trigger, r.when)
  let act = ''
  if (r.action.type === 'create_followup') {
    act = `Then create a ${r.action.followupType} follow-up due in ${r.action.daysFromNow} day(s).`
  } else if (r.action.type === 'assign_inquiry') {
    const who =
      r.action.assignTo === '__creator__'
        ? 'the person who created the inquiry'
        : r.action.assignTo === '__assignee__'
          ? 'the current assignee'
          : r.action.assignTo
    act = `Then assign the inquiry to ${who}.`
  } else {
    act =
      r.action.tags.length > 0
        ? `Then add tags: ${r.action.tags.join(', ')}.`
        : 'Then add tags (none configured yet).'
  }
  return `${when} ${act}`
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
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

function LabelTip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" title={tip}>
      <span>{children}</span>
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
    </span>
  )
}

export default function Automations() {
  const [enabled, setEnabled] = useState(false)
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES)
  const [activeRuleIdx, setActiveRuleIdx] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const r = rules[activeRuleIdx]

  useEffect(() => {
    if (activeRuleIdx >= rules.length) setActiveRuleIdx(Math.max(0, rules.length - 1))
  }, [rules.length, activeRuleIdx])

  useEffect(() => {
    setLoading(true)
    fetch('/api/marketing/settings/automation', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
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
        prev.map((rule) => {
          if (rule.id !== id) return rule
          const { replaceWhen, when: whenPatch, ...rulePatch } = patch
          const next: Rule = { ...rule, ...rulePatch }
          if (replaceWhen) next.when = { ...(whenPatch || {}) }
          else if (whenPatch !== undefined) next.when = { ...rule.when, ...whenPatch }
          if (patch.action) {
            next.action =
              patch.action.type === rule.action.type
                ? ({ ...rule.action, ...patch.action } as AutomationAction)
                : (patch.action as AutomationAction)
          }
          return next
        }),
      )
    },
    [],
  )

  const setActionType = useCallback((id: string, t: AutomationAction['type']) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, action: defaultActionForType(t) } : rule)))
  }, [])

  const addRule = useCallback(() => {
    const id = `rule-${Date.now()}`
    setRules((prev) => {
      const next = [
        ...prev,
        {
          id,
          enabled: true,
          trigger: 'inquiry_created' as const,
          when: {},
          action: defaultActionForType('create_followup'),
        },
      ]
      setActiveRuleIdx(next.length - 1)
      return next
    })
  }, [])

  const removeRule = useCallback((id: string) => {
    setRules((prev) => {
      if (prev.length <= 1) return prev
      const idx = prev.findIndex((x) => x.id === id)
      if (idx < 0) return prev
      const next = prev.filter((x) => x.id !== id)
      setActiveRuleIdx((i) => {
        if (i === idx) return Math.max(0, idx - 1)
        if (i > idx) return i - 1
        return i
      })
      return next
    })
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

  if (loading) return <div className="text-gray-600 dark:text-gray-400">Loading...</div>

  if (!r) return null

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 px-1">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Automations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Automatic actions when inquiries are created or updated, or when follow-ups are completed. Runs on the server; results appear in the log below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Add rule
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="p-3 rounded border border-green-300 bg-green-50 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200 text-sm">
          Saved.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap" title={TIP.master}>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Run automations</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              New inquiry, bulk import, status change, or follow-up completed.
            </p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 px-2 pt-2">
          <div className="flex overflow-x-auto gap-1 pb-0" role="tablist" aria-label="Automation rules">
            {rules.map((rule, i) => {
              const active = i === activeRuleIdx
              return (
                <button
                  key={rule.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={rulePlainEnglish(rule)}
                  onClick={() => setActiveRuleIdx(i)}
                  className={`shrink-0 px-3 py-2 text-left text-[13px] border border-b-0 rounded-t transition-colors min-w-[7.5rem] max-w-[11rem] ${
                    active
                      ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-teal-800 dark:text-teal-300 font-semibold border-b-white dark:border-b-gray-900 -mb-px z-10'
                      : 'bg-transparent border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/80'
                  }`}
                >
                  <span className="block truncate">Rule {i + 1}</span>
                  <span className="block text-[11px] font-mono text-gray-500 truncate">{rule.id}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800" role="tabpanel">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <p className="text-[13px] text-gray-600 dark:text-gray-400 max-w-3xl" title={rulePlainEnglish(r)}>
              {rulePlainEnglish(r)}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">
                <LabelTip tip={TIP.ruleOn}>Enabled</LabelTip>
              </span>
              <Toggle checked={r.enabled} onChange={(v) => patchRule(r.id, { enabled: v })} />
              <button
                type="button"
                onClick={() => removeRule(r.id)}
                disabled={rules.length <= 1}
                className="p-2 rounded border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-rose-600 hover:border-rose-300 disabled:opacity-30"
                title="Remove this rule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {r.enabled && (
            <div className="space-y-4 text-[13px]">
              <label className="block max-w-md" title={TIP.trigger}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  <LabelTip tip={TIP.trigger}>Trigger</LabelTip>
                </span>
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
                  className={INPUT}
                >
                  {(Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map((t) => (
                    <option key={t} value={t}>
                      {TRIGGER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>

              {r.trigger === 'inquiry_created' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block" title={TIP.statusListNew}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.statusListNew}>Match status (comma-separated)</LabelTip>
                    </span>
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
                      className={INPUT}
                    />
                  </label>
                  <label className="block" title={TIP.sourceEquals}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.sourceEquals}>Or match source</LabelTip>
                    </span>
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
                      className={INPUT}
                    />
                  </label>
                </div>
              )}

              {r.trigger === 'inquiry_status_changed' && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <label className="block" title={TIP.fromStatus}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.fromStatus}>From status (optional)</LabelTip>
                    </span>
                    <input
                      value={r.when?.fromStatus || ''}
                      onChange={(e) =>
                        patchRule(r.id, {
                          when: { ...r.when, fromStatus: e.target.value.trim() || undefined },
                        })
                      }
                      className={INPUT}
                    />
                  </label>
                  <label className="block" title={TIP.toStatus}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.toStatus}>To status (optional)</LabelTip>
                    </span>
                    <input
                      value={r.when?.toStatus || ''}
                      onChange={(e) =>
                        patchRule(r.id, {
                          when: { ...r.when, toStatus: e.target.value.trim() || undefined },
                        })
                      }
                      className={INPUT}
                    />
                  </label>
                  <label className="block sm:col-span-2 lg:col-span-3" title={TIP.statusListAfter}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.statusListAfter}>New status in list (optional)</LabelTip>
                    </span>
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
                      className={INPUT}
                    />
                  </label>
                  <label className="block sm:col-span-2 lg:col-span-3" title={TIP.sourceChanged}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.sourceChanged}>And source equals (optional)</LabelTip>
                    </span>
                    <input
                      value={r.when?.sourceEquals || ''}
                      onChange={(e) =>
                        patchRule(r.id, {
                          when: { ...r.when, sourceEquals: e.target.value.trim() || undefined },
                        })
                      }
                      className={INPUT}
                    />
                  </label>
                </div>
              )}

              {r.trigger === 'followup_completed' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block" title={TIP.fuType}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.fuType}>Follow-up type (optional)</LabelTip>
                    </span>
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
                      className={INPUT}
                    >
                      <option value="">Any type</option>
                      {['call', 'whatsapp', 'sms', 'email'].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block" title={TIP.statusListFu}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.statusListFu}>Inquiry status in list (optional)</LabelTip>
                    </span>
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
                      className={INPUT}
                    />
                  </label>
                </div>
              )}

              <label className="block max-w-md" title={TIP.actionType}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  <LabelTip tip={TIP.actionType}>Action</LabelTip>
                </span>
                <select
                  value={r.action.type}
                  onChange={(e) => setActionType(r.id, e.target.value as AutomationAction['type'])}
                  className={INPUT}
                >
                  <option value="create_followup">Create follow-up</option>
                  <option value="assign_inquiry">Assign inquiry</option>
                  <option value="add_tags">Add tags</option>
                </select>
              </label>

              {r.action.type === 'create_followup' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block" title={TIP.fuActionType}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.fuActionType}>Follow-up type</LabelTip>
                    </span>
                    <select
                      value={r.action.type === 'create_followup' ? r.action.followupType : 'call'}
                      onChange={(e) => {
                        if (r.action.type !== 'create_followup') return
                        patchRule(r.id, { action: { ...r.action, followupType: e.target.value } })
                      }}
                      className={INPUT}
                    >
                      {['call', 'whatsapp', 'sms', 'email'].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block" title={TIP.days}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.days}>Due in (days)</LabelTip>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={r.action.type === 'create_followup' ? r.action.daysFromNow : 2}
                      onChange={(e) => {
                        if (r.action.type !== 'create_followup') return
                        patchRule(r.id, { action: { ...r.action, daysFromNow: Number(e.target.value) } })
                      }}
                      className={INPUT}
                    />
                  </label>
                  <label className="block sm:col-span-2" title={TIP.notes}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                      <LabelTip tip={TIP.notes}>Notes</LabelTip>
                    </span>
                    <input
                      value={r.action.type === 'create_followup' ? r.action.notes || '' : ''}
                      onChange={(e) => {
                        if (r.action.type !== 'create_followup') return
                        patchRule(r.id, { action: { ...r.action, notes: e.target.value } })
                      }}
                      className={INPUT}
                    />
                  </label>
                </div>
              )}

              {r.action.type === 'assign_inquiry' && (
                <label className="block max-w-lg" title={TIP.assignTo}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                    <LabelTip tip={TIP.assignTo}>Assign to</LabelTip>
                  </span>
                  <input
                    value={r.action.type === 'assign_inquiry' ? r.action.assignTo : ''}
                    onChange={(e) => {
                      if (r.action.type !== 'assign_inquiry') return
                      patchRule(r.id, { action: { ...r.action, assignTo: e.target.value } })
                    }}
                    placeholder="__creator__, __assignee__, or staff@email"
                    className={INPUT}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Use <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">__creator__</code> or{' '}
                    <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">__assignee__</code> or an email.
                  </p>
                </label>
              )}

              {r.action.type === 'add_tags' && (
                <label className="block max-w-lg" title={TIP.tags}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                    <LabelTip tip={TIP.tags}>Tags (comma-separated)</LabelTip>
                  </span>
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
                    className={INPUT}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent runs (last 100)</h3>
          <button
            type="button"
            onClick={clearLog}
            disabled={saving || log.length === 0}
            className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
          >
            Clear log
          </button>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="min-w-full text-[13px]">
            <thead className="bg-gray-50/80 dark:bg-gray-800 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  Time
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  Rule
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  Inquiry
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  Action
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-gray-500 text-center">
                    No runs yet. Enable automations and create or update records.
                  </td>
                </tr>
              ) : (
                log.map((e, i) => (
                  <tr
                    key={`${e.ts}-${i}`}
                    className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/70'}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{e.ruleId}</td>
                    <td className="px-3 py-2">{e.inquiryId}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{e.action}</td>
                    <td className="px-3 py-2">
                      <span className={e.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                        {e.ok ? 'OK' : 'Failed'}
                      </span>
                      {e.message && <span className="block text-gray-500 truncate max-w-xs">{e.message}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
