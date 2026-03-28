import type { LeadTag } from '@/types/inquiry'

/** Serializable inquiry list filter state (matches Inquiries page). */
export type InquiryFilterSnapshot = {
  status: string
  source: string
  search: string
  county: string
  program: string
  kcseGrade: string
  intake: string
  gender: string
  paymentStatus: string
  tags: LeadTag[]
  owner: string
}

export type SavedInquiryView = {
  id: string
  name: string
  createdAt: string
  filters: InquiryFilterSnapshot
}

const MAX_VIEWS = 30

function storageKey(): string {
  if (typeof window === 'undefined') return ''
  const email = (localStorage.getItem('userEmail') || localStorage.getItem('userName') || 'anon').toLowerCase().trim()
  let tenant = ''
  try {
    const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/)
    tenant = m ? decodeURIComponent(m[1]) : ''
  } catch {
    /* ignore */
  }
  if (!tenant) tenant = localStorage.getItem('tenant') || 'default'
  return `edusmart.inquirySavedViews.v1:${tenant}:${email}`
}

function normalizeTags(raw: unknown): LeadTag[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(['hot', 'warm', 'cold', 'scholarship-seeker', 'graduate'])
  return raw.filter((t): t is LeadTag => typeof t === 'string' && allowed.has(t))
}

function normalizeSnapshot(raw: unknown): InquiryFilterSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    status: typeof o.status === 'string' ? o.status : '',
    source: typeof o.source === 'string' ? o.source : '',
    search: typeof o.search === 'string' ? o.search : '',
    county: typeof o.county === 'string' ? o.county : '',
    program: typeof o.program === 'string' ? o.program : '',
    kcseGrade: typeof o.kcseGrade === 'string' ? o.kcseGrade : '',
    intake: typeof o.intake === 'string' ? o.intake : '',
    gender: typeof o.gender === 'string' ? o.gender : '',
    paymentStatus: typeof o.paymentStatus === 'string' ? o.paymentStatus : '',
    tags: normalizeTags(o.tags),
    owner: typeof o.owner === 'string' ? o.owner : '',
  }
}

export function loadSavedViews(): SavedInquiryView[] {
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: SavedInquiryView[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const id = typeof r.id === 'string' ? r.id : ''
      const name = typeof r.name === 'string' ? r.name : ''
      const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
      const filters = normalizeSnapshot(r.filters)
      if (!id || !name || !filters) continue
      out.push({ id, name, createdAt, filters })
    }
    return out
  } catch {
    return []
  }
}

export function persistSavedViews(views: SavedInquiryView[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(), JSON.stringify(views.slice(0, MAX_VIEWS)))
}

/** Replace existing view with the same name (case-insensitive). */
export function saveNamedView(name: string, filters: InquiryFilterSnapshot) {
  const trimmed = name.trim()
  if (!trimmed) return
  const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const prev = loadSavedViews().filter((v) => v.name.trim().toLowerCase() !== trimmed.toLowerCase())
  const next: SavedInquiryView = {
    id,
    name: trimmed,
    createdAt: new Date().toISOString(),
    filters: { ...filters },
  }
  persistSavedViews([next, ...prev].slice(0, MAX_VIEWS))
}

export function deleteSavedView(id: string) {
  persistSavedViews(loadSavedViews().filter((v) => v.id !== id))
}
