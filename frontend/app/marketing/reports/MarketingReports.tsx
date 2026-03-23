'use client'

import { useState, useEffect } from 'react'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { useRouter } from 'next/navigation'
// @ts-ignore
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { Bar, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

interface ReportFilters {
  dateRange: DateRange | undefined
  status: string
  source: string
}

type ReportPreset = {
  id: string
  name: string
  createdAt: string
  owner: string
  status: string
  source: string
  from?: string
  to?: string
}

export default function MarketingReports() {
  const router = useRouter()
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: undefined,
    status: 'all',
    source: 'all'
  })

  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [owner, setOwner] = useState<string>('')
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [ownersLoading, setOwnersLoading] = useState(false)
  const [ownersError, setOwnersError] = useState<string | null>(null)
  const selectedOwnerLabel = owners.find(o => o.value === owner)?.label || ''

  const [presets, setPresets] = useState<ReportPreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')

  // Check if user is admin and fetch users for owner filter
  useEffect(() => {
    const userRoleRaw = localStorage.getItem('userRole') || ''
    const role = userRoleRaw.toLowerCase()
    const adminLike = role === 'admin' || role === 'senior_staff'
    setIsAdmin(adminLike)
    if (adminLike) {
      setOwnersLoading(true)
      setOwnersError(null)
      fetch('/api/proxy/users', { headers: getUserHeaders() })
        .then(async res => {
          try {
            const data = await res.json()
            let users: any[] = []
            if (Array.isArray(data)) {
              users = data
            } else if (data && Array.isArray(data.users)) {
              users = data.users
            }
            if (users.length > 0) {
              const ownerOptions = users.map((user: any) => ({
                label: user.name || user.email,
                value: user.email
              }))
              setOwners(ownerOptions)
            } else {
              setOwnersError('Failed to load users')
            }
          } catch {
            setOwnersError('Failed to load users')
          }
        })
        .catch(() => setOwnersError('Failed to load users'))
        .finally(() => setOwnersLoading(false))
    }
    
    // Fetch initial report for all users
    fetchReport()
  }, [])

  // Load presets from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('marketingReportPresets')
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        setPresets(parsed)
      }
    } catch {
      setPresets([])
    }
  }, [])

  // Refresh report when owner changes (for admins) or filters change
  useEffect(() => {
    fetchReport()
  }, [owner, filters])

  // Helper function to get user headers
  function getUserHeaders() {
    if (typeof window === 'undefined') return {} as any;
    const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
    return { ...(tenant ? { 'x-tenant': tenant } : {}) } as Record<string, string>;
  }

  async function fetchReport() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.dateRange?.from) {
        params.append('from', format(filters.dateRange.from, 'yyyy-MM-dd'))
      }
      if (filters.dateRange?.to) {
        params.append('to', format(filters.dateRange.to, 'yyyy-MM-dd'))
      }
      params.append('status', filters.status)
      params.append('source', filters.source)
      if (owner) {
        params.append('owner', owner)
      }
      const res = await fetch(`/api/marketing/reports?${params.toString()}`, {
        headers: getUserHeaders()
      })
      const data = await res.json()
      setReport(data)
      // Fallback: if admin and no owners loaded from backend, derive from report.users when viewing All Users
      if (isAdmin && !owner && owners.length === 0 && data && Array.isArray(data.users) && data.users.length > 0) {
        const derived = data.users.map((u: any) => ({ label: u.owner, value: u.owner }))
        setOwners(derived)
        setOwnersError(null)
      }
    } catch (err) {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  // Sanitize a string for use in filenames
  function sanitizeFilename(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/gi, '')
  }

  const charts = report?.charts || {}
  const inquiriesBySource = charts?.inquiriesBySource || {}
  const topPrograms = charts?.topPrograms || []
  const followupsByType = charts?.followupsByType || []
  const followupsByStatus = charts?.followupsByStatus || []
  const inquiriesOverTime = charts?.inquiriesOverTime || []

  const kpi = report?.summary || {}
  const conversionRate = Number(kpi.conversionRate || 0)
  const responseRatePct = Number(kpi.responseRatePct || 0)
  const lettersSentRatePct = Number(kpi.lettersSentRatePct || 0)
  const overdueFollowups = Number(kpi.overdueFollowups || 0)

  function clampPct(v: number) {
    if (!isFinite(v)) return 0
    return Math.max(0, Math.min(100, Math.round(v)))
  }

  const GaugeCard = ({ title, valuePct, subtitle }: { title: string; valuePct: number; subtitle?: string }) => {
    const pct = clampPct(valuePct)
    return (
      <Card className="p-4 bg-white ring-1 ring-gray-200">
        <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">{title}</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="w-[84px] h-[84px]">
            <Pie
              data={{
                labels: ['Done', 'Remaining'],
                datasets: [
                  {
                    data: [pct, 100 - pct],
                    backgroundColor: ['#16a34a', '#e5e7eb'],
                    borderWidth: 0,
                  },
                ],
              }}
              options={{
                cutout: '72%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                maintainAspectRatio: false,
              }}
            />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{pct}%</div>
            {subtitle ? <div className="text-[12px] text-gray-600">{subtitle}</div> : null}
          </div>
        </div>
      </Card>
    )
  }

  const handleDownload = async (reportFormat: 'pdf' | 'excel') => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.dateRange?.from) {
        params.append('from', format(filters.dateRange.from, 'yyyy-MM-dd'))
      }
      if (filters.dateRange?.to) {
        params.append('to', format(filters.dateRange.to, 'yyyy-MM-dd'))
      }
      params.append('status', filters.status)
      params.append('source', filters.source)
      if (owner) {
        params.append('owner', owner)
        if (selectedOwnerLabel) {
          params.append('ownerLabel', selectedOwnerLabel)
        }
      }
      const response = await fetch(`/api/marketing/reports?${params.toString()}&format=${reportFormat}`, {
        headers: getUserHeaders()
      })
      if (!response.ok) {
        throw new Error('Failed to generate report')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const scope = owner && selectedOwnerLabel ? sanitizeFilename(selectedOwnerLabel) : 'all-users'
      link.download = `marketing-report-${scope}-${format(new Date(), 'yyyy-MM-dd')}.${reportFormat === 'pdf' ? 'pdf' : 'xlsx'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading report:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!report && loading) return <div className="p-8 text-lg">Loading report...</div>
  if (!report) return <div className="p-8 text-lg text-rose-600">Failed to load report.</div>

  // Replace the abbreviate function with the registration module's abbreviateProgram logic
  function abbreviateProgram(name: string) {
    const ignore = ['in', 'of', 'and', 'for', 'to', 'the', 'with', 'on', 'at', 'by'];
    return name
      .split(' ')
      .filter(word => word && !ignore.includes(word.toLowerCase()))
      .map(word => word[0].toUpperCase())
      .join('');
  }

  function persistPresets(next: ReportPreset[]) {
    setPresets(next)
    try {
      localStorage.setItem('marketingReportPresets', JSON.stringify(next))
    } catch {}
  }

  function savePreset() {
    const name = presetName.trim()
    if (!name) {
      alert('Please enter a preset name.')
      return
    }
    const from = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : undefined
    const to = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : undefined
    const next: ReportPreset = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      createdAt: new Date().toISOString(),
      owner,
      status: filters.status,
      source: filters.source,
      from,
      to,
    }
    const merged = [next, ...presets].slice(0, 12)
    persistPresets(merged)
    setPresetName('')
    setSelectedPresetId(next.id)
  }

  function applyPreset(p: ReportPreset) {
    setOwner(p.owner || '')
    setFilters({
      status: p.status || 'all',
      source: p.source || 'all',
      dateRange: (p.from || p.to)
        ? {
            from: p.from ? new Date(p.from) : undefined,
            to: p.to ? new Date(p.to) : undefined,
          }
        : undefined,
    })
  }

  function deletePreset(id: string) {
    const next = presets.filter(p => p.id !== id)
    persistPresets(next)
    if (selectedPresetId === id) setSelectedPresetId('')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
          <div className="text-[12px] text-gray-600">
            {owner ? `Scope: ${selectedOwnerLabel || owner}` : 'Scope: All Users'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => router.push(owner ? `/inquiries?owner=${encodeURIComponent(owner)}` : '/inquiries')}
            className="bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
          >
            Open Inquiries
          </Button>
          <Button
            onClick={() => router.push(owner ? `/followups?owner=${encodeURIComponent(owner)}` : '/followups')}
            className="bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
          >
            Open Follow-ups
          </Button>
          <Button onClick={() => handleDownload('pdf')} disabled={loading} className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            PDF
          </Button>
          <Button onClick={() => handleDownload('excel')} disabled={loading} className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </Button>
        </div>
      </div>

      <Card className="p-4 ring-1 ring-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <DateRangePicker
              value={filters.dateRange}
              onChange={(range) => setFilters(prev => ({ ...prev, dateRange: range }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source
            </label>
            <select
              value={filters.source}
              onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
            >
              <option value="all">All Sources</option>
              <option value="website">Website</option>
              <option value="social">Social Media</option>
              <option value="referral">Referral</option>
              <option value="walk-in">Walk-in</option>
              <option value="other">Other</option>
            </select>
          </div>
          {isAdmin ? (
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner
            </label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2 bg-yellow-50 border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
            >
              <option value="">All Users</option>
              {ownersLoading && <option value="" disabled>Loading users...</option>}
              {owners.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {ownersError && (
              <p className="text-[12px] text-rose-600 mt-1">{ownersError}</p>
            )}
          </div>
          ) : (
            <div className="hidden md:block" />
          )}
        </div>

        {/* Presets */}
        <div className="mt-3 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Presets</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedPresetId(id)
                  const p = presets.find(x => x.id === id)
                  if (p) applyPreset(p)
                }}
                className="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              >
                <option value="">Load preset…</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name (e.g. This week - All users)"
                className="w-full px-3 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
              />
              <Button onClick={savePreset} className="whitespace-nowrap">Save</Button>
            </div>
            {selectedPresetId ? (
              <div className="mt-2 flex items-center gap-2 text-[12px] text-gray-600">
                <span>Selected: <span className="font-semibold text-gray-800">{presets.find(p => p.id === selectedPresetId)?.name || ''}</span></span>
                <button
                  className="text-rose-700 hover:text-rose-800 font-semibold"
                  onClick={() => deletePreset(selectedPresetId)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Card className="lg:col-span-7 p-4 ring-1 ring-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">Activity (last 30 days)</div>
            <div className="text-[12px] text-gray-600">Inquiries vs Registrations</div>
          </div>
          <div className="h-[240px]">
            <Bar
              data={{
                labels: inquiriesOverTime.map((d: any) => String(d.date).slice(5)),
                datasets: [
                  { label: 'Inquiries', data: inquiriesOverTime.map((d: any) => d.inquiries), backgroundColor: '#3b82f6', barThickness: 10 },
                  { label: 'Registrations', data: inquiriesOverTime.map((d: any) => d.registrations), backgroundColor: '#22c55e', barThickness: 10 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' as const } },
                scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { grid: { color: '#e5e7eb' } } }
              }}
            />
          </div>
        </Card>

        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GaugeCard title="Conversion" valuePct={conversionRate} subtitle={`${kpi.totalPaidRegistrations || 0} paid / ${kpi.totalInquiries || 0} inquiries`} />
          <GaugeCard title="Response rate" valuePct={responseRatePct} subtitle={`Avg response: ${kpi.avgResponseTimeHrs || 0}h`} />
          <GaugeCard title="Letters sent" valuePct={lettersSentRatePct} subtitle={`${kpi.lettersSentCount || 0} sent/ack`} />
          <Card className="p-4 bg-white ring-1 ring-gray-200">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">Overdue follow-ups</div>
            <div className="mt-2 text-3xl font-bold text-amber-700">{overdueFollowups}</div>
            <div className="text-[12px] text-gray-600 mt-1">Pending follow-ups past due date</div>
          </Card>

          {/* Extra KPI cards */}
          <Card className="p-4 bg-white ring-1 ring-gray-200">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">Total inquiries</div>
            <div className="mt-2 text-3xl font-bold text-sky-700">{Number(kpi.totalInquiries || 0)}</div>
            <div className="text-[12px] text-gray-600 mt-1">All captured leads</div>
          </Card>
          <Card className="p-4 bg-white ring-1 ring-gray-200">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">Total follow-ups</div>
            <div className="mt-2 text-3xl font-bold text-indigo-700">{Number(kpi.totalFollowups || 0)}</div>
            <div className="text-[12px] text-gray-600 mt-1">Actions logged</div>
          </Card>
          <Card className="p-4 bg-white ring-1 ring-gray-200">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">Paid registrations</div>
            <div className="mt-2 text-3xl font-bold text-emerald-700">{Number(kpi.totalPaidRegistrations || 0)}</div>
            <div className="text-[12px] text-gray-600 mt-1">Converted to paid</div>
          </Card>
          <Card className="p-4 bg-white ring-1 ring-gray-200">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600">Avg response time</div>
            <div className="mt-2 text-3xl font-bold text-fuchsia-700">{Number(kpi.avgResponseTimeHrs || 0)}h</div>
            <div className="text-[12px] text-gray-600 mt-1">From inquiry to first response</div>
          </Card>
        </div>

        <Card className="lg:col-span-4 p-4 ring-1 ring-gray-200">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 mb-2">Inquiry sources</div>
          <div className="h-[220px]">
            <Pie
              data={{
                labels: Object.keys(inquiriesBySource),
                datasets: [{ data: Object.values(inquiriesBySource) as any, backgroundColor: ['#2563eb', '#22c55e', '#f59e42', '#a3a3a3', '#f43f5e'] }],
              }}
              options={{ plugins: { legend: { position: 'bottom' as const } }, maintainAspectRatio: false }}
            />
          </div>
        </Card>

        <Card className="lg:col-span-4 p-4 ring-1 ring-gray-200">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 mb-2">Top programs</div>
          <div className="h-[220px]">
            <Bar
              data={{
                labels: (topPrograms || []).map((p: any) => abbreviateProgram(p[0] || '')),
                datasets: [{ label: 'Inquiries', data: (topPrograms || []).map((p: any) => p[1] || 0), backgroundColor: '#f59e42', barThickness: 18 }],
              }}
              options={{ plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { color: '#e5e7eb' } } } }}
            />
          </div>
        </Card>

        <Card className="lg:col-span-4 p-4 ring-1 ring-gray-200">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 mb-2">Follow-ups</div>
          <div className="grid grid-cols-1 gap-2">
            <div className="h-[105px]">
              <Bar
                data={{
                  labels: (followupsByType || []).map((f: any) => f.type || ''),
                  datasets: [{ label: 'By type', data: (followupsByType || []).map((f: any) => f.count || 0), backgroundColor: '#2563eb', barThickness: 14 }],
                }}
                options={{ plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { color: '#e5e7eb' } } } }}
              />
            </div>
            <div className="h-[105px]">
              <Bar
                data={{
                  labels: (followupsByStatus || []).map((f: any) => f.status || ''),
                  datasets: [{ label: 'By status', data: (followupsByStatus || []).map((f: any) => f.count || 0), backgroundColor: '#a3a3a3', barThickness: 14 }],
                }}
                options={{ plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { color: '#e5e7eb' } } } }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Per-Officer + Insights on one line (desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {(!owner && report.users && report.users.length > 0) ? (
          <Card className="p-6 ring-1 ring-gray-200 lg:col-span-8">
            <h2 className="text-xl font-semibold mb-2">Per-Officer Performance Index</h2>
            <p className="text-sm text-gray-600 mb-4">Index is normalized to 0–100. Higher index reflects stronger performance, weighted by registrations, follow-ups, and inquiries.</p>
            <div className="w-full h-80 px-2">
              <Bar
                id="per-officer-performance-chart"
                data={{
                  labels: report.users.map((u: any) => u.owner),
                  datasets: [
                    {
                      label: 'Performance Index',
                      data: report.users.map((u: any) => u.performanceIndex),
                      backgroundColor: '#16a34a',
                      barThickness: 28,
                    },
                  ],
                }}
                options={{
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx: any) => `${ctx.parsed.y}%`,
                        afterLabel: (ctx: any) => {
                          const u = report.users[ctx.dataIndex]
                          return [`Registrations: ${u.registrations}`, `Follow-ups: ${u.followups}`, `Inquiries: ${u.inquiries}`]
                        },
                      },
                    },
                  },
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      suggestedMin: 0,
                      suggestedMax: 100,
                      ticks: { callback: (v: any) => `${v}%` },
                      grid: { color: '#e5e7eb' },
                    },
                    x: {
                      ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 11 },
                      },
                      grid: { display: false },
                    },
                  },
                }}
              />
            </div>
            <div className="mt-4 text-sm text-gray-700">
              {(() => {
                const top = [...report.users].sort((a: any, b: any) => b.performanceIndex - a.performanceIndex)[0]
                return top ? (
                  <span>
                    Top performer: <span className="font-semibold">{top.owner}</span> with an index of <span className="font-semibold">{top.performanceIndex}%</span> (Regs: {top.registrations}, F/ups: {top.followups}, Inqs: {top.inquiries}).
                  </span>
                ) : null
              })()}
            </div>
          </Card>
        ) : null}

        <Card className={`p-4 ring-1 ring-gray-200 ${(!owner && report.users && report.users.length > 0) ? 'lg:col-span-4' : 'lg:col-span-12'}`}>
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 mb-2">Insights</div>
          {report.executiveSummary ? <div className="text-[13px] text-gray-800">{report.executiveSummary}</div> : null}
          {(report.recommendations || []).length ? (
            <ul className="mt-2 list-disc pl-5 text-[13px] text-gray-700 space-y-1">
              {(report.recommendations || []).slice(0, 6).map((r: string, idx: number) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </div>
  )
} 