'use client'

import { useCallback, useEffect, useState } from 'react'
import { Workflow, Play, ScrollText } from 'lucide-react'

type Rule = {
  id: string
  enabled: boolean
  trigger: 'inquiry_created'
  when?: { statusIn?: string[]; sourceEquals?: string }
  action: { type: 'create_followup'; followupType: string; daysFromNow: number; notes?: string }
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
]

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
          setRules(Array.isArray(a.rules) && a.rules.length ? a.rules : DEFAULT_RULES)
          setLog(Array.isArray(a.log) ? a.log : [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const patchRule = useCallback((id: string, patch: Partial<Rule>) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next: Rule = { ...r, ...patch }
        if (patch.action) next.action = { ...r.action, ...patch.action }
        return next
      }),
    )
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/marketing/settings/automation', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation: { enabled, rules, log } }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as any)?.error || 'Save failed')
      }
      const data = await res.json()
      if (data?.automation?.log) setLog(data.automation.log)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
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
          When a new inquiry is created, run rules server-side (e.g. schedule a follow-up). Actions are logged below.
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
            <div className="font-semibold text-gray-900 dark:text-white">Run automations on new inquiries</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Applies to single creates and CSV bulk import.</p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </section>

      <div className="space-y-3">
        {rules.map((r) => (
          <section
            key={r.id}
            className={`rounded-xl border overflow-hidden ${r.enabled ? 'border-teal-200 dark:border-teal-800' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800/80`}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-mono text-xs text-gray-400">{r.id}</div>
                <div className="font-semibold text-gray-900 dark:text-white mt-0.5">Trigger: inquiry created</div>
                <p className="text-xs text-gray-500 mt-1">
                  {r.when?.statusIn?.length
                    ? `If status is one of: ${r.when.statusIn.join(', ')}`
                    : r.when?.sourceEquals
                      ? `If source is: ${r.when.sourceEquals}`
                      : 'If any inquiry'}
                </p>
              </div>
              <Toggle
                checked={r.enabled}
                onChange={(v) => patchRule(r.id, { enabled: v })}
              />
            </div>
            {r.enabled && (
              <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 text-sm grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Follow-up type</span>
                  <select
                    value={r.action.followupType}
                    onChange={(e) => patchRule(r.id, { action: { ...r.action, followupType: e.target.value } })}
                    className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                  >
                    {['call', 'whatsapp', 'sms', 'email'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Due in (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={r.action.daysFromNow}
                    onChange={(e) => patchRule(r.id, { action: { ...r.action, daysFromNow: Number(e.target.value) } })}
                    className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Notes (appended to follow-up)</span>
                  <input
                    value={r.action.notes || ''}
                    onChange={(e) => patchRule(r.id, { action: { ...r.action, notes: e.target.value } })}
                    className="mt-1 w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-600"
                  />
                </label>
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
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-gray-500" />
          <span className="font-semibold text-gray-900 dark:text-white">Recent runs (last 100)</span>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="text-left p-2 font-semibold">Time</th>
                <th className="text-left p-2 font-semibold">Rule</th>
                <th className="text-left p-2 font-semibold">Inquiry</th>
                <th className="text-left p-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-gray-500 text-center">No runs yet. Enable automations and create an inquiry.</td></tr>
              ) : (
                log.map((e, i) => (
                  <tr key={`${e.ts}-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-2 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                    <td className="p-2 font-mono">{e.ruleId}</td>
                    <td className="p-2">{e.inquiryId}</td>
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
