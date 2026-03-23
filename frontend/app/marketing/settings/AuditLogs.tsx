'use client'

import { useEffect, useMemo, useState } from 'react'

type AuditLog = {
  id: string
  timestamp: number
  action: string
  module: string
  user?: string
  ip?: string
  details?: any
}

const API_URL = '/api/marketing/settings/audit-logs'

function getUserHeaders() {
  return {};
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return '-'
  }
}

function Badge({ children, color = 'blue' }: { children: any, color?: 'blue' | 'gray' | 'green' | 'amber' | 'red' }) {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  }
  return <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${map[color]}`}>{children}</span>
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [user, setUser] = useState('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (action.trim()) params.set('action', action.trim())
    if (user.trim()) params.set('user', user.trim())
    if (from) params.set('from', String(new Date(from).getTime()))
    if (to) params.set('to', String(new Date(to).getTime()))
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    
    try {
      const headers = getUserHeaders()
      const res = await fetch(`${API_URL}?${params.toString()}`, { 
        cache: 'no-store',
        headers
      })
      if (!res.ok) {
        setToast({ type: 'error', message: 'Failed to load audit logs.' })
        setLogs([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setLogs(data.items || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    fetchLogs()
  }

  const clearFilters = async () => {
    setQuery('')
    setAction('')
    setUser('')
    setFrom('')
    setTo('')
    setOffset(0)
    fetchLogs()
  }

  const exportCsv = () => {
    const header = ['Timestamp', 'Action', 'Module', 'User', 'IP', 'Details']
    const rows = logs.map(l => [
      new Date(l.timestamp).toISOString(),
      l.action,
      l.module,
      l.user || '',
      l.ip || '',
      JSON.stringify(l.details || {})
    ])
    const csv = [header, ...rows].map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `audit-logs-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])
  const currentPage = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit])

  const now = Date.now()
  const last24hCount = useMemo(
    () => logs.filter(l => now - l.timestamp <= 24 * 60 * 60 * 1000).length,
    [logs, now]
  )
  const distinctUsers = useMemo(
    () => Array.from(new Set(logs.map(l => l.user).filter(Boolean))).length,
    [logs]
  )

  const applyQuickRange = (days: number) => {
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    setFrom(start.toISOString().slice(0, 10))
    setTo(new Date().toISOString().slice(0, 10))
    setOffset(0)
    fetchLogs()
  }

  const filterSecuritySensitive = () => {
    setQuery('')
    setUser('')
    setFrom('')
    setTo('')
    setAction('')
    setOffset(0)
    setQuery('cpanel_ restore_tenant delete_request login_failed')
    fetchLogs()
  }

  const moduleBadgeColor = (module: string): 'blue' | 'gray' | 'green' | 'amber' | 'red' => {
    const m = module.toLowerCase()
    if (m === 'auth') return 'green'
    if (m === 'cpanel' || m === 'delete_requests' || m === 'settings') return 'amber'
    if (m.includes('backup') || m.includes('tenant')) return 'red'
    return 'gray'
  }

  const actionBadgeColor = (action: string): 'blue' | 'gray' | 'green' | 'amber' | 'red' => {
    const a = action.toLowerCase()
    if (a.includes('failed')) return 'red'
    if (a.includes('login') || a.includes('logout')) return 'green'
    if (a.includes('delete') || a.includes('restore')) return 'amber'
    return 'blue'
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-md px-4 py-2 text-sm border ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Audit & Logs</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Track sensitive admin activity across the system. Use filters to investigate changes and export evidence when needed.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
          <div><span className="font-semibold">{total}</span> records loaded (first {logs.length})</div>
          <div className="flex gap-3">
            <span>Last 24h: <span className="font-semibold">{last24hCount}</span></span>
            <span>Active admins: <span className="font-semibold">{distinctUsers}</span></span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={onSearch} className="space-y-3 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-gray-600 dark:text-gray-300 font-medium">Quick filters</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => applyQuickRange(1)}
            >
              Today
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => applyQuickRange(7)}
            >
              Last 7 days
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-full border border-amber-300 text-amber-800 dark:border-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30"
              onClick={filterSecuritySensitive}
            >
              Security‑sensitive actions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          value={action}
          onChange={e => setAction(e.target.value)}
          placeholder="Action (e.g., update_settings)"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          value={user}
          onChange={e => setUser(e.target.value)}
          placeholder="User email"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <div className="flex gap-2 md:col-span-6 justify-end">
          <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90">Apply</button>
          <button type="button" onClick={exportCsv} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Export CSV</button>
          <button type="button" onClick={clearFilters} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Clear Filters</button>
        </div>
        </div>
      </form>

      {/* Scrollable table section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="min-w-full text-[13px]">
            <thead className="sticky top-0 bg-gray-50/80 dark:bg-gray-700 text-gray-700 dark:text-gray-200 z-10">
              <tr>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Time</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Action</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Module</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">User</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">IP</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-teal-800 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-[13px] text-center text-gray-500 dark:text-gray-400">Loading...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-[13px] text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-base">No audit logs yet</div>
                      <div className="text-xs">Actions you take across the app will appear here.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((l, idx) => (
                  <tr key={l.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/70'} hover:bg-gray-100 dark:hover:bg-gray-700/60`}>
                    <td className="px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDate(l.timestamp)}</td>
                    <td className="px-3 py-2 text-[13px]"><Badge color={actionBadgeColor(l.action)}>{l.action}</Badge></td>
                    <td className="px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200"><Badge color={moduleBadgeColor(l.module)}>{l.module}</Badge></td>
                    <td className="px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200">{l.user || '-'}</td>
                    <td className="px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200">{l.ip || '-'}</td>
                    <td className="px-3 py-2 text-[13px]">
                      <details>
                        <summary className="cursor-pointer text-gray-700 dark:text-gray-300">View</summary>
                        <pre className="mt-2 max-w-xl whitespace-pre-wrap break-words text-xs text-gray-600 dark:text-gray-300">{JSON.stringify(l.details, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setOffset(0); }} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Prev</button>
          <button onClick={() => setOffset(Math.min((totalPages - 1) * limit, offset + limit))} disabled={currentPage >= totalPages} className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  )
} 