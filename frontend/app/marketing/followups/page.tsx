'use client';

import { useMarketingData } from '@/hooks/useMarketingData';
import FollowupList from '@/components/marketing/FollowupList';
import FollowupStatsCards from '@/components/marketing/FollowupStatsCards';
import ScheduleFollowupButton from '@/components/marketing/ScheduleFollowupButton';
// import { API_BASE_URL } from '@/utils/api';
import { useEffect, useState } from 'react';
import { WEB_API } from '@/utils/api';
import { usePermissions } from '../settings/PermissionsContext'

export default function FollowupsPage() {
  const { inquiries, followups, loading, refreshFollowups } = useMarketingData();
  const perms = usePermissions()
  const canView = perms?.canView?.('followups') ?? true
  const canEdit = perms?.canEdit?.('followups') ?? true

  // Filter/search state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [owner, setOwner] = useState('');
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatSourceInfo, setChatSourceInfo] = useState<{ inquiryId: string; inquiryName: string; chatRoomId: string } | null>(null)
  const [focusInquiryId, setFocusInquiryId] = useState('')
  const inputClass =
    'w-full min-w-0 px-2 py-1.5 text-[13px] border border-neutral-light bg-white/90 dark:bg-gray-700/90 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40'
  const selectClass = inputClass

  useEffect(() => {
    const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
    const admin = role === 'admin' || role === 'senior_staff'
    setIsAdmin(admin)
    if (admin) {
      fetch(`${WEB_API}/users`, { cache: 'no-store' })
        .then(r => r.json())
        .then((users: any[]) => {
          const list = users
            .filter(u => (u.role === 'admissions_officer' || u.role === 'senior_staff' || u.role === 'admin'))
            .map(u => ({ label: (u.name && String(u.name).trim()) ? String(u.name) : String(u.email), value: String(u.email) }))
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

  useEffect(() => {
    if (isAdmin) refreshFollowups(owner || undefined)
  }, [owner, isAdmin])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const qs = new URLSearchParams(window.location.search)
    const source = (qs.get('source') || '').trim()
    if (source === 'chat_tag') {
      setChatSourceInfo({
        inquiryId: qs.get('inquiryId') || '',
        inquiryName: qs.get('inquiryName') || '',
        chatRoomId: qs.get('chatRoomId') || '',
      })
    }
    const inq = (qs.get('inquiryId') || '').trim()
    if (inq) setFocusInquiryId(inq)

    const st = (qs.get('status') || '').trim()
    if (st) setStatus(st)
    const ty = (qs.get('type') || '').trim()
    if (ty) setType(ty)
    const q = (qs.get('q') || qs.get('search') || '').trim()
    if (q) setSearch(q)
    const focus = (qs.get('focus') || '').trim()
    if (focus === 'overdue') {
      setOverdueOnly(true)
      if (!st) setStatus('pending')
    }
  }, [])

  // This function will be called when scheduling a followup
  const handleAddFollowup = async (data: any) => {
    const res = await fetch(`${WEB_API}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, createdBy: 'admin' }),
    });
    if (!res.ok) {
      const error = await res.text();
      alert('Failed to schedule followup: ' + error);
      return;
    }
    try {
      const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || localStorage.getItem('userName') || '') : '';
      await fetch('/api/marketing/settings/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_followup', module: 'marketing', user: userEmail, details: { inquiryId: data.inquiryId, type: data.type, scheduledFor: data.scheduledFor } })
      });
    } catch {}
    await refreshFollowups();
  };

  // Filtering logic
  const filteredFollowups = followups.filter(f => {
    if (focusInquiryId && String(f.inquiryId) !== focusInquiryId) return false
    const matchesStatus = !status || f.status === status;
    const matchesType = !type || f.type === type;
    const matchesOverdue =
      !overdueOnly ||
      (String(f.status || '').toLowerCase() === 'pending' && new Date(f.scheduledFor).getTime() < Date.now())
    const searchLower = search.toLowerCase();
    const inquiry = inquiries.find(i => i.id === f.inquiryId);
    const phone = inquiry ? inquiry.phone : '';
    const matchesSearch = !search ||
      (f.inquiryName && f.inquiryName.toLowerCase().includes(searchLower)) ||
      (phone && phone.toLowerCase().includes(searchLower)) ||
      (f.notes && f.notes.toLowerCase().includes(searchLower));
    return matchesStatus && matchesType && matchesOverdue && matchesSearch;
  });

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">WELCOME TO EDUSMART</h2>
          <p className="text-gray-500 dark:text-gray-400">Your current role does not have access to this section.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold">Follow-ups</h1>
        {canEdit && (
          <ScheduleFollowupButton
            inquiries={inquiries}
            onSubmit={handleAddFollowup}
          />
        )}
      </div>
      {/* Action-oriented quick nav */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`px-3 py-2 rounded-md border text-[13px] font-semibold ${
            overdueOnly ? 'bg-amber-600 border-amber-700 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title="Show overdue pending follow-ups"
          onClick={() => {
            setOverdueOnly(true)
            setStatus((s) => (s ? s : 'pending'))
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.searchParams.set('focus', 'overdue')
              url.searchParams.set('status', 'pending')
              window.history.replaceState({}, '', url.pathname + `?${url.searchParams.toString()}`)
            }
          }}
        >
          Overdue
        </button>
        <button
          type="button"
          className={`px-3 py-2 rounded-md border text-[13px] font-semibold ${
            !overdueOnly && status === 'pending' ? 'bg-teal-600 border-teal-700 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title="Show all pending follow-ups"
          onClick={() => {
            setOverdueOnly(false)
            setStatus('pending')
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.searchParams.delete('focus')
              url.searchParams.set('status', 'pending')
              window.history.replaceState({}, '', url.pathname + `?${url.searchParams.toString()}`)
            }
          }}
        >
          Pending
        </button>
        <button
          type="button"
          className={`px-3 py-2 rounded-md border text-[13px] font-semibold ${
            status === 'completed' ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title="Show completed follow-ups"
          onClick={() => {
            setOverdueOnly(false)
            setStatus('completed')
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.searchParams.delete('focus')
              url.searchParams.set('status', 'completed')
              window.history.replaceState({}, '', url.pathname + `?${url.searchParams.toString()}`)
            }
          }}
        >
          Completed
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-md border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[13px] font-semibold"
          title="Clear focus and filters"
          onClick={() => {
            setOverdueOnly(false)
            setStatus('')
            setType('')
            setSearch('')
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.search = ''
              window.history.replaceState({}, '', url.pathname)
            }
          }}
        >
          Clear
        </button>
      </div>
      {chatSourceInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/25 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-3 py-2 rounded text-sm">
          Opened from tagged chat inquiry{chatSourceInfo.inquiryName ? `: ${chatSourceInfo.inquiryName}` : ''}. Actions here are logged to your account audit trail.
        </div>
      )}
      {overdueOnly && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-3 py-2 rounded text-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing <strong>overdue</strong> follow-ups (pending and scheduled before now): <strong>{filteredFollowups.length}</strong>
          </span>
          <button
            type="button"
            className="text-[12px] font-semibold px-2 py-1 rounded border border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={() => {
              setOverdueOnly(false)
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href)
                url.searchParams.delete('focus')
                const q = url.searchParams.toString()
                window.history.replaceState({}, '', url.pathname + (q ? `?${q}` : ''))
              }
            }}
          >
            Show all
          </button>
        </div>
      )}
      {focusInquiryId && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-3 py-2 rounded text-sm flex flex-wrap items-center justify-between gap-2">
          <span>Showing follow-ups for inquiry <strong>#{focusInquiryId}</strong>.</span>
          <button
            type="button"
            className="text-[12px] font-semibold px-2 py-1 rounded border border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={() => {
              setFocusInquiryId('')
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href)
                url.searchParams.delete('inquiryId')
                const q = url.searchParams.toString()
                window.history.replaceState({}, '', url.pathname + (q ? `?${q}` : ''))
              }
            }}
          >
            Show all follow-ups
          </button>
        </div>
      )}

      <FollowupStatsCards followups={followups} staffEmail={owner || undefined} tenantWide={isAdmin && !owner} />
      
      <div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="p-3 sm:p-4 border-b border-neutral-light">
          <div className="flex flex-wrap md:flex-nowrap md:items-center gap-2">
            <div className="flex-[1] min-w-[160px]">
              <input
                type="text"
                placeholder="Search follow-ups..."
                className={inputClass}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap md:flex-nowrap gap-2 items-center flex-[2] min-w-[200px]">
              <select
                className={selectClass}
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                className={selectClass}
                value={type}
                onChange={e => setType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="meeting">Meeting</option>
              </select>
              {isAdmin && owners.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600 px-2 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-yellow-800">Owner</span>
                  <select
                    className="px-2 py-1 border border-yellow-300 dark:border-yellow-600 bg-white dark:bg-gray-700 text-[13px] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                  >
                    <option value="">All Owners</option>
                    {owners.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <FollowupList
            followups={filteredFollowups}
            inquiries={inquiries}
            onRefresh={refreshFollowups}
          />
        </div>
      </div>
    </div>
  );
} 