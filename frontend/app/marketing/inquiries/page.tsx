'use client'

import { useMarketingData } from '@/hooks/useMarketingData'
import InquiryList from '@/components/marketing/InquiryList'
import InquiryFilters from '@/components/marketing/InquiryFilters'
import InquirySavedViewsBar from '@/components/marketing/InquirySavedViewsBar'
import type { InquiryFilterSnapshot } from '@/lib/inquirySavedViews'
import CreateInquiryButton from '@/components/marketing/CreateInquiryButton'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { InquiryFormData, LeadTag } from '@/types/inquiry'
import { WEB_API } from '@/utils/api';
import { usePermissions } from '../settings/PermissionsContext'

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return { ...(tenant ? { 'x-tenant': tenant } : {}) } as Record<string, string>;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

export default function InquiriesPage() {
  const { inquiries, loading, refreshInquiries, refreshFollowups } = useMarketingData()
  const perms = usePermissions()
  const permsLoading = perms?.loading ?? true
  // Default to true while loading so we never flash "no access" during async fetch
  const canView = permsLoading ? true : (perms?.canView?.('inquiries') ?? true)
  const canEdit = permsLoading ? true : (perms?.canEdit?.('inquiries') ?? true)
  const canDelete = permsLoading ? true : (perms?.canDelete?.('inquiries') ?? true)
  const canExport = permsLoading ? true : (perms?.canExport?.('inquiries') ?? true)

  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [county, setCounty] = useState('')
  const [program, setProgram] = useState('')
  const [kcseGrade, setKcseGrade] = useState('')
  const [intake, setIntake] = useState('')
  const [gender, setGender] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [tags, setTags] = useState<LeadTag[]>([])
  const [focusMode, setFocusMode] = useState<'first-contact' | ''>('')
  const [owner, setOwner] = useState('')
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showHiddenCols, setShowHiddenCols] = useState(false)
  const [completenessSummary, setCompletenessSummary] = useState<{
    incompleteCount: number
    highPriorityCount: number
    highPriority: Array<{ id: number; fullName: string; phone: string; score: number; missingFields: string[] }>
  } | null>(null)
  const [showCompletenessNudge, setShowCompletenessNudge] = useState(false)
  const [chatSourceInfo, setChatSourceInfo] = useState<{ inquiryId: string; inquiryName: string; chatRoomId: string } | null>(null)
  const [letterShareHighlightId, setLetterShareHighlightId] = useState<string | null>(null)
  const [admissionShareBanner, setAdmissionShareBanner] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Do not early-return before all hooks execute; render guard content conditionally below

  const clearFilters = () => {
    setStatus(''); setSource(''); setSearch(''); setCounty(''); setProgram(''); setKcseGrade(''); setIntake(''); setGender(''); setPaymentStatus(''); setTags([])
    setOwner('')
  }

  const filterSnapshot = useMemo<InquiryFilterSnapshot>(
    () => ({
      status,
      source,
      search,
      county,
      program,
      kcseGrade,
      intake,
      gender,
      paymentStatus,
      tags,
      owner,
    }),
    [status, source, search, county, program, kcseGrade, intake, gender, paymentStatus, tags, owner],
  )

  const applySavedView = useCallback(
    (f: InquiryFilterSnapshot) => {
      setStatus(f.status)
      setSource(f.source)
      setSearch(f.search)
      setCounty(f.county)
      setProgram(f.program)
      setKcseGrade(f.kcseGrade)
      setIntake(f.intake)
      setGender(f.gender)
      setPaymentStatus(f.paymentStatus)
      setTags(f.tags)
      if (isAdmin) setOwner(f.owner)
    },
    [isAdmin],
  )

  // Detect role and load owners for admin/senior
  useEffect(() => {
    const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
    const admin = role === 'admin' || role === 'senior_staff'
    setIsAdmin(admin)
    if (admin) {
      fetch(`${WEB_API}/users`, { cache: 'no-store', credentials: 'include', headers: userHeaders() })
        .then(r => r.json())
        .then((users: any[]) => {
          const list = users
            .filter(u => (u.role === 'admissions_officer' || u.role === 'senior_staff' || u.role === 'admin'))
            // Exclude global seed/super-admin user from owner lists
            .filter(u => !/^\s*sadmin@edusmart\.com\s*$/i.test(String(u?.email || '')))
            .map(u => ({ label: (u.name && String(u.name).trim()) ? String(u.name) : `User #${u.id || u.email.slice(0, 6)}`, value: String(u.email) }))
          setOwners(list)
        })
        .catch(() => setOwners([]))
    }
  }, [])

  // Allow drill-down from reports via ?owner=
  useEffect(() => {
    if (!isAdmin) return
    const o = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('owner') : '') || ''
    if (o) setOwner(o)
  }, [isAdmin])

  // Refetch when owner changes (for admin/senior)
  useEffect(() => {
    if (isAdmin) {
      refreshInquiries(owner || undefined)
      refreshFollowups(owner || undefined)
    }
  }, [owner, isAdmin])

  const loadCompletenessSummary = async () => {
    try {
      const url = isAdmin && owner
        ? `${WEB_API}/inquiries/completeness/summary?owner=${encodeURIComponent(owner)}`
        : `${WEB_API}/inquiries/completeness/summary`
      const res = await fetch(url, { cache: 'no-store', credentials: 'include', headers: userHeaders() })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data) setCompletenessSummary(data)
    } catch {}
  }

  // Poll completeness summary to intelligently nudge users
  useEffect(() => {
    loadCompletenessSummary()
    const poll = setInterval(loadCompletenessSummary, 3 * 60 * 1000)
    return () => clearInterval(poll)
  }, [isAdmin, owner, inquiries.length])

  // Show periodic reminder when there are incomplete profiles
  useEffect(() => {
    if (!completenessSummary?.incompleteCount) return
    setShowCompletenessNudge(true)
    const timer = setInterval(() => setShowCompletenessNudge(true), 2 * 60 * 1000)
    return () => clearInterval(timer)
  }, [completenessSummary?.incompleteCount])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const qs = new URLSearchParams(window.location.search)
    const source = (qs.get('source') || '').trim()
    if (source === 'chat_tag') {
      setChatSourceInfo({
        inquiryId: qs.get('remind') || qs.get('inquiryId') || '',
        inquiryName: qs.get('inquiryName') || '',
        chatRoomId: qs.get('chatRoomId') || '',
      })
    }
    const openI = (qs.get('openInquiry') || '').trim()
    if (openI) {
      setLetterShareHighlightId(openI)
      if (qs.get('fromAdmissionShare') === '1') setAdmissionShareBanner(true)
    }
    const qSearch = (qs.get('q') || qs.get('search') || '').trim()
    if (qSearch) setSearch(qSearch)

    const focus = (qs.get('focus') || '').trim()
    if (focus === 'first-contact') setFocusMode('first-contact')
  }, [])

  const stripLetterShareQuery = useCallback(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.delete('openInquiry')
    url.searchParams.delete('fromAdmissionShare')
    const q = url.searchParams.toString()
    window.history.replaceState({}, '', url.pathname + (q ? `?${q}` : ''))
  }, [])

  const afterLetterShareRowReady = useCallback(() => {
    stripLetterShareQuery()
    setLetterShareHighlightId(null)
  }, [stripLetterShareQuery])

  const consumeLetterShareBanner = useCallback(() => {
    setAdmissionShareBanner(false)
    stripLetterShareQuery()
    setLetterShareHighlightId(null)
  }, [stripLetterShareQuery])

  const [apiCourses, setApiCourses] = useState<string[]>([])
  useEffect(() => {
    fetch(`${WEB_API}/courses`, { credentials: 'include', headers: userHeaders() })
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) setApiCourses(data.map(c => c.name).filter(Boolean))
      })
      .catch(() => {})
  }, [])

  const programOptions = useMemo(() => {
    const set = new Set<string>()
    for (const i of inquiries || []) {
      const p = String((i as any)?.programOfInterest || '').trim()
      if (p) set.add(p)
    }
    for (const name of apiCourses) {
      if (name) set.add(name)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [inquiries, apiCourses])

  const filteredInquiries = useMemo(() => {
    const statusFilter = status.trim().toLowerCase()
    const sourceFilter = source.trim().toLowerCase()
    const q = search.trim().toLowerCase()
    const countyF = county.trim().toLowerCase()
    const programF = program.trim().toLowerCase()
    const gradeF = kcseGrade.trim().toUpperCase()
    const intakeF = intake.trim().toLowerCase()
    const genderF = gender.trim().toLowerCase()
    const payF = paymentStatus.trim().toLowerCase()

    return (inquiries || []).filter(i => {
      const iStatus = (i.status || '').toLowerCase()
      const iSource = (i.source || '').toLowerCase()
      const matchesStatus = !statusFilter || iStatus === statusFilter
      const matchesSource = !sourceFilter || iSource === sourceFilter

      const matchesCounty = !countyF || (i.detail?.county || '').toLowerCase() === countyF
      const matchesProgram = !programF || String(i.programOfInterest || '').toLowerCase() === programF
      const matchesGrade = !gradeF || (i.kcseGrade || '').toUpperCase() === gradeF
      const matchesIntake = !intakeF || (i.intakePeriod || '').toLowerCase() === intakeF
      const matchesGender = !genderF || (i.gender || '').toLowerCase() === genderF
      const matchesPayment = !payF || (i.paymentStatus || '').toLowerCase() === payF

      const matchesTags = tags.length === 0 || (Array.isArray(i.leadTags) && tags.every(t => i.leadTags.includes(t)))

      const matchesText = !q || [
        i.fullName,
        i.phone,
        i.email || '',
        i.programOfInterest || '',
        i.agentOrReferralName || '',
        i.kcseGrade || '',
        i.detail?.county?.replace('_',' ') || '',
        i.detail?.town || ''
      ].some(v => String(v).toLowerCase().includes(q))

      const matchesFocus =
        focusMode !== 'first-contact' ||
        (!i.firstResponseAt && (new Date(i.createdAt as any).getTime() < Date.now() - 24 * 60 * 60 * 1000))

      return matchesStatus && matchesSource && matchesCounty && matchesProgram && matchesGrade && matchesIntake && matchesGender && matchesPayment && matchesTags && matchesText && matchesFocus
    })
  }, [inquiries, status, source, search, county, program, kcseGrade, intake, gender, paymentStatus, tags, focusMode])

  const firstContactQueue = useMemo(() => {
    if (focusMode !== 'first-contact') return []
    return [...filteredInquiries]
      .sort((a: any, b: any) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime())
      .slice(0, 80)
  }, [focusMode, filteredInquiries])

  const handleAddInquiry = async (data: InquiryFormData) => {
    try {
      setError(null)
      setSuccess(null)

      const inquiryData: any = {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        gender: data.gender,
        programOfInterest: data.programOfInterest,
        intakePeriod: data.intakePeriod,
        studyMode: data.studyMode,
        source: data.source,
        agentOrReferralName: data.agentOrReferralName,
        preferredContactMethod: data.preferredContactMethod,
        bestTimeToContact: data.bestTimeToContact,
        leadTags: data.leadTags,
        notes: data.notes,
        status: data.status || 'hot',
        assignedTo: data.assignedTo,
        kcseGrade: data.kcseGrade,
        detail: {
          county: data.county,
          town: data.town,
          idOrPassport: data.idOrPassport || undefined,
        },
        ...(typeof data.consentSms === 'boolean' ? { consentSms: data.consentSms } : {}),
        ...(typeof data.consentEmail === 'boolean' ? { consentEmail: data.consentEmail } : {}),
        ...(typeof data.consentWhatsapp === 'boolean' ? { consentWhatsapp: data.consentWhatsapp } : {}),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const response = await fetch(`${WEB_API}/inquiries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...userHeaders(),
        },
        body: JSON.stringify(inquiryData),
      });
      
      let result: any = null;
      try {
        result = await response.json();
      } catch {
        if (!response.ok) throw new Error(`Server error (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(result?.message || result?.error || `Failed to create inquiry (${response.status})`);
      }
      
      // Backend returns the inquiry object directly on success (status 201)
      // Result should have inquiry data with id, fullName, etc.

      // Audit: inquiry created
      try {
        const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || localStorage.getItem('userName') || '') : '';
        await fetch('/api/marketing/settings/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_inquiry', module: 'marketing', user: userEmail, details: { fullName: inquiryData.fullName, phone: inquiryData.phone, programOfInterest: inquiryData.programOfInterest } })
        });
      } catch {}

      setSuccess('Inquiry created successfully!');
      await refreshInquiries();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create inquiry');
      setTimeout(() => setError(null), 5000);
    }
  };

  const downloadImportTemplate = () => {
    const headers = [
      'fullName',
      'phone',
      'email',
      'gender',
      'programOfInterest',
      'intakePeriod',
      'studyMode',
      'source',
      'agentOrReferralName',
      'preferredContactMethod',
      'bestTimeToContact',
      'leadTags',
      'notes',
      'status',
      'kcseGrade',
      'county',
      'town',
      'idOrPassport',
    ]
    const sample = [
      'John Doe',
      '0712345678',
      'john@example.com',
      'male',
      'Diploma in Perioperative Theatre Technology',
      'January',
      'full-time',
      'walk-in',
      'Jane Smith',
      'phone',
      'Morning',
      'hot,scholarship-seeker',
      'Interested in scholarship',
      'hot',
      'B+',
      'Nairobi',
      'Nairobi',
      '12345678',
    ]
    const note = '# Required minimum for import: fullName, phone, and programOfInterest.'
    const csv = `${note}\n${headers.join(',')}\n${sample.join(',')}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inquiries-bulk-import-template.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportFilteredCsv = () => {
    const headers = ['Full Name','Phone','Email','Program','Intake','Mode','Source','KCSE Grade','County','Town','Lead Tags','Status']
    const rows = filteredInquiries.map(i => [
      i.fullName,
      i.phone,
      i.email || '',
      i.programOfInterest || '',
      i.intakePeriod || '',
      i.studyMode || '',
      i.source || '',
      i.kcseGrade || '',
      (i.detail?.county || '').replace('_',' '),
      i.detail?.town || '',
      Array.isArray(i.leadTags) ? i.leadTags.join(',') : '',
      i.status || '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inquiries_export_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Loading skeleton while permissions are being resolved: never show blank or "no access"
  if (permsLoading) {
    return (
      <div className="flex flex-col h-full space-y-4">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-8 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />)}
          </div>
        </div>
        {/* Filter bar skeleton */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-8 w-28 bg-gray-100 dark:bg-gray-700 animate-pulse rounded" />)}
          </div>
        </div>
        {/* Table skeleton */}
        <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              <div className="h-4 w-20 bg-gray-100 dark:bg-gray-600 animate-pulse rounded" />
              <div className="h-4 flex-1 bg-gray-100 dark:bg-gray-600 animate-pulse rounded" />
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold">Inquiries</h1>
        {/* Top-right create / bulk import */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <>
              <CreateInquiryButton addInquiry={handleAddInquiry} />
              <button
                className="px-3 py-2 text-[13px] font-semibold bg-sky-600 text-white hover:bg-sky-700"
                onClick={downloadImportTemplate}
                title="Download bulk import CSV template"
              >
                Download Import CSV
              </button>
              <BulkImportButton onImported={refreshInquiries} />
              {canExport && (
                <button
                  className="px-3 py-2 text-[13px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={exportFilteredCsv}
                  title="Export filtered inquiries to CSV"
                >
                  Export CSV
                </button>
              )}
              <button
                className="px-3 py-2 text-[13px] font-semibold bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => setShowHiddenCols(v => !v)}
                title={showHiddenCols ? 'Hide extra columns' : 'Show extra columns'}
              >
                {showHiddenCols ? 'Hide Columns' : 'Show Columns'}
              </button>
              <button
                className="px-3 py-2 text-[13px] font-semibold bg-gray-600 text-white hover:bg-gray-700"
                onClick={() => refreshInquiries(isAdmin ? (owner || undefined) : undefined)}
                title="Refresh inquiries"
              >
                Refresh
              </button>
            </>
          )}
        </div>
      </div>
      {canView && chatSourceInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-3 rounded">
          Opened from tagged chat inquiry{chatSourceInfo.inquiryName ? `: ${chatSourceInfo.inquiryName}` : ''}. Reminder/follow-up actions here are logged to your account audit trail.
        </div>
      )}
      {canView && admissionShareBanner && (
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 px-4 py-3 rounded flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">You shared an admission letter for a WhatsApp-linked inquiry. The matching row is highlighted below so you can log a follow-up or update status.</span>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded border border-teal-300 dark:border-teal-700 bg-white dark:bg-gray-800 hover:bg-teal-100 dark:hover:bg-teal-900/30 font-medium"
            onClick={consumeLetterShareBanner}
          >
            Dismiss
          </button>
        </div>
      )}
      {canView && focusMode === 'first-contact' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-3 rounded flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            Leads needing first contact (no first response logged, older than 24h):{' '}
            <strong>{filteredInquiries.length}</strong>. Oldest are shown first.
          </div>
          <div className="flex flex-wrap gap-2">
            {firstContactQueue[0] && (
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 text-[13px] font-semibold"
                onClick={() => {
                  if (typeof window === 'undefined') return
                  const url = new URL(window.location.href)
                  url.searchParams.set('openInquiry', String((firstContactQueue[0] as any).id))
                  window.location.href = url.pathname + `?${url.searchParams.toString()}`
                }}
                title="Open the oldest lead in this queue"
              >
                Open next lead
              </button>
            )}
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-[13px] font-semibold"
              onClick={() => {
                setFocusMode('')
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href)
                  url.searchParams.delete('focus')
                  const q = url.searchParams.toString()
                  window.history.replaceState({}, '', url.pathname + (q ? `?${q}` : ''))
                }
              }}
            >
              Clear focus
            </button>
          </div>
        </div>
      )}
      {/* Only show "no access" once permissions have finished loading */}
      {!canView && (
        <div className="flex items-center justify-center min-h-[40vh] text-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">WELCOME TO EDUSMART</h2>
            <p className="text-gray-500 dark:text-gray-400">Your current role does not have access to this section.</p>
          </div>
        </div>
      )}
      {canView && error && (
        <div className="bg-rose-50 dark:bg-rose-900/25 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {canView && success && (
        <div className="bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{success}</span>
        </div>
      )}
      {canView && completenessSummary && completenessSummary.incompleteCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <strong>{completenessSummary.incompleteCount}</strong> inquiry profiles are incomplete.
            {' '}<span className="opacity-90">Complete required fields to improve conversion-gap analytics and reporting quality.</span>
          </div>
          <button
            className="px-3 py-1.5 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-[13px] font-semibold"
            onClick={() => setShowCompletenessNudge(true)}
          >
            Review Missing Data
          </button>
        </div>
      )}

      {canView && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Sticky filters bar */}
        <div className="p-4 border-b border-neutral-light dark:border-gray-700 flex-shrink-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-t-lg">
          <InquirySavedViewsBar snapshot={filterSnapshot} onApply={applySavedView} isAdmin={isAdmin} />
          <InquiryFilters
            status={status}
            setStatus={setStatus}
            source={source}
            setSource={setSource}
            search={search}
            setSearch={setSearch}
            county={county}
            setCounty={setCounty}
            program={program}
            setProgram={setProgram}
            programOptions={programOptions}
            kcseGrade={kcseGrade}
            setKcseGrade={setKcseGrade}
            intake={intake}
            setIntake={setIntake}
            gender={gender}
            setGender={setGender}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            isAdmin={isAdmin}
            owner={owner}
            setOwner={setOwner}
            owners={owners}
            onClear={clearFilters}
          />
        </div>
        {/* Table area — fills remaining height, only this area scrolls */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4">
          <InquiryList
            inquiries={filteredInquiries}
            onRefresh={refreshInquiries}
            canEdit={canEdit}
            canDelete={canDelete}
            showHiddenCols={showHiddenCols}
            highlightInquiryId={letterShareHighlightId}
            onHighlightConsumed={afterLetterShareRowReady}
          />
        </div>
      </div>
      )}

      {showCompletenessNudge && completenessSummary && completenessSummary.incompleteCount > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCompletenessNudge(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded shadow-lg w-full max-w-2xl mx-4 border dark:border-gray-700">
            <div className="px-5 py-3 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="font-semibold text-gray-900 dark:text-gray-100">Data Completion Reminder</div>
              <button onClick={() => setShowCompletenessNudge(false)} className="px-2 py-1 rounded border dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">Close</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Incomplete inquiry profiles reduce system intelligence for gap analysis, conversion forecasting, and follow-up prioritization.
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                High-priority incomplete profiles: <strong>{completenessSummary.highPriorityCount}</strong>
              </p>
              <div className="max-h-64 overflow-auto border dark:border-gray-700 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/90">
                    <tr>
                      <th className="text-left px-3 py-2 border-b">Name</th>
                      <th className="text-left px-3 py-2 border-b">Score</th>
                      <th className="text-left px-3 py-2 border-b">Missing Fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completenessSummary.highPriority.map((x) => (
                      <tr key={x.id} className="border-b">
                        <td className="px-3 py-2">{x.fullName || x.phone}</td>
                        <td className="px-3 py-2 font-semibold text-amber-700 dark:text-amber-300">{x.score}%</td>
                        <td className="px-3 py-2">{x.missingFields.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowCompletenessNudge(false)} className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90">Will Update</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
} 

function BulkImportButton({ onImported }: { onImported: () => Promise<void> | void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const cleaned = text
        .split(/\r?\n/)
        .filter(l => l.trim().length > 0 && !l.trim().startsWith('#'))
      const [headerLine, ...lines] = cleaned
      const headers = parseCsvLine(headerLine).map(h => h.trim().toLowerCase());

      const idx = (name: string) => headers.indexOf(name);
      const nameIdx =
        idx('fullname') !== -1 ? idx('fullname')
        : idx('full_name') !== -1 ? idx('full_name')
        : idx('full name') !== -1 ? idx('full name')
        : idx('name');
      const phoneIdx = idx('phone');

      if (nameIdx === -1 || phoneIdx === -1) {
        throw new Error('CSV must include at least "name" and "phone" columns in the header.');
      }

      const inquiries = lines.map(line => {
        const cols = parseCsvLine(line);
        const get = (headerName: string) => {
          const i = idx(headerName)
          return i >= 0 ? (cols[i] || '').replace(/^"|"$/g, '').trim() : ''
        }
        return {
          fullName: (cols[nameIdx] || '').replace(/^"|"$/g, '').trim(),
          phone: (cols[phoneIdx] || '').replace(/^"|"$/g, '').trim(),
          email: get('email'),
          gender: get('gender'),
          programOfInterest: get('programofinterest') || get('program_of_interest') || get('program'),
          intakePeriod: get('intakeperiod') || get('intake_period') || get('intake'),
          studyMode: get('studymode') || get('study_mode') || get('mode'),
          source: get('source'),
          agentOrReferralName: get('agentorreferralname') || get('agent_or_referral_name'),
          preferredContactMethod: get('preferredcontactmethod') || get('preferred_contact_method'),
          bestTimeToContact: get('besttimetocontact') || get('best_time_to_contact'),
          leadTags: get('leadtags') || get('lead_tags'),
          notes: get('notes'),
          status: get('status'),
          kcseGrade: get('kcsegrade') || get('kcse_grade'),
          county: get('county'),
          town: get('town'),
          idOrPassport: get('idorpassport') || get('id_or_passport'),
        };
      }).filter(r => r.fullName && r.phone && r.programOfInterest);

      if (inquiries.length === 0) {
        throw new Error('No valid rows found to import.');
      }

      const res = await fetch('/api/proxy/inquiries/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({ inquiries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Bulk import failed');
      }
      if (typeof onImported === 'function') await onImported();
      alert(`Imported ${data.successCount ?? inquiries.length} inquiries. The system will continue reminding users to complete missing profile fields for analytics quality.`);
    } catch (e: any) {
      setError(e?.message || 'Bulk import failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/25 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-2 py-1 rounded text-xs max-w-xs text-right">
          {error}
        </div>
      )}
      <label className="px-3 py-2 text-[13px] rounded-md border dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold cursor-pointer">
        {loading ? 'Importing…' : 'Bulk Import CSV'}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />
      </label>
    </div>
  );
}