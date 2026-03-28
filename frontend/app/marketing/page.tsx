'use client'

import { useMarketingData } from '@/hooks/useMarketingData'
import { Bar, Pie, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js'
import {
  ArrowPathIcon,
  PlusIcon,
  UsersIcon,
  PhoneIcon,
  ChartBarIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { WEB_API } from '@/utils/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement)

// Cast icons to any to avoid TypeScript issues
const ArrowPathIconAny: any = ArrowPathIcon;
const PlusIconAny: any = PlusIcon;
const UsersIconAny: any = UsersIcon;
const PhoneIconAny: any = PhoneIcon;
const ChartBarIconAny: any = ChartBarIcon;
const CalendarIconAny: any = CalendarIcon;
const ExclamationTriangleIconAny: any = ExclamationTriangleIcon;

function abbreviateProgram(name: string) {
  const ignore = ['in', 'of', 'and', 'for', 'to', 'the', 'with', 'on', 'at', 'by'];
  return name
    .split(' ')
    .filter(word => word && !ignore.includes(word.toLowerCase()))
    .map(word => word[0].toUpperCase())
    .join('');
}

export default function MarketingPage() {
  const { inquiries, followups, loading, refreshInquiries, refreshFollowups } = useMarketingData()
  const [owner, setOwner] = useState('')
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [tasks, setTasks] = useState<{ id: number; title: string; dueDate?: string; status: string }[]>([])

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

  useEffect(() => {
    if (isAdmin) {
      refreshInquiries(owner || undefined)
      refreshFollowups(owner || undefined)
    }
  }, [owner, isAdmin])

  // Load tasks for dashboard widgets
  useEffect(() => {
    fetch(`${WEB_API}/calendar/tasks`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data) => setTasks(data.tasks || []))
      .catch(() => setTasks([]))
  }, [])

  // Calculate statistics
  const overdueFollowups = followups.filter(f =>
    (f.status === 'pending' || f.status === 'rescheduled') &&
    new Date(f.scheduledFor) < new Date()
  ).length;

  const todaysFollowups = followups.filter(f => {
    const today = new Date();
    const followupDate = new Date(f.scheduledFor);
    return followupDate.toDateString() === today.toDateString() &&
      (f.status === 'pending' || f.status === 'rescheduled');
  }).slice(0, 5);

  // Today's tasks
  const todaysTasks = tasks.filter(t => {
    if (!t.dueDate) return false
    const d = new Date(t.dueDate)
    const today = new Date()
    return d.toDateString() === today.toDateString() && t.status !== 'completed'
  }).slice(0, 5)

  // Recent inquiries (last 7 days)
  const recentInquiries = inquiries
    .filter(i => new Date(i.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Program statistics
  const programCounts = inquiries.reduce((acc, i) => {
    const key = (i.programOfInterest || 'Unknown') as string;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedPrograms = Object.entries(programCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Source statistics
  const sourceCounts = inquiries.reduce((acc, i) => {
    const key = (i.source || 'Unknown') as string;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Performance metrics based on real data
  const totalInquiries = inquiries.length;
  const hotLeads = inquiries.filter(i => (i.status || '').toLowerCase() === 'hot').length;
  const registeredLeads = inquiries.filter(i => (i.status || '').toLowerCase() === 'registered').length;
  const completedFollowups = followups.filter(f => (f.status || '').toLowerCase() === 'completed').length;
  const pendingFollowups = followups.filter(f => {
    const s = (f.status || '').toLowerCase();
    return s === 'pending' || s === 'rescheduled';
  }).length;
  const conversionRate = totalInquiries > 0 ? Math.round((registeredLeads / totalInquiries) * 100) : 0;
  const followupCompletionRate = followups.length > 0 ? Math.round((completedFollowups / followups.length) * 100) : 0;

  // Extra KPIs for dashboard cards
  const todayKey = new Date().toDateString();
  const newTodayCount = inquiries.filter(i => new Date(i.createdAt).toDateString() === todayKey).length;
  const inquiriesLast7Days = inquiries.filter(i =>
    new Date(i.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  // Map inquiryId -> followups for richer KPIs and SLA calculations
  const inquiriesById: Record<string, any> = {};
  for (const i of inquiries) {
    const key = String((i as any).id ?? (i as any)._id ?? '');
    if (!key) continue;
    inquiriesById[key] = i;
  }

  const followupsByInquiry: Record<string, { hasCompleted: boolean; total: number; firstFollowupAt?: Date }> = {};
  for (const f of followups) {
    const key = String((f as any).inquiryId ?? '');
    if (!key) continue;
    if (!followupsByInquiry[key]) followupsByInquiry[key] = { hasCompleted: false, total: 0 };
    followupsByInquiry[key].total += 1;
    const scheduled = f.scheduledFor ? new Date(f.scheduledFor) : undefined;
    if (scheduled) {
      if (!followupsByInquiry[key].firstFollowupAt || scheduled < followupsByInquiry[key].firstFollowupAt!) {
        followupsByInquiry[key].firstFollowupAt = scheduled;
      }
    }
    if ((f.status || '').toLowerCase() === 'completed') {
      followupsByInquiry[key].hasCompleted = true;
    }
  }

  const hotWarmWithoutCompletedFollowup = inquiries.filter(i => {
    const status = (i.status || '').toLowerCase();
    if (status !== 'hot' && status !== 'warm') return false;
    const key = String((i as any).id ?? (i as any)._id ?? '');
    if (!key) return true;
    const meta = followupsByInquiry[key];
    return !meta || !meta.hasCompleted;
  }).length;

  const inquiriesWithFollowups = new Set(
    followups
      .map(f => (f as any).inquiryId)
      .filter((id: any) => id !== undefined && id !== null)
      .map((id: any) => String(id))
  );
  const inquiriesWithoutFollowups = inquiries.filter(i => {
    const key = String((i as any).id ?? (i as any)._id ?? '');
    if (!key) return false;
    return !inquiriesWithFollowups.has(key);
  }).length;

  const todaysWorkload = todaysTasks.length + todaysFollowups.length;

  const MS_48H = 48 * 60 * 60 * 1000
  const awaitingFirstTouch = inquiries.filter((i) => {
    const id = String((i as any).id ?? '')
    if (!id) return false
    if ((i as any).firstResponseAt) return false
    const created = new Date(i.createdAt).getTime()
    return Date.now() - created > MS_48H
  }).length

  // Status funnel (real data)
  const statusOrder = ['new', 'contacted', 'qualified', 'hot', 'registered', 'lost'];
  const statusCounts = statusOrder.map(statusKey =>
    inquiries.filter(i => (i.status || '').toLowerCase() === statusKey).length
  );
  const maxStatusCount = Math.max(1, ...statusCounts);
  const stageLabels = ['New', 'Contacted', 'Qualified', 'Hot', 'Registered', 'Lost'];

  // Time-to-first-response (average hours) and SLA
  let totalFirstResponseHours = 0;
  let firstResponseCount = 0;
  let within24 = 0;
  let over24 = 0;

  for (const [inqId, meta] of Object.entries(followupsByInquiry)) {
    const inquiry = inquiriesById[inqId];
    if (!inquiry || !meta.firstFollowupAt || !inquiry.createdAt) continue;
    const created = new Date(inquiry.createdAt);
    const diffMs = meta.firstFollowupAt.getTime() - created.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) continue;
    const hours = diffMs / (1000 * 60 * 60);
    totalFirstResponseHours += hours;
    firstResponseCount += 1;
    if (hours <= 24) within24 += 1; else over24 += 1;
  }

  const avgFirstResponseHours = firstResponseCount > 0
    ? Math.round((totalFirstResponseHours / firstResponseCount) * 10) / 10
    : 0;
  const slaWithin24Pct = firstResponseCount > 0
    ? Math.round((within24 / firstResponseCount) * 100)
    : 0;

  // Source + follow-up distributions (real data)
  const followupsByStatusMap = followups.reduce((acc: Record<string, number>, f: any) => {
    const key = (f.status || 'unknown').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const followupsByTypeMap = followups.reduce((acc: Record<string, number>, f: any) => {
    const key = (f.type || 'other').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Real trend data - last 14 days of inquiries
  const dailyLabels: string[] = [];
  const dailyCounts: number[] = [];
  const today = new Date();
  const inquiriesPerDay: Record<string, number> = {};
  for (const i of inquiries) {
    const d = new Date(i.createdAt);
    const key = d.toISOString().slice(0, 10); // yyyy-mm-dd
    inquiriesPerDay[key] = (inquiriesPerDay[key] || 0) + 1;
  }
  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = d.toISOString().slice(0, 10);
    dailyLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    dailyCounts.push(inquiriesPerDay[key] || 0);
  }

  const trendData = {
    labels: dailyLabels,
    datasets: [{
      label: 'New inquiries',
      data: dailyCounts,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      tension: 0.35,
      fill: true,
      pointRadius: 2,
    }],
  };

  const handleRefresh = () => {
    refreshInquiries();
    refreshFollowups();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 inline-block" />
              Live data
            </span>
            <div className="animate-spin h-4 w-4 border-2 border-t-transparent border-emerald-500 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 border border-gray-200 p-4 animate-pulse rounded-none">
              <div className="h-5 bg-gray-200 mb-2" />
              <div className="h-7 bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + compact nav */}
      <div className="flex flex-col gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h1>
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              Live overview of inquiries, follow-ups and pipeline for this institution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px]">
            <Link href="/inquiries" className="px-3 py-1.5 border border-sky-500 text-sky-700 hover:bg-sky-50 uppercase font-semibold tracking-wide">
              Inquiries board
            </Link>
            <Link href="/followups" className="px-3 py-1.5 border border-emerald-500 text-emerald-700 hover:bg-emerald-50 uppercase font-semibold tracking-wide">
              Follow-ups queue
            </Link>
            <Link href="/reports" className="px-3 py-1.5 border border-amber-600 text-amber-700 hover:bg-amber-50 uppercase font-semibold tracking-wide">
              Full reports
            </Link>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Owner filter (admin only) */}
          {isAdmin && owners.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 uppercase">Scope</span>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              >
                <option value="">All users</option>
                {owners.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-[12px] text-gray-600 dark:text-gray-300">
              Scope: <span className="font-semibold text-gray-800 dark:text-gray-100">My workspace</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center px-3 py-1.5 text-[12px] font-semibold border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 uppercase tracking-wide"
          >
            <ArrowPathIconAny className="w-4 h-4 mr-1" />
            Refresh data
          </button>
        </div>
      </div>

      {/* Today / queue — actionable shortcuts */}
      <div className="rounded-lg border border-teal-300/60 dark:border-teal-700 bg-gradient-to-br from-teal-50/90 to-white dark:from-teal-950/35 dark:to-gray-900 px-4 py-3 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200">Today&apos;s focus</div>
            <p className="text-[13px] text-gray-700 dark:text-gray-300 mt-1 max-w-2xl">
              Start with overdue follow-ups and leads waiting too long for first contact. Use{' '}
              <kbd className="px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-[10px] bg-white dark:bg-gray-800">Ctrl</kbd>
              +
              <kbd className="px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-[10px] bg-white dark:bg-gray-800">K</kbd>
              {' '}to jump anywhere.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/followups"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold bg-amber-600 text-white hover:bg-amber-700 hover:opacity-95 rounded-md shadow-sm"
            >
              <ExclamationTriangleIconAny className="h-4 w-4" />
              Overdue ({overdueFollowups})
            </Link>
            <Link
              href="/inquiries"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border-2 border-orange-300 dark:border-orange-700 text-orange-900 dark:text-orange-100 bg-orange-50/80 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded-md"
            >
              No first touch 48h+ ({awaitingFirstTouch})
            </Link>
            <Link
              href="/inquiries"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border border-sky-400 text-sky-800 dark:text-sky-200 bg-white dark:bg-gray-800 hover:bg-sky-50 dark:hover:bg-gray-700 rounded-md"
            >
              Hot / warm priority ({hotWarmWithoutCompletedFollowup})
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"
            >
              <CalendarIconAny className="h-4 w-4" />
              Calendar
            </Link>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <div className="px-3 py-2 rounded-none bg-sky-600 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Total inquiries</div>
          <div className="mt-1 text-2xl font-bold">{totalInquiries}</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-emerald-600 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Registered</div>
          <div className="mt-1 text-2xl font-bold">{registeredLeads}</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-amber-500 text-gray-900 dark:text-gray-900">
          <div className="text-[11px] font-semibold uppercase tracking-wide">Overdue follow-ups</div>
          <div className="mt-1 text-2xl font-bold">{overdueFollowups}</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-fuchsia-600 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Conversion</div>
          <div className="mt-1 text-2xl font-bold">{conversionRate}%</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-indigo-600 text-white hidden md:block">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Follow-up done</div>
          <div className="mt-1 text-2xl font-bold">{followupCompletionRate}%</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-slate-700 text-white hidden lg:block">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Pending follow-ups</div>
          <div className="mt-1 text-2xl font-bold">{pendingFollowups}</div>
        </div>
      </div>

      {/* Secondary KPI strip (additional insights) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <div className="px-3 py-2 rounded-none bg-emerald-50">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">New today</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{newTodayCount}</div>
          <div className="text-[11px] text-emerald-800/80">Inquiries created today</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-sky-50">
          <div className="text-[11px] font-semibold text-sky-700 uppercase tracking-wide">Last 7 days</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{inquiriesLast7Days}</div>
          <div className="text-[11px] text-sky-800/80">New inquiries in past week</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-orange-50">
          <div className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">Priority leads</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{hotWarmWithoutCompletedFollowup}</div>
          <div className="text-[11px] text-orange-800/80">Hot & warm, no completed follow-up</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-rose-50 hidden md:block">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">No follow-ups</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{inquiriesWithoutFollowups}</div>
          <div className="text-[11px] text-rose-800/80">Inquiries with 0 actions</div>
        </div>
        <div className="px-3 py-2 rounded-none bg-teal-50 hidden lg:block">
          <div className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">Today’s workload</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{todaysWorkload}</div>
          <div className="text-[11px] text-teal-800/80">Tasks + follow-ups due today</div>
        </div>
      </div>

      {/* Trend + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Inquiries (last 14 days)
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Line chart • each point is created inquiries per day
            </div>
          </div>
          <div className="h-[220px]">
            <Line
              data={trendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
                  y: { grid: { color: '#e5e7eb' }, beginAtZero: true, ticks: { stepSize: 1 } },
                },
              }}
            />
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
            Pipeline funnel
          </div>
          <div className="space-y-1">
            {statusOrder.map((label, idx) => {
              const count = statusCounts[idx];
              const widthPct = maxStatusCount ? Math.max(4, (count / maxStatusCount) * 100) : 4;
              const colors: Record<string, string> = {
                new: 'bg-sky-500',
                contacted: 'bg-indigo-500',
                qualified: 'bg-emerald-500',
                hot: 'bg-orange-500',
                registered: 'bg-emerald-700',
                lost: 'bg-gray-500',
              };
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`h-6 ${colors[label] || 'bg-gray-400'}`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="flex-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold capitalize text-gray-800 dark:text-gray-200">{label}</span>
                    <span className="text-gray-600 dark:text-gray-300">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Sources */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
            Inquiry sources
          </div>
          <div className="h-[220px]">
            <Pie
              data={{
                labels: Object.keys(sourceCounts),
                datasets: [{
                  data: Object.values(sourceCounts),
                  backgroundColor: [
                    '#2563eb',
                    '#22c55e',
                    '#f97316',
                    '#a855f7',
                    '#f43f5e',
                    '#6b7280',
                  ],
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' as const } },
              }}
            />
          </div>
        </div>

        {/* Top programs */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
            Top programs
          </div>
          <div className="h-[220px]">
            <Bar
              data={{
                labels: sortedPrograms.map(([prog]) => abbreviateProgram(prog)),
                datasets: [{
                  label: 'Inquiries',
                  data: sortedPrograms.map(([, count]) => count),
                  backgroundColor: '#f59e0b',
                  borderColor: '#b45309',
                  borderWidth: 1,
                  barThickness: 18,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                indexAxis: 'y',
                scales: {
                  x: { grid: { color: '#e5e7eb' }, beginAtZero: true },
                  y: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>

        {/* Follow-ups + SLA and stage conversion */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
            Follow-ups & response quality
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="h-[80px]">
              <Bar
                data={{
                  labels: Object.keys(followupsByTypeMap),
                  datasets: [{
                    label: 'By type',
                    data: Object.values(followupsByTypeMap),
                    backgroundColor: '#2563eb',
                    barThickness: 14,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#e5e7eb' }, beginAtZero: true },
                  },
                }}
              />
            </div>
            <div className="h-[80px]">
              <Bar
                data={{
                  labels: Object.keys(followupsByStatusMap),
                  datasets: [{
                    label: 'By status',
                    data: Object.values(followupsByStatusMap),
                    backgroundColor: '#6b7280',
                    barThickness: 14,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#e5e7eb' }, beginAtZero: true },
                  },
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-[120px]">
                <Pie
                  data={{
                    labels: ['≤ 24h', '> 24h'],
                    datasets: [{
                      data: [
                        slaWithin24Pct,
                        Math.max(0, 100 - slaWithin24Pct),
                      ],
                      backgroundColor: ['#16a34a', '#e5e7eb'],
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
              <div className="flex flex-col justify-center text-[12px] text-gray-700">
                <div className="font-semibold mb-1">First response SLA</div>
                <div>Avg first response: <span className="font-bold">{avgFirstResponseHours}h</span></div>
                <div>Within 24h: <span className="font-bold">{slaWithin24Pct}%</span> of inquiries with follow-ups</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage conversion & top officers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
            Stage distribution
          </div>
          <div className="h-[180px]">
            <Bar
              data={{
                labels: stageLabels,
                datasets: [{
                  label: 'Inquiries',
                  data: statusCounts,
                  backgroundColor: ['#38bdf8','#6366f1','#22c55e','#f97316','#16a34a','#6b7280'],
                  borderWidth: 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false } },
                  y: { grid: { color: '#e5e7eb' }, beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <TopOfficersChart inquiries={inquiries} followups={followups} />
        </div>
      </div>

      {/* Tasks + recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <h3 className="text-[13px] font-semibold mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <CalendarIconAny className="w-4 h-4 text-blue-600" />
            Today: tasks & follow-ups
          </h3>
          <div className="space-y-2">
            {[...todaysTasks, ...todaysFollowups].length > 0 ? (
              <>
                {todaysTasks.map(t => (
                  <div key={`task-${t.id}`} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
                    <div>
                      <div className="font-medium text-[13px] text-gray-900 dark:text-gray-100">{t.title}</div>
                      <div className="text-[12px] text-gray-600 dark:text-gray-300">Task</div>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] border border-emerald-500 text-emerald-700 uppercase font-semibold tracking-wide">
                      todo
                    </span>
                  </div>
                ))}
                {todaysFollowups.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
                    <div>
                      <div className="font-medium text-[13px] text-gray-900 dark:text-gray-100">{f.inquiryName}</div>
                      <div className="text-[12px] text-gray-600 dark:text-gray-300">
                        {f.type} • {new Date(f.scheduledFor).toLocaleTimeString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[11px] uppercase font-semibold tracking-wide ${
                        (f.status || '').toLowerCase() === 'pending'
                          ? 'border-amber-500 text-amber-700'
                          : 'border-blue-500 text-blue-700'
                      } border`}
                    >
                      {f.status}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-[13px]">
                No tasks or follow-ups scheduled for today.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-none">
          <h3 className="text-[13px] font-semibold mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <UsersIconAny className="w-4 h-4 text-emerald-600" />
            Recent inquiries (last 7 days)
          </h3>
          <div className="space-y-2">
            {recentInquiries.length > 0 ? (
              recentInquiries.map(i => (
                <div key={i.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200">
                  <div>
                    <div className="font-medium text-[13px] text-gray-900 dark:text-gray-100">{i.fullName}</div>
                    <div className="text-[12px] text-gray-600 dark:text-gray-300">
                      {i.programOfInterest} • {i.source} • {new Date(i.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[11px] uppercase font-semibold tracking-wide border ${
                      (i.status || '').toLowerCase() === 'hot'
                        ? 'border-emerald-600 text-emerald-700'
                        : (i.status || '').toLowerCase() === 'warm'
                        ? 'border-amber-600 text-amber-700'
                        : (i.status || '').toLowerCase() === 'registered'
                        ? 'border-sky-600 text-sky-700'
                        : 'border-gray-400 text-gray-700'
                    }`}
                  >
                    {i.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-[13px]">
                No recent inquiries captured in the last 7 days.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact per-officer performance chart using real inquiry/follow-up counts
function TopOfficersChart({ inquiries, followups }: { inquiries: any[]; followups: any[] }) {
  // Derive owner from assignedTo, createdBy or email
  const ownerStats: Record<string, { inquiries: number; followups: number }> = {};

  for (const i of inquiries) {
    const owner = (i.assignedTo || i.createdBy || i.email || 'Unassigned') as string;
    const key = owner.toLowerCase() || 'unassigned';
    if (!ownerStats[key]) ownerStats[key] = { inquiries: 0, followups: 0 };
    ownerStats[key].inquiries += 1;
  }

  for (const f of followups) {
    const owner = (f.owner || f.assignedTo || f.createdBy || f.userEmail || 'Unassigned') as string;
    const key = owner.toLowerCase() || 'unassigned';
    if (!ownerStats[key]) ownerStats[key] = { inquiries: 0, followups: 0 };
    ownerStats[key].followups += 1;
  }

  const rows = Object.entries(ownerStats)
    .map(([key, v]) => ({
      owner: key,
      score: v.inquiries + v.followups * 1.5,
      inquiries: v.inquiries,
      followups: v.followups,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!rows.length) {
    return (
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
          Top officers
        </div>
        <div className="text-[13px] text-gray-500 dark:text-gray-400">No officer activity yet.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-[12px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 mb-2">
        Top officers (inquiries + follow-ups)
      </div>
      <div className="flex-1 h-[190px]">
        <Bar
          data={{
            labels: rows.map(r => r.owner),
            datasets: [{
              label: 'Score',
              data: rows.map(r => r.score),
              backgroundColor: '#22c55e',
              borderWidth: 0,
              barThickness: 24,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            indexAxis: 'y',
            scales: {
              x: { grid: { color: '#e5e7eb' }, beginAtZero: true },
              y: { grid: { display: false } },
            },
          }}
        />
      </div>
      <div className="mt-2 text-[12px] text-gray-700">
        {rows.map((r, idx) => (
          <div key={r.owner} className="flex justify-between">
            <span className="font-semibold">{idx + 1}. {r.owner}</span>
            <span className="text-gray-600 dark:text-gray-300">
              {r.inquiries} inqs • {r.followups} f/ups
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
