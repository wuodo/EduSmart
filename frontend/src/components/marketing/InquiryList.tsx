'use client'

import React, { useEffect, useState } from 'react'
import { Inquiry } from '@/types/inquiry'
import { format } from 'date-fns'
import { PencilSquareIcon, TrashIcon, EyeIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import CreateInquiryButton from './CreateInquiryButton'
import {
  InquiryFormData,
  InquiryStatus,
  InquirySource,
  Gender,
  StudyMode,
  IntakePeriod,
  ContactMethod,
  LeadTag,
} from '@/types/inquiry'
import { API_BASE_URL, WEB_API } from '@/utils/api';
import { FaWhatsapp } from 'react-icons/fa';
import { useRef } from 'react';
import { apiFetch } from '@/utils/apiClient'
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  labelClass,
  textareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'
import NextBestActionsPanel from '@/components/crm/NextBestActionsPanel'
import InquiryTimeline from '@/components/crm/InquiryTimeline'

const PencilIcon: any = PencilSquareIcon;
const TrashIconAny: any = TrashIcon;
const EyeIconAny: any = EyeIcon;
const FaWhatsappAny: any = FaWhatsapp;
const CalendarDaysIconAny: any = CalendarDaysIcon;

export default function InquiryList({
  inquiries,
  onRefresh,
  canEdit = true,
  canDelete = true,
  showHiddenCols = false,
  highlightInquiryId = null,
  onHighlightConsumed,
}: {
  inquiries: Inquiry[],
  onRefresh: () => void,
  canEdit?: boolean,
  canDelete?: boolean,
  showHiddenCols?: boolean,
  highlightInquiryId?: string | null,
  onHighlightConsumed?: () => void,
}) {
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<InquiryFormData | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showLocation, setShowLocation] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showDeletedPanel, setShowDeletedPanel] = useState(false)
  const [deletedItems, setDeletedItems] = useState<any[]>([])
  const [loadingDeleted, setLoadingDeleted] = useState(false)
  const [selectedDeletedArchiveIds, setSelectedDeletedArchiveIds] = useState<string[]>([])
  const [mergeTargetId, setMergeTargetId] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserRole((localStorage.getItem('userRole') || '').toLowerCase())
    }
  }, [])
  const isAdminLike = userRole === 'admin' || userRole === 'senior_staff'
  const [hasApproval, setHasApproval] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadApprovals() {
      try {
        const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        if (!email) return
        const res = await fetch(`${WEB_API}/approvals?officerEmail=${encodeURIComponent(email)}`)
        const data = await res.json()
        if (Array.isArray(data?.approvals)) {
          const map: Record<string, boolean> = {}
          for (const a of data.approvals) {
            if (a?.module === 'inquiries' && a?.status === 'approved') {
              map[String(a.itemId)] = true
            }
          }
          setHasApproval(map)
        }
      } catch {}
    }
    loadApprovals()
  }, [])

  // Refresh approvals whenever delete modal opens
  useEffect(() => {
    if (!showDelete) return
    async function refreshApprovals() {
      try {
        const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        if (!email) return
        const res = await fetch(`${WEB_API}/approvals?officerEmail=${encodeURIComponent(email)}`)
        const data = await res.json()
        if (Array.isArray(data?.approvals)) {
          const map: Record<string, boolean> = {}
          for (const a of data.approvals) {
            if (a?.module === 'inquiries' && a?.status === 'approved') {
              map[String(a.itemId)] = true
            }
          }
          setHasApproval(map)
        }
      } catch {}
    }
    refreshApprovals()
  }, [showDelete])

  // WhatsApp Chat Widget State
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [whatsAppName, setWhatsAppName] = useState('');
  const [whatsAppMsg, setWhatsAppMsg] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [pulseRowId, setPulseRowId] = useState<string | null>(null);

  // Sort inquiries by createdAt (latest first)
  const sorted = [...inquiries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  useEffect(() => {
    const visible = new Set(sorted.map((i) => String(i.id)))
    setSelectedIds((prev) => prev.filter((id) => visible.has(String(id))))
  }, [inquiries])

  useEffect(() => {
    const hid = (highlightInquiryId || '').trim();
    if (!hid) return;
    if (!sorted.some((i) => String(i.id) === hid)) return;
    const t = window.setTimeout(() => {
      const row = rowRefs.current[hid];
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setExpanded((prev) => ({ ...prev, [hid]: true }));
        setPulseRowId(hid);
        window.setTimeout(() => setPulseRowId((cur) => (cur === hid ? null : cur)), 6000);
      }
      onHighlightConsumed?.();
    }, 400);
    return () => clearTimeout(t);
  }, [highlightInquiryId, sorted, onHighlightConsumed])

  const allSelected = sorted.length > 0 && selectedIds.length === sorted.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
      return
    }
    setSelectedIds(sorted.map((i) => String(i.id)))
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ))
  }

  // Summary calculations
  const total = inquiries.length;
  const byIntake: Record<string, number> = {};
  const byProgram: Record<string, number> = {};
  for (const i of inquiries) {
    byIntake[i.intakePeriod] = (byIntake[i.intakePeriod] || 0) + 1;
    byProgram[i.programOfInterest] = (byProgram[i.programOfInterest] || 0) + 1;
  }

  // Abbreviation logic for course names
  function abbreviateProgram(name?: string | null) {
    const ignore = ['in', 'of', 'and', 'for', 'to', 'the', 'with', 'on', 'at', 'by'];
    const safe = (name || '').trim()
    if (!safe) return ''
    return safe
      .split(' ')
      .filter(word => word && !ignore.includes(word.toLowerCase()))
      .map(word => word[0].toUpperCase())
      .join('');
  }

  function formatLeadTags(tags: any): string {
    if (!tags) return ''
    if (Array.isArray(tags)) return tags.filter(Boolean).join(', ')
    if (typeof tags === 'string') return tags
    // Prisma Json? can come back as object; best-effort stringify
    try {
      return JSON.stringify(tags)
    } catch {
      return String(tags)
    }
  }

  // Map program initials to full name for tooltip
  const abbrToFull: Record<string, string> = Object.keys(byProgram).reduce((acc, prog) => {
    acc[abbreviateProgram(prog)] = prog;
    return acc;
  }, {} as Record<string, string>);

  // Top programs for compact mobile summary
  const topPrograms = Object.entries(byProgram)
    .sort((a,b) => b[1]-a[1])
    .slice(0,3)
    .map(([name, count]) => ({ abbr: abbreviateProgram(name), name, count }))
  const remainingPrograms = Math.max(0, Object.keys(byProgram).length - topPrograms.length)

  // Edit handler
  const handleEdit = (inquiry: Inquiry) => {
    if (!canEdit) return;
    setEditData({
      fullName: inquiry.fullName,
      phone: inquiry.phone,
      email: inquiry.email,
      gender: inquiry.gender,
      programOfInterest: inquiry.programOfInterest,
      intakePeriod: inquiry.intakePeriod,
      studyMode: inquiry.studyMode,
      source: inquiry.source,
      agentOrReferralName: inquiry.agentOrReferralName,
      preferredContactMethod: inquiry.preferredContactMethod,
      bestTimeToContact: inquiry.bestTimeToContact,
      leadTags: inquiry.leadTags,
      notes: inquiry.notes,
      status: inquiry.status as InquiryStatus,
      assignedTo: '',
      documents: [],
      kcseGrade: inquiry.kcseGrade || '',
      county: inquiry.detail?.county || '',
      town: inquiry.detail?.town || '',
      idOrPassport: inquiry.detail?.idOrPassport || '',
      consentSms: (inquiry as any).consentSms ?? undefined,
      consentEmail: (inquiry as any).consentEmail ?? undefined,
      consentWhatsapp: (inquiry as any).consentWhatsapp ?? undefined,
    })
    setEditMode(true)
    setSelected(inquiry)
  }

  const handleEditSubmit = async (data: InquiryFormData) => {
    if (!selected) return
    setLoading(true)
    try {
      await apiFetch(`/inquiries/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...data, createdBy: selected.createdBy }),
      })
    } finally {
      setEditMode(false)
      setEditData(null)
      setSelected(null)
      setLoading(false)
      onRefresh()
    }
  }

  // Delete handler
  const handleDelete = async () => {
    if (!deleteId || !canDelete) return
    setLoading(true)
    try {
      const res = await apiFetch(`/inquiries/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any))
        throw new Error(data?.message || data?.error || `Failed to delete inquiry (${res.status})`)
      }
      setShowDelete(false)
      setDeleteId(null)
      setToast({ type: 'success', message: 'Inquiry deleted successfully.' })
      onRefresh()
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to delete inquiry.' })
    } finally {
      setLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!isAdminLike || !canDelete || selectedIds.length === 0) return
    const confirmed = window.confirm(`Delete ${selectedIds.length} selected inquiries? This action cannot be undone.`)
    if (!confirmed) return
    setLoading(true)
    try {
      const res = await apiFetch('/inquiries/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      })
      const result = await res.json().catch(() => ({} as any))
      if (!res.ok) {
        throw new Error(result?.message || result?.error || `Bulk delete failed (${res.status})`)
      }
      setSelectedIds([])
      const deleted = Number(result?.deletedCount || 0)
      const requested = Number(result?.requestedCount || 0)
      setToast({ type: 'success', message: `Deleted ${deleted} of ${requested} selected inquiries.` })
      onRefresh()
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Bulk delete failed.' })
    } finally {
      setLoading(false)
    }
  }

  const loadDeletedItems = async () => {
    setLoadingDeleted(true)
    try {
      const headers: Record<string, string> = {}
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem('tenant') || ''
        if (t) headers['x-tenant'] = t
      }
      const res = await fetch(`${WEB_API}/inquiries/deleted-recent?limit=30`, {
        cache: 'no-store',
        credentials: 'include',
        headers,
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load deleted inquiries')
      const arr = Array.isArray(data?.items) ? data.items : []
      setDeletedItems(arr)
      setSelectedDeletedArchiveIds([])
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to load deleted inquiries.' })
      setDeletedItems([])
    } finally {
      setLoadingDeleted(false)
    }
  }

  const requestRestore = async (archiveId: string) => {
    try {
      const reason = prompt('Optional reason for restore request:') || ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem('tenant') || ''
        if (t) headers['x-tenant'] = t
      }
      const res = await fetch(`${WEB_API}/delete-requests/restore`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ archiveId, reason: reason || undefined }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create restore request')
      setToast({ type: 'success', message: 'Restore request sent to superadmin.' })
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to request restore.' })
    }
  }

  const requestRestoreBulk = async () => {
    if (selectedDeletedArchiveIds.length === 0) return
    const reason = prompt(`Optional reason for ${selectedDeletedArchiveIds.length} restore request(s):`) || ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('tenant') || ''
      if (t) headers['x-tenant'] = t
    }
    try {
      let okCount = 0
      for (const archiveId of selectedDeletedArchiveIds) {
        const res = await fetch(`${WEB_API}/delete-requests/restore`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ archiveId, reason: reason || undefined }),
        })
        if (res.ok) okCount++
      }
      if (okCount === 0) throw new Error('Failed to send restore requests')
      setToast({ type: 'success', message: `Sent ${okCount} restore request(s) to superadmin.` })
      setSelectedDeletedArchiveIds([])
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to send bulk restore requests.' })
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // Status color mapping
  const statusColors: Record<string, string> = {
    hot: 'bg-teal-600 text-white',
    warm: 'bg-amber-500 text-white',
    cold: 'bg-gray-500 text-white',
    'scholarship-seeker': 'bg-sky-600 text-white',
    graduate: 'bg-emerald-600 text-white'
  }

  const thBase =
    'sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm ' +
    'px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider'

  return (
    <div className="flex flex-col">
      {toast && (
        <div className="fixed top-16 right-4 z-50">
          <div
            className={`px-4 py-2 rounded shadow text-sm border ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
      {/* ── Sticky band: summary bar + action buttons ── */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
      {/* Summary Bar */}
      <div className="px-3 sm:px-4 py-2 bg-blue-50 border-b border-blue-200 text-xs">
        {/* Mobile: stacked summary */}
        <div className="block md:hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-primary">{total}</span>
          </div>
          <div>
            <div className="font-semibold mb-1">By Intake</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byIntake).map(([intake, count]) => (
                <span key={intake} className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[11px]">{intake.substring(0,3)}: <span className="font-semibold text-primary">{count}</span></span>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-1">Top Courses</div>
            <div className="flex flex-wrap gap-2">
              {topPrograms.map(p => (
                <span key={p.abbr} title={p.name} className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[11px]">{p.abbr}: <span className="font-semibold text-primary">{p.count}</span></span>
              ))}
              {remainingPrograms > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[11px]">+{remainingPrograms} more</span>
              )}
            </div>
          </div>
        </div>
        {/* Desktop: single line summary */}
        <div className="hidden md:flex flex-wrap gap-x-6 gap-y-1 items-center">
          <span className="font-semibold">Total:</span> {total}
          <span className="font-semibold">By Intake:</span> {Object.entries(byIntake).map(([intake, count]) => (
            <span key={intake} className="mr-2">{intake}: <span className="font-semibold text-primary">{count}</span></span>
          ))}
          <span className="font-semibold">By Course:</span> {Object.entries(byProgram).map(([prog, count]) => {
            const abbr = abbreviateProgram(prog);
            return (
              <span key={prog} className="mr-2" title={prog}>{abbr}: <span className="font-semibold text-primary">{count}</span></span>
            );
          })}
        </div>
      </div>
      {isAdminLike && canDelete && (
        <div className="px-3 py-1.5 bg-white border-b border-gray-100 flex items-center justify-end gap-2">
          <span className="text-xs text-gray-500">{selectedIds.length} selected</span>
          <button
            type="button"
            onClick={async () => {
              const next = !showDeletedPanel
              setShowDeletedPanel(next)
              if (next) await loadDeletedItems()
            }}
            className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-xs font-semibold"
            title="Show recently deleted inquiries"
          >
            {showDeletedPanel ? 'Hide Recently Deleted' : 'Restore Recently Deleted'}
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={loading || selectedIds.length === 0}
            className="px-3 py-1.5 rounded-md text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
            style={{ backgroundColor: 'var(--brand-action-btn, #dc2626)', color: 'var(--brand-action-btn-text, #ffffff)' }}
            title="Delete selected inquiries"
          >
            Delete Selected
          </button>
        </div>
      )}
      </div>{/* end sticky band */}

      {showDeletedPanel && (
        <div className="border-b border-amber-200 bg-amber-50/40">
          <div className="px-3 py-2 text-xs font-semibold border-b">
            Recently Deleted Inquiries
            <span className="ml-2 font-normal text-gray-600">Use "Send Restore Request" on each row.</span>
          </div>
          {loadingDeleted ? (
            <div className="px-3 py-2 text-xs text-gray-600">Loading...</div>
          ) : deletedItems.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-600">No recently deleted inquiries.</div>
          ) : (
            <div className="divide-y">
              <div className="px-3 py-2 text-xs flex items-center justify-between bg-amber-100/40">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deletedItems.length > 0 && selectedDeletedArchiveIds.length === deletedItems.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDeletedArchiveIds(deletedItems.map((x) => String(x.archiveId)))
                      else setSelectedDeletedArchiveIds([])
                    }}
                  />
                  <span>Select all</span>
                </label>
                <button
                  type="button"
                  onClick={requestRestoreBulk}
                  disabled={selectedDeletedArchiveIds.length === 0}
                  className="px-2 py-1 rounded border bg-white hover:bg-gray-100 disabled:opacity-50"
                >
                  Send Restore Requests ({selectedDeletedArchiveIds.length})
                </button>
              </div>
              {deletedItems.map((item) => (
                <div key={item.archiveId} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDeletedArchiveIds.includes(String(item.archiveId))}
                      onChange={(e) => {
                        const id = String(item.archiveId)
                        setSelectedDeletedArchiveIds((prev) => e.target.checked ? [...prev, id] : prev.filter((x) => x !== id))
                      }}
                    />
                    <div>
                    <div className="font-semibold truncate">{item.fullName || `Inquiry #${item.id}`}</div>
                    <div className="text-gray-600 truncate">
                      {item.phone || '-'} • {item.programOfInterest || '-'} • Deleted {new Date(item.deletedAt).toLocaleString()}
                    </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestRestore(String(item.archiveId))}
                    className="px-2 py-1 rounded border bg-white hover:bg-gray-100 whitespace-nowrap"
                  >
                    Send Restore Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="flow-root">
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle sm:px-6 lg:px-8 overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            {sorted.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No data to show.
              </div>
            ) : (
            <table className="w-full table-auto border-separate border-spacing-0 text-[13px] rounded-lg overflow-hidden shadow-sm ring-1 ring-gray-200">
              <thead style={{ backgroundColor: 'var(--brand-table-header-bg, #f1f5f9)', color: 'var(--brand-table-header-text, #374151)' }}>
                <tr>
                  <th scope="col" className={`${thBase} py-2 pl-3 pr-2 sm:pl-4 lg:pl-6 w-[56px]`}>
                    #
                  </th>
                  {isAdminLike && canDelete && (
                    <th scope="col" className={`${thBase} w-[48px]`}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        title="Select all"
                      />
                    </th>
                  )}
                  <th scope="col" className={`${thBase} md:w-[220px]`}>
                    Full Name
                  </th>
                  <th scope="col" className={`${thBase} md:w-[140px]`}>
                    Phone
                  </th>
                  <th scope="col" className={`${thBase} hidden md:table-cell w-[140px]`}>
                    Program
                  </th>
                  <th scope="col" className={`${thBase} hidden lg:table-cell w-[86px]`}>
                    Intake
                  </th>
                  <th scope="col" className={`${thBase} hidden lg:table-cell w-[92px]`}>
                    Mode
                  </th>
                  <th scope="col" className={`${thBase} hidden xl:table-cell w-[110px]`}>
                    Source
                  </th>
                  <th scope="col" className={`${thBase} hidden xl:table-cell w-[70px]`}>
                    KCSE
                  </th>
                  <th scope="col" className={`${thBase} ${showHiddenCols ? '' : 'hidden'} w-[160px]`}>
                    County / Town
                  </th>
                  <th scope="col" className={`${thBase} hidden xl:table-cell w-[140px]`}>
                    Lead Tags
                  </th>
                  <th scope="col" className={`${thBase} ${showHiddenCols ? '' : 'hidden'} w-[90px]`}>
                    Status
                  </th>
                  <th scope="col" className={`${thBase} hidden md:table-cell w-[70px]`}>
                    Score
                  </th>
                  <th scope="col" className={`${showHiddenCols ? '' : 'hidden'}`}>
                    RECOMM
                  </th>
                  <th scope="col" className={`${showHiddenCols ? '' : 'hidden'}`}>
                    Sentiment
                  </th>
                  <th scope="col" className={`${thBase} ${showHiddenCols ? '' : 'hidden'} w-[110px]`}>
                    Response Time
                  </th>
                  <th scope="col" className={`${thBase} ${showHiddenCols ? '' : 'hidden'} w-[120px]`}>
                    Next Follow-up
                  </th>
                  <th scope="col" className={`${thBase} py-2 pl-2 pr-3 sm:pr-4 lg:pr-6 w-[120px]`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {sorted.map((inquiry, index) => {
                  // Sentiment icon
                  let sentimentIcon = null;
                  if (inquiry.sentiment === 'positive') sentimentIcon = <span title="Positive" className="text-emerald-600 font-semibold">Positive</span>;
                  else if (inquiry.sentiment === 'negative') sentimentIcon = <span title="Negative" className="text-amber-600 font-semibold">Negative</span>;
                  else if (inquiry.sentiment === 'neutral') sentimentIcon = <span title="Neutral" className="text-gray-500 dark:text-gray-300 font-semibold">Neutral</span>;
                  // Overdue follow-up
                  const overdue = inquiry.nextFollowupAt && new Date(inquiry.nextFollowupAt) < new Date();
                  // Response time
                  let responseTime = '-';
                  if (inquiry.firstResponseAt) {
                    const created = new Date(inquiry.createdAt);
                    const responded = new Date(inquiry.firstResponseAt);
                    const diff = Math.round((responded.getTime() - created.getTime()) / (1000 * 60 * 60));
                    responseTime = diff + 'h';
                  }
                  return (
                  <React.Fragment key={inquiry.id || index}>
                  <tr
                    ref={(el) => { rowRefs.current[String(inquiry.id)] = el }}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${pulseRowId === String(inquiry.id) ? 'ring-2 ring-teal-600/70 ring-inset bg-teal-50/30' : ''}`}
                  >
                    <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-3 pr-2 text-[13px] text-gray-700 sm:pl-4 lg:pl-6">
                      <button className="mr-2 md:hidden text-gray-600" title="Expand" onClick={() => setExpanded(prev => ({ ...prev, [inquiry.id]: !prev[inquiry.id] }))}>{expanded[inquiry.id] ? '▾' : '▸'}</button>
                      {index + 1}
                    </td>
                    {isAdminLike && canDelete && (
                      <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(String(inquiry.id))}
                          onChange={() => toggleSelectOne(String(inquiry.id))}
                          title="Select inquiry"
                        />
                      </td>
                    )}
                    <td className="border-b border-gray-100 px-2 py-1.5 text-[13px] font-medium text-gray-800 break-words md:truncate">
                      <span>{inquiry.fullName}</span>
                      {inquiry.smartMeta?.dormant && (
                        <span className="ml-1.5 align-middle text-[10px] uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">Dormant</span>
                      )}
                      {inquiry.smartMeta?.intakeWarning && (
                        <span
                          className="ml-1.5 align-middle text-[10px] uppercase tracking-wide text-rose-800 bg-rose-50 border border-rose-200 rounded px-1 py-0.5"
                          title={inquiry.smartMeta.intakeFillPercent != null ? `Approximately ${inquiry.smartMeta.intakeFillPercent}% of configured seats` : 'Program nearing capacity'}
                        >
                          Capacity
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800">
                      {inquiry.phone}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 hidden md:table-cell truncate" title={inquiry.programOfInterest}>
                      {abbreviateProgram(inquiry.programOfInterest)}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 hidden lg:table-cell" title={inquiry.intakePeriod}>
                      {inquiry.intakePeriod ? inquiry.intakePeriod.substring(0,3) : ''}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 hidden lg:table-cell">
                      {inquiry.studyMode}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 hidden xl:table-cell">
                      {inquiry.source}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 hidden xl:table-cell">
                      {inquiry.kcseGrade || '-'}
                    </td>
                    <td className={`border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 ${showHiddenCols ? '' : 'hidden'} truncate`}> 
                      {inquiry.detail ? `${inquiry.detail.county.replace('_',' ')}/${inquiry.detail.town}` : '-'}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-800 hidden xl:table-cell truncate">
                      {formatLeadTags(inquiry.leadTags)}
                    </td>
                    <td className={`${showHiddenCols ? '' : 'hidden'} whitespace-nowrap border-b border-gray-200 px-3 py-2`}>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[inquiry.status] || statusColors.cold}`}>
                        {inquiry.status}
                      </span>
                    </td>
                    {/* SMART COLUMNS */}
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-blue-800 font-bold hidden md:table-cell" title="Inquiry Score">
                      {inquiry.score ?? '-'}
                    </td>
                    <td className={`${showHiddenCols ? '' : 'hidden'}`} title="Recommendation">
                      {inquiry.recommendation ?? '-'}
                    </td>
                    <td className={`${showHiddenCols ? '' : 'hidden'}`}>
                      {sentimentIcon}
                    </td>
                    <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] ${showHiddenCols ? '' : 'hidden'}`}>
                      {responseTime}
                    </td>
                    <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] ${overdue ? 'text-amber-600 font-bold' : ''} ${showHiddenCols ? '' : 'hidden'}`} title={overdue ? 'Overdue follow-up' : ''}>
                      {inquiry.nextFollowupAt ? new Date(inquiry.nextFollowupAt).toLocaleDateString() : '-'}
                      {overdue && <span title="Overdue" className="ml-1 text-amber-600 font-semibold">Overdue</span>}
                    </td>
                    {/* ...existing actions... */}
                    <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-2 pr-3 text-right text-[13px] font-medium sm:pr-4 lg:pr-6">
                      <button
                        onClick={() => handleEdit(inquiry)}
                        className="text-teal-700 hover:text-teal-900 mr-2"
                        title="Edit Inquiry"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (isAdminLike || hasApproval[String(inquiry.id)]) {
                            setDeleteId(inquiry.id)
                            // show confirm directly
                            setShowDelete(true)
                            return
                          }
                          setDeleteId(inquiry.id)
                          setShowDelete(true)
                        }}
                        className={`${(isAdminLike || hasApproval[String(inquiry.id)]) ? 'text-rose-500 hover:text-rose-700' : 'text-gray-400'} mr-2`}
                        title="Delete Inquiry"
                      >
                        <TrashIconAny className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setSelected(inquiry); setShowModal(true) }}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                        title="View Inquiry"
                      >
                        <EyeIconAny className="h-4 w-4" />
                      </button>
                      <Link
                        href={`/followups?inquiryId=${encodeURIComponent(String(inquiry.id))}`}
                        className="inline-flex text-amber-600 hover:text-amber-800 mr-2"
                        title="Follow-ups for this inquiry"
                      >
                        <CalendarDaysIconAny className="h-4 w-4" />
                      </Link>
                      {/* WhatsApp template button */}
                      <button
                        onClick={() => {
                          const raw = String(inquiry.phone || '').replace(/[\s\-().+]/g, '');
                          const normalized = raw.startsWith('0') ? `254${raw.slice(1)}` : raw;
                          setWhatsAppOpen(true);
                          setWhatsAppNumber(normalized);
                          setWhatsAppName(inquiry.fullName);
                          setWhatsAppMsg(`Hi ${inquiry.fullName},\nThank you for your interest in our ${inquiry.programOfInterest} program. Let us know if you have any questions or would like to proceed!`);
                        }}
                        className="text-green-600 hover:text-green-800"
                        title="Send WhatsApp Message"
                      >
                        <FaWhatsappAny className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {/* Mobile expanded details */}
                  {expanded[inquiry.id] && (
                    <tr className="md:hidden">
                      <td colSpan={16} className="px-4 py-3 bg-gray-50 border-b text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="text-gray-500">Program:</span> {inquiry.programOfInterest}</div>
                          <div><span className="text-gray-500">Intake:</span> {inquiry.intakePeriod}</div>
                          <div><span className="text-gray-500">Mode:</span> {inquiry.studyMode}</div>
                          <div><span className="text-gray-500">Source:</span> {inquiry.source}</div>
                          <div><span className="text-gray-500">KCSE:</span> {inquiry.kcseGrade || '-'}</div>
                          <div><span className="text-gray-500">County/Town:</span> {inquiry.detail ? `${inquiry.detail.county.replace('_',' ')}/${inquiry.detail.town}` : '-'}</div>
                          <div className="col-span-2"><span className="text-gray-500">Tags:</span> {formatLeadTags(inquiry.leadTags)}</div>
                          <div><span className="text-gray-500">Score:</span> {inquiry.score ?? '-'}</div>
                          <div><span className="text-gray-500">Recommendation:</span> {inquiry.recommendation ?? '-'}</div>
                          <div><span className="text-gray-500">Sentiment:</span> {inquiry.sentiment || '-'}</div>
                          <div><span className="text-gray-500">Response:</span> {responseTime}</div>
                          <div><span className="text-gray-500">Next F/U:</span> {inquiry.nextFollowupAt ? new Date(inquiry.nextFollowupAt).toLocaleDateString() : '-'}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </div>
      
      {/* View Modal */}
      {showModal && selected && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-lg`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Inquiry Details</h2>
              <button onClick={() => setShowModal(false)} className={modalCloseButtonClass} aria-label="Close">✕</button>
            </div>
            <NextBestActionsPanel inquiry={selected} />
            <div className="mt-3">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Activity timeline</h3>
              <InquiryTimeline inquiryId={String(selected.id)} />
            </div>
            {isAdminLike && (
              <div className="mt-3 p-2 rounded border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 text-xs">
                <div className="font-semibold text-amber-900 dark:text-amber-200">Merge duplicate into another inquiry</div>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5 mb-2">
                  This record will be removed; follow-ups move to the target ID.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-32"
                    placeholder="Target inquiry ID"
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                  />
                  <button
                    type="button"
                    className="px-2 py-1 rounded bg-amber-700 text-white"
                    onClick={async () => {
                      const tid = parseInt(mergeTargetId, 10)
                      if (!tid || !selected) return
                      if (!window.confirm(`Merge inquiry ${selected.id} into ${tid}? This cannot be undone.`)) return
                      try {
                        const res = await fetch(`${WEB_API}/inquiries/${selected.id}/merge`, {
                          method: 'POST',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ targetId: tid }),
                        })
                        const j = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error((j as any)?.message || 'Merge failed')
                        setToast({ type: 'success', message: `Merged into inquiry ${tid}.` })
                        setShowModal(false)
                        setMergeTargetId('')
                        onRefresh()
                      } catch (e: any) {
                        setToast({ type: 'error', message: e?.message || 'Merge failed' })
                      }
                    }}
                  >
                    Merge
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm border border-neutral-light">
                <tbody>
                <tr><td className="font-semibold p-2 w-1/3">Full Name</td><td className="p-2">{selected.fullName}</td></tr>
                <tr><td className="font-semibold p-2">Phone</td><td className="p-2">{selected.phone}</td></tr>
                {selected.email && <tr><td className="font-semibold p-2">Email</td><td className="p-2">{selected.email}</td></tr>}
                {selected.gender && <tr><td className="font-semibold p-2">Gender</td><td className="p-2">{selected.gender}</td></tr>}
                <tr><td className="font-semibold p-2">Program of Interest</td><td className="p-2">{selected.programOfInterest}</td></tr>
                <tr><td className="font-semibold p-2">KCSE Grade</td><td className="p-2">{selected.kcseGrade || '-'}</td></tr>
                <tr><td className="font-semibold p-2">County / Town</td><td className="p-2">{selected.detail ? `${selected.detail.county.replace('_',' ')}, ${selected.detail.town}` : '-'}</td></tr>
                <tr><td className="font-semibold p-2">Intake Period</td><td className="p-2">{selected.intakePeriod}</td></tr>
                <tr><td className="font-semibold p-2">Study Mode</td><td className="p-2">{selected.studyMode}</td></tr>
                <tr><td className="font-semibold p-2">Source</td><td className="p-2">{selected.source}</td></tr>
                {selected.agentOrReferralName && <tr><td className="font-semibold p-2">Agent/Referral Name</td><td className="p-2">{selected.agentOrReferralName}</td></tr>}
                <tr><td className="font-semibold p-2">Preferred Contact Method</td><td className="p-2">{selected.preferredContactMethod}</td></tr>
                {selected.bestTimeToContact && <tr><td className="font-semibold p-2">Best Time to Contact</td><td className="p-2">{selected.bestTimeToContact}</td></tr>}
                <tr><td className="font-semibold p-2">Lead Tags</td><td className="p-2">{selected.leadTags.join(', ')}</td></tr>
                <tr>
                  <td className="font-semibold p-2">{selected.updatedAt && selected.updatedAt !== selected.createdAt ? 'Edited on' : 'Created'}</td>
                  <td className="p-2">{new Date(selected.updatedAt || selected.createdAt).toLocaleString()}</td>
                </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-right">
              <button
                className={primaryButtonClass}
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editMode && editData && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-2xl`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Edit Inquiry</h2>
              <button onClick={() => setEditMode(false)} className={modalCloseButtonClass} aria-label="Close">✕</button>
            </div>
            <CreateInquiryButton
              initialData={editData}
              onSubmit={handleEditSubmit}
              isEdit
              loading={loading}
              onClose={() => setEditMode(false)}
            />
          </div>
        </div>
      )}
      {/* Delete Permission Modal for admissions_officer without approval */}
      {showDelete && !isAdminLike && !hasApproval[String(deleteId)] && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-lg mx-4`}>
            <div className={modalHeaderClass}>
              <div className={modalTitleClass}>Delete Inquiry</div>
              <button className={modalCloseButtonClass} onClick={() => { setShowDelete(false); setDeleteReason('') }} aria-label="Close">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">You cannot delete this item directly. Request temporary delete permission from an Admin or Senior Staff.</p>
              <div>
                <label className={labelClass}>Reason</label>
                <textarea className={textareaClass} rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Provide a short reason"></textarea>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setShowDelete(false); setDeleteReason('') }} className={secondaryButtonClass}>Close</button>
              <button
                onClick={async () => {
                  try {
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                    if (typeof window !== 'undefined') {
                      const t = localStorage.getItem('tenant') || ''
                      if (t) headers['x-tenant'] = t
                    }
                    await fetch(`${WEB_API}/delete-requests`, {
                      method: 'POST',
                      credentials: 'include',
                      headers,
                      body: JSON.stringify({ module: 'inquiries', itemId: deleteId, reason: deleteReason || undefined })
                    })
                    setShowDelete(false)
                    setDeleteReason('')
                    alert('Delete permission request sent to Admins/Senior Staff.')
                  } catch (e) {
                    alert('Failed to send request')
                  }
                }}
                className={primaryButtonClass}
              >
                Request Delete Permission
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation for admins or officers with approval */}
      {showDelete && (isAdminLike || hasApproval[String(deleteId)]) && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-sm`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Delete Inquiry</h2>
              <button className={modalCloseButtonClass} onClick={() => setShowDelete(false)} aria-label="Close">✕</button>
            </div>
            <p className="text-sm">Are you sure you want to delete this inquiry?</p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                className={secondaryButtonClass}
                onClick={() => setShowDelete(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-rose-600 text-white text-sm hover:bg-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={loading}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Chat Widget */}
      {whatsAppOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-80 max-w-full bg-white rounded-lg shadow-lg border border-green-500 p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaWhatsappAny className="h-6 w-6 text-green-600" />
              <span className="font-bold text-green-700">WhatsApp Chat</span>
            </div>
            <button onClick={() => setWhatsAppOpen(false)} className="text-gray-400 hover:text-teal-600 text-2xl font-bold leading-none">×</button>
          </div>
          <div className="mb-2 text-sm text-gray-700">
            <span className="font-semibold">To:</span> {whatsAppName} <br />
            <span className="font-semibold">Number:</span> {whatsAppNumber}
          </div>
          <textarea
            ref={inputRef}
            className="w-full border rounded p-2 mb-2 text-sm"
            rows={4}
            value={whatsAppMsg}
            onChange={e => setWhatsAppMsg(e.target.value)}
          />
          <button
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2"
            onClick={() => {
              window.open(`https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(whatsAppMsg)}`, '_blank');
              setWhatsAppOpen(false);
            }}
          >
            <FaWhatsappAny className="h-5 w-5" /> Send on WhatsApp
          </button>
        </div>
      )}
    </div>
  )
} 