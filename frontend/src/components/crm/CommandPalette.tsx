'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WEB_API } from '@/utils/api'
import {
  MagnifyingGlassIcon,
  HomeIcon,
  UserGroupIcon,
  PhoneIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  AcademicCapIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  BoltIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const MagnifyingGlassIconAny: any = MagnifyingGlassIcon
const HomeIconAny: any = HomeIcon
const UserGroupIconAny: any = UserGroupIcon
const PhoneIconAny: any = PhoneIcon
const DocumentTextIconAny: any = DocumentTextIcon
const ChartBarIconAny: any = ChartBarIcon
const Cog6ToothIconAny: any = Cog6ToothIcon
const AcademicCapIconAny: any = AcademicCapIcon
const CalendarIconAny: any = CalendarIcon
const ClipboardDocumentListIconAny: any = ClipboardDocumentListIcon
const BoltIconAny: any = BoltIcon
const SparklesIconAny: any = SparklesIcon

function userHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const tenant = localStorage.getItem('tenant') || ''
  try {
    const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/)
    const c = m ? decodeURIComponent(m[1]) : ''
    if (c) return { 'x-tenant': c }
  } catch { /* ignore */ }
  return tenant ? { 'x-tenant': tenant } : {}
}

type NavItem = { id: string; label: string; href: string; icon: any; keywords: string }

const NAV: NavItem[] = [
  { id: 'dash', label: 'Dashboard', href: '/dashboard', icon: HomeIconAny, keywords: 'home overview kpi' },
  { id: 'inq', label: 'Inquiries', href: '/inquiries', icon: UserGroupIconAny, keywords: 'leads prospects' },
  { id: 'fu', label: 'Follow-ups', href: '/followups', icon: PhoneIconAny, keywords: 'calls tasks queue' },
  { id: 'cal', label: 'Calendar', href: '/calendar', icon: CalendarIconAny, keywords: 'events schedule' },
  { id: 'letters', label: 'Admission letters', href: '/admission-letters', icon: DocumentTextIconAny, keywords: 'pdf offer' },
  { id: 'reg', label: 'Registrations', href: '/registrations', icon: ClipboardDocumentListIconAny, keywords: 'enrol' },
  { id: 'courses', label: 'Courses', href: '/courses', icon: AcademicCapIconAny, keywords: 'programs' },
  { id: 'rep', label: 'Reports', href: '/reports', icon: ChartBarIconAny, keywords: 'export csv' },
  { id: 'an', label: 'Analytics', href: '/analytics', icon: ChartBarIconAny, keywords: 'charts' },
  {
    id: 'set',
    label: 'Marketing settings',
    href: '/settings',
    icon: Cog6ToothIconAny,
    keywords: 'admin configuration users permissions branding integrations marketing cpanel',
  },
  {
    id: 'auto',
    label: 'Automations',
    href: '/settings?section=auto',
    icon: BoltIconAny,
    keywords: 'automation rules workflow triggers follow-up inquiry status',
  },
  {
    id: 'smartfeat',
    label: 'Smart Features',
    href: '/settings?section=smart',
    icon: SparklesIconAny,
    keywords: 'smart features lead scoring duplicate detection dormant sla reminders capacity',
  },
]

type InquiryRow = {
  id: number
  fullName: string
  phone: string
  email?: string
  programOfInterest?: string
  status?: string
  createdAt?: string
}

