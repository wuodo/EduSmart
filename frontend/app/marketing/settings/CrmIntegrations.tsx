'use client'

import { useCallback, useEffect, useState } from 'react'
import { WEB_API } from '@/utils/api'

function userHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/)
    const c = m ? decodeURIComponent(m[1]) : ''
    if (c) return { 'x-tenant': c }
  } catch {
    /* ignore */
  }
  const tenant = localStorage.getItem('tenant') || ''
  return tenant ? { 'x-tenant': tenant } : {}
}

function readRole(): string {
  try {
    const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
    const r = m ? decodeURIComponent(m[1]) : localStorage.getItem('userRole') || ''
    return String(r).toLowerCase()
  } catch {
    return ''
  }
}

type WhRow = { id: string; url: string; secret: string; events: string; active: boolean }

const emptyWh = (): WhRow => ({
  id: `wh-${Date.now()}`,
  url: '',
  secret: '',
  events: 'inquiry.created',
  active: true,
})

export default function CrmIntegrations() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [roundRobin, setRoundRobin] = useState('')
  const [retention, setRetention] = useState('')
  const [rows, setRows] = useState<WhRow[]>([emptyWh()])
  const [googleCal, setGoogleCal] = useState(false)
  const [msCal, setMsCal] = useState(false)
  const [integrationsSnap, setIntegrationsSnap] = useState<Record<string, unknown>>({})
  const [scheduled, setScheduled] = useState<Array<{ id: string; label: string; lastRunAt?: string; nextRunAt?: string; status?: string }>>([])
  const [canEdit, setCanEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = readRole()
      setCanEdit(r === 'admin' || r === 'senior_staff')
      const res = await fetch(`${WEB_API}/tenants/me/crm`, { credentials: 'include', headers: userHeaders() })
      const data = await res.json().catch(() => ({}))
      const crm = data?.crm || {}
      setRoundRobin((crm.roundRobinEmails || []).join('\n'))
      setRetention(crm.dataRetentionDays != null ? String(crm.dataRetentionDays) : '')
      const whs = Array.isArray(crm.webhooks) ? crm.webhooks : []
      if (whs.length === 0) {
        setRows([emptyWh()])
      } else {
        setRows(
          whs.map((w: any) => ({
            id: String(w.id || `wh-${Math.random()}`),
            url: String(w.url || ''),
            secret: String(w.secret || ''),
            events: Array.isArray(w.events) ? w.events.join(', ') : '',
            active: w.active !== false,
          })),
        )
      }
      const integ = crm.integrations && typeof crm.integrations === 'object' ? crm.integrations : {}
      setIntegrationsSnap(integ as Record<string, unknown>)
      setGoogleCal(!!(integ as { googleCalendar?: { enabled?: boolean } }).googleCalendar?.enabled)
      setMsCal(!!(integ as { microsoftCalendar?: { enabled?: boolean } }).microsoftCalendar?.enabled)
      setScheduled(Array.isArray(crm.scheduledJobsMeta) ? crm.scheduledJobsMeta : [])
    } catch {
      setMessage({ type: 'err', text: 'Failed to load CRM settings.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!canEdit) return
    setSaving(true)
    setMessage(null)
    try {
      const roundRobinEmails = roundRobin
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const dataRetentionDays = retention.trim() === '' ? undefined : Math.max(0, parseInt(retention, 10))
      const webhooks = rows
        .filter((r) => r.url.trim())
        .map((r) => ({
          id: r.id,
          url: r.url.trim(),
          secret: r.secret.trim() || 'changeme',
          events: r.events
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          active: r.active,
        }))
      const gc = integrationsSnap.googleCalendar && typeof integrationsSnap.googleCalendar === 'object'
        ? { ...(integrationsSnap.googleCalendar as object), enabled: googleCal }
        : { enabled: googleCal }
      const mc = integrationsSnap.microsoftCalendar && typeof integrationsSnap.microsoftCalendar === 'object'
        ? { ...(integrationsSnap.microsoftCalendar as object), enabled: msCal }
        : { enabled: msCal }
      const res = await fetch(`${WEB_API}/tenants/me/crm`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({
          roundRobinEmails,
          dataRetentionDays: Number.isFinite(dataRetentionDays as number) ? dataRetentionDays : undefined,
          webhooks,
          integrations: {
            ...integrationsSnap,
            googleCalendar: gc,
            microsoftCalendar: mc,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'err', text: data?.message || 'Save failed.' })
        return
      }
      setMessage({ type: 'ok', text: 'CRM settings saved.' })
      const crm = data?.crm || {}
      setScheduled(Array.isArray(crm.scheduledJobsMeta) ? crm.scheduledJobsMeta : [])
    } catch {
      setMessage({ type: 'err', text: 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  const exportData = async () => {
    if (!canEdit) return
    try {
      const res = await fetch(`${WEB_API}/inquiries/export/data`, {
        credentials: 'include',
        headers: userHeaders(),
      })
      if (!res.ok) {
        setMessage({ type: 'err', text: 'Export failed (check permissions).' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inquiries-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setMessage({ type: 'err', text: 'Export failed.' })
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading CRM settings…</p>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">CRM integrations</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Webhooks, round-robin assignment for new inquiries, and export. Calendar toggles are placeholders for future OAuth
          connections.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Round-robin assignees</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          One staff email per line. New inquiries rotate through this list when no assignee is set.
        </p>
        <textarea
          value={roundRobin}
          onChange={(e) => setRoundRobin(e.target.value)}
          disabled={!canEdit}
          rows={5}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm p-2 font-mono disabled:opacity-60"
          placeholder="admissions@school.edu&#10;recruit@school.edu"
        />
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Outbound webhooks</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Signed POST payloads for events such as <code className="text-xs">inquiry.created</code>. Store the secret server-side;
          it is shown here for setup only.
        </p>
        <div className="space-y-4">
          {rows.map((row, idx) => (
            <div key={row.id} className="rounded-md border border-gray-100 dark:border-gray-800 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Webhook {idx + 1}</span>
                {canEdit && rows.length > 1 && (
                  <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}>
                    Remove
                  </button>
                )}
              </div>
              <input
                type="url"
                value={row.url}
                onChange={(e) => setRows((r) => r.map((x) => (x.id === row.id ? { ...x, url: e.target.value } : x)))}
                disabled={!canEdit}
                placeholder="https://example.com/hooks/edusmart"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 py-1.5 disabled:opacity-60"
              />
              <input
                type="password"
                value={row.secret}
                onChange={(e) => setRows((r) => r.map((x) => (x.id === row.id ? { ...x, secret: e.target.value } : x)))}
                disabled={!canEdit}
                placeholder="Signing secret"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 py-1.5 disabled:opacity-60"
              />
              <input
                value={row.events}
                onChange={(e) => setRows((r) => r.map((x) => (x.id === row.id ? { ...x, events: e.target.value } : x)))}
                disabled={!canEdit}
                placeholder="inquiry.created, inquiry.updated"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 py-1.5 disabled:opacity-60"
              />
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(e) => setRows((r) => r.map((x) => (x.id === row.id ? { ...x, active: e.target.checked } : x)))}
                  disabled={!canEdit}
                />
                Active
              </label>
            </div>
          ))}
        </div>
        {canEdit && (
          <button
            type="button"
            className="text-sm text-teal-700 dark:text-teal-300 font-medium hover:underline"
            onClick={() => setRows((r) => [...r, emptyWh()])}
          >
            + Add webhook
          </button>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Data retention (policy)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Suggested retention window in days for exports and future purge jobs.</p>
        <input
          type="number"
          min={0}
          value={retention}
          onChange={(e) => setRetention(e.target.value)}
          disabled={!canEdit}
          className="w-40 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm px-2 py-1.5 disabled:opacity-60"
          placeholder="e.g. 730"
        />
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Calendar (placeholders)</h3>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={googleCal} onChange={(e) => setGoogleCal(e.target.checked)} disabled={!canEdit} />
          Google Calendar
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={msCal} onChange={(e) => setMsCal(e.target.checked)} disabled={!canEdit} />
          Microsoft Calendar
        </label>
      </section>

      {scheduled.length > 0 && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Scheduled jobs (last run)</h3>
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="py-1 pr-3">Label</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Last run</th>
                <th className="py-1">Next run</th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map((j) => (
                <tr key={j.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 pr-3">{j.label}</td>
                  <td className="py-1.5 pr-3">{j.status || '—'}</td>
                  <td className="py-1.5 pr-3">{j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : '—'}</td>
                  <td className="py-1.5">{j.nextRunAt ? new Date(j.nextRunAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tenant data export</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Download inquiries JSON (admin / senior staff).</p>
        <button
          type="button"
          onClick={exportData}
          disabled={!canEdit}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          Download inquiries export
        </button>
      </section>

      {canEdit ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save CRM settings'}
          </button>
          <button type="button" onClick={load} className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm">
            Reload
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Only administrators and senior staff can change these settings.</p>
      )}
    </div>
  )
}
