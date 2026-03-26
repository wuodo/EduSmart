'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Followup, FollowupStatus } from '@/types/followup'
import {
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ClockIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline'
import { FaWhatsapp } from 'react-icons/fa'
import * as Popover from '@radix-ui/react-popover'
import ScheduleFollowupButton from './ScheduleFollowupButton'
import FollowupHistoryModal from './FollowupHistoryModal'
import FollowupCommentsModal from './FollowupCommentsModal'
import { WEB_API } from '@/utils/api';
import {
  modalOverlayClass,
  modalPanelClass,
  modalHeaderClass,
  modalTitleClass,
  modalCloseButtonClass,
  formSectionClass,
  formSectionTitleClass,
  labelClass,
  inputClass,
  selectClass,
  textareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/styles/modalForm'

const PencilIcon: any = PencilSquareIcon
const TrashIconAny: any = TrashIcon
const EyeIconAny: any = EyeIcon
const CommentIconAny: any = ChatBubbleOvalLeftEllipsisIcon
const HistoryIconAny: any = ClockIcon
const MoreIconAny: any = EllipsisVerticalIcon

function userHeaders() {
  if (typeof window === 'undefined') return {} as any;
  const tenant = (() => { try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' } })() || localStorage.getItem('tenant') || '';
  return (tenant ? { 'x-tenant': tenant } : {}) as Record<string, string>;
}

interface Props {
  followups: Followup[]
  inquiries: any[]
  onRefresh: () => void
}

export default function FollowupList({ followups, inquiries, onRefresh }: Props) {
  const [selected, setSelected] = useState<Followup | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<any>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNewFollowup, setShowNewFollowup] = useState(false)
  const [newFollowupInquiry, setNewFollowupInquiry] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyInquiry, setHistoryInquiry] = useState<any>(null)
  const [showComments, setShowComments] = useState(false)
  const [commentsFollowupId, setCommentsFollowupId] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Record<string, string | null>>({});
  const [showSuggestion, setShowSuggestion] = useState<Record<string, boolean>>({});
  const [predictions, setPredictions] = useState<Record<string, { outcome: string, action: string }>>({});
  const [showPrediction, setShowPrediction] = useState<Record<string, boolean>>({});
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [templateChoice, setTemplateChoice] = useState<Record<string, string>>({});
  const [showDeletedPanel, setShowDeletedPanel] = useState(false);
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [selectedDeletedArchiveIds, setSelectedDeletedArchiveIds] = useState<string[]>([]);
  const isAdmissionsOfficer = currentRoleLower() === 'admissions_officer';
  const [showAllColumns, setShowAllColumns] = useState(false);
  const showExtraCols = showAllColumns;

  const WHATSAPP_TEMPLATES: { id: string; label: string; body: string }[] = [
    {
      id: 'payment_reminder',
      label: 'Payment reminder',
      body: 'Hi {name}, friendly reminder to complete your registration payment to secure your spot. Reply here if you need help.',
    },
    {
      id: 'schedule_call',
      label: 'Schedule a call',
      body: 'Hi {name}, what time today/tomorrow can I call you to help with registration? You can suggest a time that works for you.',
    },
    {
      id: 'send_details',
      label: 'Send details',
      body: 'Hi {name}, sharing more details as requested. What program are you most interested in, and when would you like to join?',
    },
    {
      id: 'event_invite',
      label: 'Invite to open day',
      body: 'Hi {name}, you are invited to our open day. Would you like the date/time and location details?',
    },
    {
      id: 'final_checkin',
      label: 'Final check-in',
      body: 'Hi {name}, just checking in—are you still interested in proceeding with registration? If not, I can update your record.',
    },
  ];

  function fillTemplate(body: string, vars: Record<string, string>) {
    return body.replace(/\{(\w+)\}/g, (_m, key) => (vars[key] ?? ''));
  }

  function currentRoleLower() {
    if (typeof window === 'undefined') return '';
    const ls = String(localStorage.getItem('userRole') || '').toLowerCase();
    if (ls) return ls;
    try {
      const m = document.cookie.match(/(?:^|; )role=([^;]+)/);
      const c = m ? decodeURIComponent(m[1]) : '';
      return String(c || '').toLowerCase();
    } catch {
      return '';
    }
  }

  function buildWhatsappMessage(inquiry: any, followup: Followup, rec?: string | null) {
    const name = inquiry?.fullName || followup.inquiryName || '';
    const phoneNum = inquiry?.phone?.replace(/[^\d]/g, '');
    const lastContact = followup.scheduledFor ? new Date(followup.scheduledFor).toLocaleDateString() : '';
    const notes = followup.notes || '';
    const paymentStatus = followup.paymentStatus || inquiry?.paymentStatus || '';
    const vars = { name, lastContact, notes, paymentStatus };
    const chosen = templateChoice[followup.inquiryId] || '';
    const template = chosen ? WHATSAPP_TEMPLATES.find(t => t.id === chosen) : null;

    let msg = '';
    if (template) {
      msg = fillTemplate(template.body, vars);
    }

    // Auto message fallback (keeps existing behavior)
    if (!msg) {
      if (followup.status === 'pending') {
        if (paymentStatus !== 'Paid') {
          msg = `Hi ${name}, we noticed you haven’t completed your registration. Please pay your registration fee to secure your spot. If you have any questions, let us know!`;
        } else if (/not reachable|no reply|unreachable|did not reply/i.test(notes)) {
          msg = `Hi ${name}, we tried to reach you on ${lastContact}. Please let us know a convenient time to contact you, or reply to this message.`;
        } else if (notes && notes.length > 0) {
          msg = `Hi ${name}, following up on our last conversation (${notes}). Please let us know if you have any questions, want to set another date to be contacted, or are ready to proceed.`;
        } else {
          msg = `Hi ${name}, just checking in after our last contact on ${lastContact}. Please let us know if you’re ready to proceed, want to set another date to be contacted, or have any questions.`;
        }
      } else if (rec) {
        msg = `Hi ${name}, ${rec}`;
      } else {
        msg = `Hi ${name}, following up on your inquiry. How can we help you today?`;
      }
    }

    return { phoneNum, msg };
  }

  function openWhatsapp(inquiry: any, followup: Followup, rec?: string | null) {
    const { phoneNum, msg } = buildWhatsappMessage(inquiry, followup, rec);
    if (phoneNum) {
      window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(msg)}`);
    } else {
      alert('No valid phone number for WhatsApp.');
    }
  }

  async function loadDeletedItems() {
    setLoadingDeleted(true);
    try {
      const res = await fetch(`${WEB_API}/followups/deleted-recent?limit=30`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { ...userHeaders() },
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to load deleted follow-ups');
      const arr = Array.isArray(data?.items) ? data.items : [];
      setDeletedItems(arr);
      setSelectedDeletedArchiveIds([]);
    } catch (e: any) {
      alert(e?.message || 'Failed to load deleted follow-ups');
      setDeletedItems([]);
    } finally {
      setLoadingDeleted(false);
    }
  }

  async function requestRestore(archiveId: string) {
    try {
      const reason = prompt('Optional reason for restore request:') || '';
      const res = await fetch(`${WEB_API}/delete-requests/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({ archiveId, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to create restore request');
      alert('Restore request sent to superadmin.');
    } catch (e: any) {
      alert(e?.message || 'Failed to request restore');
    }
  }

  async function requestRestoreBulk() {
    if (selectedDeletedArchiveIds.length === 0) return;
    const reason = prompt(`Optional reason for ${selectedDeletedArchiveIds.length} restore request(s):`) || '';
    try {
      let okCount = 0;
      for (const archiveId of selectedDeletedArchiveIds) {
        const res = await fetch(`${WEB_API}/delete-requests/restore`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...userHeaders() },
          body: JSON.stringify({ archiveId, reason: reason || undefined }),
        });
        if (res.ok) okCount++;
      }
      if (okCount === 0) throw new Error('Failed to send restore requests');
      alert(`Sent ${okCount} restore request(s) to superadmin.`);
      setSelectedDeletedArchiveIds([]);
    } catch (e: any) {
      alert(e?.message || 'Failed to send bulk restore requests');
    }
  }

  async function snoozeFollowup(followup: Followup, days: number) {
    setLoading(true);
    try {
      const next = new Date();
      next.setDate(next.getDate() + days);
      const payload: any = {
        inquiryId: followup.inquiryId,
        type: followup.type,
        scheduledFor: next.toISOString(),
        assignedTo: followup.assignedTo,
        notes: followup.notes,
        status: 'rescheduled',
        paymentStatus: followup.paymentStatus,
        paymentCode: followup.paymentCode,
        paymentDate: followup.paymentDate,
        createdBy: followup.createdBy,
      };
      const res = await fetch(`${WEB_API}/followups/${followup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        alert('Failed to snooze follow-up: ' + (result.error || result.message || res.status));
        return;
      }
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function completeAndScheduleNext(followup: Followup, daysToNext: number) {
    setLoading(true);
    try {
      // 1) Mark current completed
      const completePayload: any = {
        inquiryId: followup.inquiryId,
        type: followup.type,
        scheduledFor: new Date(followup.scheduledFor).toISOString(),
        assignedTo: followup.assignedTo,
        notes: followup.notes,
        status: 'completed',
        completedAt: new Date().toISOString(),
        paymentStatus: followup.paymentStatus,
        paymentCode: followup.paymentCode,
        paymentDate: followup.paymentDate,
        createdBy: followup.createdBy,
      };
      const res1 = await fetch(`${WEB_API}/followups/${followup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify(completePayload),
      });
      if (!res1.ok) {
        const result = await res1.json().catch(() => ({}));
        alert('Failed to complete follow-up: ' + (result.error || result.message || res1.status));
        return;
      }

      // 2) Create next follow-up
      const next = new Date();
      next.setDate(next.getDate() + daysToNext);
      const res2 = await fetch(`${WEB_API}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify({
          inquiryId: followup.inquiryId,
          type: followup.type,
          scheduledFor: next.toISOString(),
          status: 'pending',
          assignedTo: followup.assignedTo,
          notes: '',
          createdBy: followup.createdBy,
        }),
      });
      if (!res2.ok) {
        const txt = await res2.text().catch(() => '');
        alert('Completed follow-up, but failed to schedule next: ' + (txt || res2.status));
        onRefresh();
        return;
      }
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  // Sort followups by scheduledFor (earliest first)
  const sorted = [...followups].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  )

  // Show only the latest follow-up per inquiry
  const latestFollowupsMap = new Map<string, Followup>()
  for (const f of sorted) {
    const existing = latestFollowupsMap.get(f.inquiryId)
    if (!existing || new Date(f.scheduledFor) > new Date(existing.scheduledFor)) {
      latestFollowupsMap.set(f.inquiryId, f)
    }
  }
  const latestFollowups = Array.from(latestFollowupsMap.values())

  // Status color mapping
  const statusColors: Record<FollowupStatus, string> = {
    pending: 'bg-amber-500 text-white',
    completed: 'bg-emerald-500 text-white',
    rescheduled: 'bg-sky-500 text-white',
    cancelled: 'bg-gray-500 text-white',
  }

  // Edit handler
  const handleEdit = (followup: Followup) => {
    setEditData({
      inquiryId: followup.inquiryId,
      type: followup.type,
      scheduledFor: new Date(followup.scheduledFor),
      assignedTo: followup.assignedTo,
      notes: followup.notes,
      status: followup.status,
      paymentStatus: followup.paymentStatus,
      paymentCode: followup.paymentCode,
      paymentDate: followup.paymentDate,
    })
    setEditMode(true)
    setSelected(followup)
  }

  const handleEditSubmit = async (data: any) => {
    if (!selected) return
    setLoading(true)
    const payload = {
      ...data,
      scheduledFor: data.scheduledFor ? (typeof data.scheduledFor === 'string' ? data.scheduledFor : data.scheduledFor.toISOString()) : undefined,
      paymentDate: data.paymentDate ? (typeof data.paymentDate === 'string' ? data.paymentDate : data.paymentDate.toISOString()) : undefined,
      createdBy: selected.createdBy,
    }
    try {
      const res = await fetch(`${WEB_API}/followups/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...userHeaders() },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) {
        alert('Failed to save follow-up: ' + (result.error || result.message || res.status))
        setLoading(false)
        return
      }

      // Audit: follow-up completed
      try {
        if (payload.status === 'completed' && selected.status !== 'completed') {
          const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || localStorage.getItem('userName') || '') : ''
          await fetch('/api/marketing/settings/audit-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'complete_followup',
              module: 'marketing',
              user: userEmail,
              details: { followupId: selected.id, inquiryId: payload.inquiryId, type: payload.type, completedAt: payload.completedAt || new Date().toISOString() }
            })
          })
        }
      } catch {}

      setEditMode(false)
      setEditData(null)
      setSelected(null)
      setLoading(false)
      onRefresh()
    } catch (err) {
      console.error('Error saving follow-up:', err)
      alert('Error saving follow-up: ' + err)
      setLoading(false)
    }
  }

  // Delete handler
  const handleDelete = async () => {
    if (!deleteId) return
    setLoading(true)
    await fetch(`${WEB_API}/followups/${deleteId}`, {
      method: 'DELETE',
      headers: { ...userHeaders() }
    })
    setShowDelete(false)
    setDeleteId(null)
    setLoading(false)
    onRefresh()
  }
  // Load approvals for this officer so we can enable delete when approved
  useEffect(() => {
    const loadApprovals = async () => {
      try {
        const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        if (!email) return
        const res = await fetch(`${WEB_API}/approvals?officerEmail=${encodeURIComponent(email)}`)
        const data = await res.json()
        if (Array.isArray(data?.approvals)) {
          const map: Record<string, boolean> = {}
          for (const a of data.approvals) {
            if (a?.module === 'followups' && a?.status === 'approved') {
              map[String(a.itemId)] = true
            }
          }
          setApprovals(map)
        }
      } catch {}
    }
    loadApprovals()
    const interval = setInterval(loadApprovals, 5000)
    return () => clearInterval(interval)
  }, [])

  // Refresh approvals whenever the delete modal opens for a specific item
  useEffect(() => {
    if (!showDelete || !deleteId) return
    const refresh = async () => {
      try {
        const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        if (!email) return
        const res = await fetch(`${WEB_API}/approvals?officerEmail=${encodeURIComponent(email)}`)
        const data = await res.json()
        if (Array.isArray(data?.approvals)) {
          const map: Record<string, boolean> = {}
          for (const a of data.approvals) {
            if (a?.module === 'followups' && a?.status === 'approved') {
              map[String(a.itemId)] = true
            }
          }
          setApprovals(map)
        }
      } catch {}
    }
    refresh()
  }, [showDelete, deleteId])

  // Fetch recommendations for each latest follow-up
  useEffect(() => {
    async function fetchRecommendations() {
      const recs: Record<string, string | null> = {};
      for (const f of latestFollowups) {
        try {
          const res = await fetch(`${WEB_API}/followups/${f.inquiryId}/recommendation`, { headers: { ...userHeaders() } });
          const data = await res.json();
          recs[f.inquiryId] = data.recommendation || null;
        } catch {
          recs[f.inquiryId] = null;
        }
      }
      setRecommendations(recs);
    }
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followups]);

  // Fetch predictions for each latest follow-up
  useEffect(() => {
    async function fetchPredictions() {
      const preds: Record<string, { outcome: string, action: string }> = {};
      for (const f of latestFollowups) {
        try {
          const res = await fetch(`${WEB_API}/followups/${f.inquiryId}/prediction`, { headers: { ...userHeaders() } });
          const data = await res.json();
          preds[f.inquiryId] = data;
        } catch {
          preds[f.inquiryId] = { outcome: 'Unknown', action: 'No prediction available' };
        }
      }
      setPredictions(preds);
    }
    fetchPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followups]);

  return (
    <div>
      {showDeletedPanel && (
        <div className="mb-3 border rounded bg-amber-50/40">
          <div className="px-3 py-2 text-xs font-semibold border-b">Recently Deleted Follow-ups</div>
          {loadingDeleted ? (
            <div className="px-3 py-2 text-xs text-gray-600">Loading...</div>
          ) : deletedItems.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-600">No recently deleted follow-ups.</div>
          ) : (
            <div className="divide-y">
              <div className="px-3 py-2 text-xs flex items-center justify-between bg-amber-100/40">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deletedItems.length > 0 && selectedDeletedArchiveIds.length === deletedItems.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDeletedArchiveIds(deletedItems.map((x) => String(x.archiveId)));
                      else setSelectedDeletedArchiveIds([]);
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
                        const id = String(item.archiveId);
                        setSelectedDeletedArchiveIds((prev) => e.target.checked ? [...prev, id] : prev.filter((x) => x !== id));
                      }}
                    />
                    <div>
                    <div className="font-semibold truncate">{item.inquiryName || `Follow-up #${item.id}`}</div>
                    <div className="text-gray-600 truncate">
                      {item.type || '-'} • {item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : '-'} • Deleted {new Date(item.deletedAt).toLocaleString()}
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
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] text-gray-600">
          {showExtraCols ? 'Showing all columns' : 'Compact view (essential columns)'}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const next = !showDeletedPanel;
              setShowDeletedPanel(next);
              if (next) await loadDeletedItems();
            }}
            className="px-3 py-1 text-[12px] border border-gray-200 bg-white hover:bg-gray-50"
          >
            {showDeletedPanel ? 'Hide Recently Deleted' : 'Restore Recently Deleted'}
          </button>
          <button
            className="px-3 py-1 text-[12px] border border-gray-200 bg-white hover:bg-gray-50"
            onClick={() => setShowAllColumns(v => !v)}
            type="button"
          >
            {showExtraCols ? 'Hide extra columns' : 'Show extra columns'}
          </button>
        </div>
      </div>
      <table className="min-w-full border-separate border-spacing-0 text-[13px]">
        <thead className="bg-gray-50/80">
          <tr>
            <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm py-2 pl-3 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 sm:pl-4 lg:pl-6">
              #
            </th>
            <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
              Student
            </th>
            <th
              scope="col"
              className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${
                showExtraCols ? 'hidden md:table-cell' : 'hidden'
              }`}
            >
              Phone
            </th>
            <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
              Type
            </th>
            <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
              Date
            </th>
            <th
              scope="col"
              className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${
                showExtraCols ? 'hidden lg:table-cell' : 'hidden'
              }`}
            >
              Notes
            </th>
            <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800">
              Status
            </th>
            <th
              scope="col"
              className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${
                showExtraCols ? 'hidden xl:table-cell' : 'hidden'
              }`}
            >
              Payment
            </th>
            <th
              className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${
                showExtraCols ? 'hidden lg:table-cell' : 'hidden'
              }`}
            >
              Suggestion
            </th>
            <th
              className={`sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 ${
                showExtraCols ? 'hidden lg:table-cell' : 'hidden'
              }`}
            >
              Prediction
            </th>
            <th scope="col" className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/90 backdrop-blur-sm py-2 pl-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-teal-800 sm:pr-4 lg:pr-6">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {latestFollowups.map((followup, index) => {
            const inquiry = inquiries.find(i => i.id === followup.inquiryId);
            const phone = inquiry ? inquiry.phone : '';
            const rec = recommendations[followup.inquiryId];
            const isSuggestionOpen = showSuggestion[followup.inquiryId] || false;
            const prediction = predictions[followup.inquiryId];
            const isPredictionOpen = showPrediction[followup.inquiryId] || false;
            return (
              <>
                <tr key={followup.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-3 pr-2 text-[13px] text-gray-700 sm:pl-4 lg:pl-6">
                    <button className="mr-2 md:hidden text-gray-600" title="Expand" onClick={() => setExpanded(prev => ({ ...prev, [followup.id]: !prev[followup.id] }))}>{expanded[followup.id] ? '▾' : '▸'}</button>
                    {index + 1}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] font-medium text-gray-800">
                    {followup.inquiryName}
                  </td>
                  <td
                    className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 ${
                      showExtraCols ? 'hidden md:table-cell' : 'hidden'
                    }`}
                  >
                    {phone}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                    {followup.type}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700">
                    {new Date(followup.scheduledFor).toLocaleDateString()} {new Date(followup.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td
                    className={`border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 max-w-[200px] truncate ${
                      showExtraCols ? 'hidden lg:table-cell' : 'hidden'
                    }`}
                  >
                    {followup.notes}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-2 py-1.5">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[followup.status]}`}>
                      {followup.status}
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-[13px] text-gray-700 ${
                      showExtraCols ? 'hidden xl:table-cell' : 'hidden'
                    }`}
                  >
                    {followup.paymentStatus || 'Not Paid'}
                  </td>
                  <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-sm ${showExtraCols ? 'hidden lg:table-cell' : 'hidden'}`}>
                    <button
                      className={`px-2 py-1 rounded ${isSuggestionOpen ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'} hover:bg-blue-200 disabled:opacity-50`}
                      onClick={() => {
                        if (rec) {
                          setShowSuggestion(prev => ({ ...prev, [followup.inquiryId]: !isSuggestionOpen }));
                        } else {
                          alert('No suggestion available for this lead.');
                        }
                      }}
                      disabled={!rec}
                    >
                      {isSuggestionOpen ? 'Hide Suggestion' : 'Show Suggestion'}
                    </button>
                  </td>
                  <td className={`whitespace-nowrap border-b border-gray-100 px-2 py-1.5 text-sm ${showExtraCols ? 'hidden lg:table-cell' : 'hidden'}`}>
                    {prediction && (
                      <button
                        className={`px-2 py-1 rounded ${isPredictionOpen ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-800'} hover:bg-teal-200`}
                        onClick={() => setShowPrediction(prev => ({ ...prev, [followup.inquiryId]: !isPredictionOpen }))}
                      >
                        {isPredictionOpen ? 'Hide Prediction' : 'Show Prediction'}
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 py-1.5 pl-2 pr-3 text-right text-[13px] font-medium sm:pr-4 lg:pl-6">
                    <div className="inline-flex flex-nowrap items-center justify-end gap-1 align-middle">
                      {/* WhatsApp icon button */}
                      <button
                        disabled={loading}
                        className="p-1 border border-green-200 text-green-800 hover:bg-green-50"
                        title="WhatsApp"
                        onClick={() => openWhatsapp(inquiry, followup, recommendations[followup.inquiryId])}
                      >
                        <span className="sr-only">WhatsApp</span>
                        <FaWhatsapp className="h-4 w-4" />
                      </button>

                      {/* Comments icon */}
                      <button
                        onClick={() => {
                          setCommentsFollowupId(followup.id)
                          setShowComments(true)
                        }}
                        className="p-1 border border-purple-200 text-purple-800 hover:bg-purple-50"
                        title="Comments"
                      >
                        <CommentIconAny className="h-4 w-4" />
                      </button>

                      {/* History icon */}
                      <button
                        onClick={() => {
                          setHistoryInquiry(followup.inquiryId)
                          setShowHistory(true)
                        }}
                        className="p-1 border border-indigo-200 text-indigo-800 hover:bg-indigo-50"
                        title="History"
                      >
                        <HistoryIconAny className="h-4 w-4" />
                      </button>

                      {/* View + Edit icons */}
                      <button
                        onClick={() => {
                          setSelected(followup)
                          setShowModal(true)
                        }}
                        className="p-1 border border-gray-200 text-slate-700 hover:bg-gray-50"
                        title="View"
                      >
                        <EyeIconAny className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(followup)}
                        className="p-1 border border-teal-200 text-teal-800 hover:bg-teal-50"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>

                      {/* More actions menu (snooze, template, complete+next) */}
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className="p-1 border border-gray-200 text-gray-700 hover:bg-gray-50"
                            title="More actions"
                          >
                            <MoreIconAny className="h-4 w-4" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            sideOffset={6}
                            align="end"
                            className="z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg p-2 text-left"
                          >
                            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 px-2 py-1">
                              Quick actions
                            </div>

                            {(followup.status === 'pending' || followup.status === 'rescheduled') && (
                              <div className="px-2 py-1">
                                <div className="text-[11px] font-semibold text-gray-700 mb-1">Snooze</div>
                                <div className="flex gap-2">
                                  <button
                                    disabled={loading}
                                    className="px-2 py-1 text-[12px] border border-gray-200 hover:bg-gray-50"
                                    onClick={() => snoozeFollowup(followup, 1)}
                                  >
                                    +1 day
                                  </button>
                                  <button
                                    disabled={loading}
                                    className="px-2 py-1 text-[12px] border border-gray-200 hover:bg-gray-50"
                                    onClick={() => snoozeFollowup(followup, 3)}
                                  >
                                    +3 days
                                  </button>
                                  <button
                                    disabled={loading}
                                    className="px-2 py-1 text-[12px] border border-gray-200 hover:bg-gray-50"
                                    onClick={() => snoozeFollowup(followup, 7)}
                                  >
                                    +7 days
                                  </button>
                                </div>
                              </div>
                            )}

                            {followup.status !== 'completed' && (
                              <div className="px-2 py-1">
                                <button
                                  disabled={loading}
                                  className="w-full px-2 py-1.5 text-[12px] border border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-left"
                                  onClick={() => completeAndScheduleNext(followup, 3)}
                                >
                                  Complete + schedule next (3 days)
                                </button>
                              </div>
                            )}

                            <div className="px-2 py-1">
                              <div className="text-[11px] font-semibold text-gray-700 mb-1">WhatsApp template</div>
                              <select
                                className="w-full px-2 py-1 text-[12px] border border-gray-200 bg-white"
                                value={templateChoice[followup.inquiryId] || ''}
                                onChange={e => setTemplateChoice(prev => ({ ...prev, [followup.inquiryId]: e.target.value }))}
                              >
                                <option value="">Auto</option>
                                {WHATSAPP_TEMPLATES.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                              <div className="mt-2">
                                <button
                                  disabled={loading}
                                  className="w-full px-2 py-1.5 text-[12px] border border-green-200 text-green-800 hover:bg-green-50 text-left"
                                  onClick={() => openWhatsapp(inquiry, followup, recommendations[followup.inquiryId])}
                                >
                                  Send WhatsApp now
                                </button>
                              </div>
                            </div>

                            <Popover.Arrow className="fill-white" />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>

                    {(() => {
                      const role = currentRoleLower()
                      const canDeleteByApproval = approvals[String(followup.id)]
                      const isAdminLike = role === 'admin' || role === 'senior_staff'
                      const cls = (isAdminLike || canDeleteByApproval) ? 'p-1 border border-rose-200 text-rose-700 hover:bg-rose-50' : 'p-1 border border-gray-200 text-gray-400'
                      return (
                        <button
                          onClick={() => {
                            setDeleteId(followup.id)
                            setShowDelete(true)
                          }}
                          className={cls}
                          title="Delete Follow-up"
                        >
                          <TrashIconAny className="h-4 w-4" />
                        </button>
                      )
                    })()}
                    </div>
                  </td>
                </tr>
                {expanded[followup.id] && (
                  <tr className="md:hidden">
                    <td colSpan={11} className="px-4 py-3 bg-gray-50 border-b text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-gray-500">Phone:</span> {phone}</div>
                        <div><span className="text-gray-500">Notes:</span> {followup.notes || '-'}</div>
                        <div><span className="text-gray-500">Status:</span> {followup.status}</div>
                        <div><span className="text-gray-500">Payment:</span> {followup.paymentStatus || 'Not Paid'}</div>
                      </div>
                    </td>
                  </tr>
                )}
                {rec && isSuggestionOpen && (
                  <tr>
                    <td colSpan={11} className="bg-blue-50 text-blue-900 px-4 py-2 border-b border-blue-200">
                      <div className="flex items-center justify-between">
                        <span><strong>Nurturing Suggestion:</strong> {rec}</span>
                        <button
                          className="ml-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          onClick={() => {
                            openWhatsapp(inquiry, followup, rec);
                          }}
                        >
                          Send via WhatsApp
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-blue-800">Template</span>
                        <select
                          className="px-2 py-1 border border-blue-200 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-300"
                          value={templateChoice[followup.inquiryId] || ''}
                          onChange={e => setTemplateChoice(prev => ({ ...prev, [followup.inquiryId]: e.target.value }))}
                        >
                          <option value="">Auto (default)</option>
                          {WHATSAPP_TEMPLATES.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                )}
                {predictions[followup.inquiryId] && isPredictionOpen && (
                  <tr>
                    <td colSpan={11} className="bg-teal-50 text-teal-900 px-4 py-2 border-b border-teal-200">
                      <div className="flex items-center justify-between">
                        <span><strong>Prediction:</strong> {prediction.outcome} <span className="ml-4 font-semibold">Action:</span> {prediction.action}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
      {latestFollowups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No follow-ups found.
        </div>
      )}

      {/* View Modal */}
      {showModal && selected && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-lg`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Follow-up Details</h2>
              <button onClick={() => setShowModal(false)} className={modalCloseButtonClass} aria-label="Close">✕</button>
            </div>
            <table className="w-full text-sm border border-neutral-light">
              <tbody>
                <tr>
                  <td className="font-semibold p-2 w-1/3">Inquiry</td>
                  <td className="p-2">{selected.inquiryName}</td>
                </tr>
                <tr>
                  <td className="font-semibold p-2">Type</td>
                  <td className="p-2">
                    {selected.type.charAt(0).toUpperCase() + selected.type.slice(1)}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold p-2">Scheduled For</td>
                  <td className="p-2">{format(new Date(selected.scheduledFor), 'PPpp')}</td>
                </tr>
                <tr>
                  <td className="font-semibold p-2">Status</td>
                  <td className="p-2">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        statusColors[selected.status]
                      }`}
                    >
                      {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold p-2">Assigned To</td>
                  <td className="p-2">{selected.assignedTo}</td>
                </tr>
                {selected.notes && (
                  <tr>
                    <td className="font-semibold p-2">Notes</td>
                    <td className="p-2">{selected.notes}</td>
                  </tr>
                )}
                {selected.completedAt && (
                  <tr>
                    <td className="font-semibold p-2">Completed At</td>
                    <td className="p-2">{format(new Date(selected.completedAt), 'PPpp')}</td>
                  </tr>
                )}
                <tr>
                  <td className="font-semibold p-2">Created</td>
                  <td className="p-2">{format(new Date(selected.createdAt), 'PPpp')}</td>
                </tr>
                <tr>
                  <td className="font-semibold p-2">Created By</td>
                  <td className="p-2">{selected.createdBy}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editMode && editData && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-2xl`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Edit Follow-up</h2>
              <button onClick={() => setEditMode(false)} className={modalCloseButtonClass} aria-label="Close">✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleEditSubmit(editData); }} className="space-y-8">
              {/* Inquiry Details */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Inquiry Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Inquiry ID</label>
                    <input
                      type="text"
                      value={editData.inquiryId}
                      readOnly
                      className={`${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed select-none`}
                    />
                  </div>
                  {!isAdmissionsOfficer && (
                    <div>
                      <label className={labelClass}>Assigned To</label>
                      <input
                        type="text"
                        value={editData.assignedTo}
                        onChange={e => setEditData({ ...editData, assignedTo: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up Details */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Follow-up Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Type *</label>
                    <select
                      value={editData.type}
                      onChange={e => setEditData({ ...editData, type: e.target.value })}
                      className={selectClass}
                      required
                    >
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status *</label>
                    <select
                      value={editData.status}
                      onChange={e => setEditData({ ...editData, status: e.target.value })}
                      className={selectClass}
                      required
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Scheduled For{['completed','cancelled'].includes(editData.status) ? '' : ' *'}</label>
                    <input
                      type="datetime-local"
                      value={editData.scheduledFor ? (typeof editData.scheduledFor === 'string' ? editData.scheduledFor.slice(0, 16) : new Date(editData.scheduledFor).toISOString().slice(0, 16)) : ''}
                      onChange={e => setEditData({ ...editData, scheduledFor: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                      className={inputClass}
                      required={!['completed','cancelled'].includes(editData.status)}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Section (if completed) */}
              {editData.status === 'completed' && (
                <div className={formSectionClass}>
                  <h4 className={formSectionTitleClass}>Payment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className={labelClass}>Payment Status *</label>
                      <select
                        value={editData.paymentStatus || ''}
                        onChange={e => setEditData({ ...editData, paymentStatus: e.target.value })}
                        className={selectClass}
                        required
                      >
                        <option value="">Select Payment Status</option>
                        <option value="Paid">Paid</option>
                        <option value="Not Paid">Not Paid</option>
                      </select>
                    </div>
                    {editData.paymentStatus === 'Paid' && (
                      <>
                        <div>
                          <label className={labelClass}>Mpesa Payment Code *</label>
                          <input
                            type="text"
                            value={editData.paymentCode || ''}
                            onChange={e => setEditData({ ...editData, paymentCode: e.target.value })}
                            className={inputClass}
                            required
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Date of Payment *</label>
                          <input
                            type="date"
                            value={editData.paymentDate ? (typeof editData.paymentDate === 'string' ? editData.paymentDate.split('T')[0] : new Date(editData.paymentDate).toISOString().split('T')[0]) : ''}
                            onChange={e => setEditData({ ...editData, paymentDate: new Date(e.target.value).toISOString() })}
                            className={inputClass}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              <div className={formSectionClass}>
                <h4 className={formSectionTitleClass}>Notes</h4>
                <textarea
                  value={editData.notes}
                  onChange={e => setEditData({ ...editData, notes: e.target.value })}
                  className={textareaClass}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation / Permission Request */}
      {showDelete && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-md`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Delete Follow-up</h2>
              <button className={modalCloseButtonClass} onClick={() => { setShowDelete(false); setDeleteReason('') }} aria-label="Close">✕</button>
            </div>
            <p className="text-sm text-gray-700 mb-4">Admins and Senior Staff can delete directly. Admissions Officers must request permission.</p>
            <div className="space-y-3">
              <label className={labelClass}>Reason</label>
              <textarea className={textareaClass} rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Provide a short reason" />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowDelete(false); setDeleteReason('') }}
                disabled={loading}
                className={secondaryButtonClass}
              >
                Close
              </button>
              {(() => {
                const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
                const isAdminLike = role === 'admin' || role === 'senior_staff' || role === 'super_admin'
                const canDeleteByApproval = deleteId ? approvals[String(deleteId)] : false
                const canDelete = (isAdminLike || canDeleteByApproval)
                const btnClass = `${canDelete ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500' : 'bg-gray-400'} px-4 py-2 text-white text-sm focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed`
                return (
                  <button
                    className={btnClass}
                onClick={async () => {
                  const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
                  const isAdminLike = role === 'admin' || role === 'senior_staff' || role === 'super_admin'
                  const canDeleteByApproval = deleteId ? approvals[String(deleteId)] : false
                  if (isAdminLike || canDeleteByApproval) {
                    await handleDelete()
                    return
                  }
                  // Only admissions officers are allowed to request delete permission
                  if (role !== 'admissions_officer') {
                    alert('You do not have permission to request deletion. Please contact an Admin/Senior Staff.')
                    return
                  }
                  try {
                    await fetch(`${WEB_API}/delete-requests`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ module: 'followups', itemId: deleteId, reason: deleteReason || undefined })
                    })
                    setShowDelete(false)
                    setDeleteReason('')
                    alert('Delete permission request sent to Admins/Senior Staff.')
                  } catch (e) {
                    alert('Failed to send request')
                  }
                }}
                disabled={loading}
              >
                {(() => {
                  const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
                  const isAdminLike = role === 'admin' || role === 'senior_staff' || role === 'super_admin'
                  const canDeleteByApproval = deleteId ? approvals[String(deleteId)] : false
                  return (isAdminLike || canDeleteByApproval) ? 'Delete' : 'Request Delete Permission'
                })()}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* New Follow-up Modal */}
      {showNewFollowup && newFollowupInquiry && (
        <div className={modalOverlayClass}>
          <div className={`${modalPanelClass} max-w-lg`}>
            <div className={modalHeaderClass}>
              <h2 className={modalTitleClass}>Schedule New Follow-up</h2>
              <button onClick={() => setShowNewFollowup(false)} className={modalCloseButtonClass} aria-label="Close">✕</button>
            </div>
            <ScheduleFollowupButton
              inquiries={inquiries}
              initialData={{ inquiryId: newFollowupInquiry.inquiryId, type: 'call', scheduledFor: new Date(), assignedTo: '', notes: '' }}
              onSubmit={async (data) => {
                await fetch(`${WEB_API}/followups`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...userHeaders() },
                  body: JSON.stringify({ ...data, createdBy: 'admin' }),
                })
                setShowNewFollowup(false)
                setNewFollowupInquiry(null)
                onRefresh()
              }}
              onClose={() => setShowNewFollowup(false)}
              isEdit={false}
              loading={loading}
              noModal
            />
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && historyInquiry && (
        <FollowupHistoryModal
          inquiryId={historyInquiry}
          allFollowups={followups}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Comments Modal */}
      {showComments && commentsFollowupId && (
        <FollowupCommentsModal
          followupId={commentsFollowupId}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
    </div>
  )
} 