export function openCommandPalette() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('edusmart:open-command-palette'))
  }
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<InquiryRow[]>([])
  const cacheRef = useRef<{ t: number; data: InquiryRow[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const loadInquiries = useCallback(async () => {
    const now = Date.now()
    if (cacheRef.current && now - cacheRef.current.t < 45_000) {
      setRows(cacheRef.current.data)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${WEB_API}/inquiries?limit=200&page=1`, {
        credentials: 'include',
        cache: 'no-store',
        headers: userHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      const mapped: InquiryRow[] = list.map((r: any) => ({
        id: r.id,
        fullName: r.fullName || '',
        phone: r.phone || '',
        email: r.email,
        programOfInterest: r.programOfInterest,
        status: r.status,
        createdAt: r.createdAt,
      }))
      cacheRef.current = { t: now, data: mapped }
      setRows(mapped)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const openEv = () => setOpen(true)
    window.addEventListener('keydown', down)
    window.addEventListener('edusmart:open-command-palette', openEv)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('edusmart:open-command-palette', openEv)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setQ('')
      setActive(0)
      return
    }
    loadInquiries()
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open, loadInquiries])

  const ql = q.trim().toLowerCase()

  const navMatches = useMemo(() => {
    if (!ql) return NAV
    return NAV.filter(
      (n) =>
        n.label.toLowerCase().includes(ql) ||
        n.keywords.includes(ql) ||
        n.id.includes(ql),
    )
  }, [ql])

  const inquiryMatches = useMemo(() => {
    if (!ql || ql.length < 2) return []
    return rows
      .filter((r) => {
        const blob = [r.fullName, r.phone, r.email, r.programOfInterest, r.status].filter(Boolean).join(' ').toLowerCase()
        return blob.includes(ql)
      })
      .slice(0, 8)
  }, [ql, rows])

  /** Simple NL-style answers from cached rows */
  const statAnswer = useMemo(() => {
    if (!ql || rows.length === 0) return null
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    if (/(hot.*lead|leads.*hot|how many hot)/i.test(q)) {
      const n = rows.filter((r) => String(r.status || '').toLowerCase() === 'hot').length
      return `Hot leads in your current workspace sample: ${n} (up to 200 recent inquiries loaded).`
    }
    if (/(lead|inquir).*(this week|week)/i.test(q) || /week.*inquir/i.test(q)) {
      const n = rows.filter((r) => new Date(r.createdAt || 0).getTime() >= weekAgo).length
      return `New inquiries in the last 7 days (in loaded sample): ${n}.`
    }
    if (/overdue|late follow/i.test(q)) {
      return 'Open Follow-ups and sort by due date, or check the Dashboard "Overdue" KPI.'
    }
    return null
  }, [ql, q, rows])

  const items = useMemo(() => {
    const out: Array<{ type: 'nav' | 'inq' | 'stat'; key: string; label: string; sub?: string; href?: string }> = []
    if (statAnswer) {
      out.push({ type: 'stat', key: 'stat', label: statAnswer, sub: 'Insight' })
    }
    navMatches.forEach((n) => out.push({ type: 'nav', key: n.id, label: n.label, href: n.href }))
    inquiryMatches.forEach((r) =>
      out.push({
        type: 'inq',
        key: `inq-${r.id}`,
        label: r.fullName,
        sub: `${r.phone} · ${r.programOfInterest || ''} · ${r.status || ''}`.trim(),
        href: `/inquiries?openInquiry=${r.id}${ql ? `&q=${encodeURIComponent(ql)}` : ''}`,
      }),
    )
    return out
  }, [statAnswer, navMatches, inquiryMatches])

  useEffect(() => {
    setActive(0)
  }, [q])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, items.length])

  const run = (idx: number) => {
    const it = items[idx]
    if (!it) return
    if (it.type === 'stat') return
    if (it.href) {
      router.push(it.href)
      setOpen(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(0, items.length - 1)))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      run(active)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/45"
      role="dialog"
      aria-modal
      aria-label="Command palette"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <MagnifyingGlassIconAny className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, inquiries, or ask a quick question…"
            className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-white outline-none py-2"
          />
          {loading && <span className="text-[10px] text-gray-400">Loading…</span>}
          <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">No matches. Try a name, phone, or module name.</div>
          )}
          {items.map((it, idx) => (
            <button
              key={it.key}
              type="button"
              data-idx={idx}
              onClick={() => run(idx)}
              disabled={it.type === 'stat'}
              className={`w-full text-left px-3 py-2.5 flex flex-col gap-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                idx === active ? 'bg-teal-50 dark:bg-teal-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/80'
              } ${it.type === 'stat' ? 'cursor-default opacity-95' : ''}`}
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{it.label}</span>
              {it.sub && <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{it.sub}</span>}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 text-[10px] text-gray-500 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <span>↑↓ select · Enter open</span>
          <span>Ctrl/⌘ K to toggle</span>
        </div>
      </div>
    </div>
  )
}

export function CommandPaletteTriggerButton() {
  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      className="hidden md:inline-flex items-center gap-1.5 text-white/90 hover:text-white text-[11px] font-medium px-2 py-1 rounded border border-white/25 hover:bg-white/10"
      title="Search and jump (Ctrl+K)"
    >
      <MagnifyingGlassIconAny className="h-4 w-4 opacity-90" />
      <span>Search</span>
      <kbd className="ml-1 px-1 py-0.5 rounded bg-white/15 text-[9px] font-sans">⌘K</kbd>
    </button>
  )
}
