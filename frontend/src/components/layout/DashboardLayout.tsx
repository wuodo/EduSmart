'use client'

import Sidebar from './Sidebar'
import { usePathname } from 'next/navigation'
import { useBranding } from '@/contexts/BrandingContext'
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
// import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

const FOCUS_BANNER_DISMISS_KEY = 'edusmart_focus_banner_v1';
import { WEB_API } from '@/utils/api';
import { cachedApiFetch } from '@/utils/apiClient';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import FloatingChat from '@/components/marketing/FloatingChat';
import FloatingAskAi from '@/components/askAi/FloatingAskAi';
import CommandPalette, { CommandPaletteTriggerButton, openCommandPalette } from '@/components/crm/CommandPalette';
import KeyboardShortcutsModal from '@/components/crm/KeyboardShortcutsModal';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
const MagnifyingGlassIconAny: any = MagnifyingGlassIcon

const moduleNames: { [key: string]: string } = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/inquiries': 'Inquiries',
  '/pipeline': 'Pipeline',
  '/qa-review': 'QA review',
  '/marketing': 'Marketing',
  '/academics': 'Academics',
  '/administration': 'Administration',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

function getModuleName(pathname: string) {
  // Find the first segment that matches a module
  const match = Object.keys(moduleNames).find((key) =>
    pathname === key || pathname.startsWith(key + '/')
  )
  return moduleNames[match || '/']
}

function BriefingBanner({ briefing, userName, onDismiss, onViewOverdue }: { briefing: any; userName: string; onDismiss: () => void; onViewOverdue: () => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = briefing.userName || userName?.split(' ')[0] || '';
  const hotLeads = Number(briefing.hotLeads) || 0;
  const overdue = Number(briefing.overdueFollowups) || 0;
  const newToday = Number(briefing.newToday) || 0;
  const convRate = Number(briefing.conversionRate) || 0;
  const score = Number(briefing.score) || 0;
  return (
    <div className="mb-2 border border-teal-200 bg-gradient-to-r from-teal-50 to-white dark:from-teal-950/30 dark:to-gray-900 px-3 py-2 flex items-center gap-3 overflow-x-auto min-h-[40px]">
      <span className="text-[12px] font-semibold text-teal-800 dark:text-teal-200 whitespace-nowrap shrink-0">{greeting}{firstName ? `, ${firstName}` : ''}!</span>
      <div className="flex items-center gap-2.5 text-[11px] text-gray-600 dark:text-gray-300 whitespace-nowrap shrink-0">
        <span><strong className="text-teal-700">{hotLeads}</strong> hot</span>
        <span><strong className="text-amber-700">{overdue}</strong> overdue</span>
        <span><strong className="text-blue-700">{newToday}</strong> new today</span>
        <span><strong className="text-green-700">{convRate}%</strong> conv.</span>
        <span className="hidden sm:inline"><strong className="text-purple-700">{score}</strong> focus score</span>
      </div>
      <span className="text-[11px] text-gray-500 italic truncate min-w-0">{String(briefing.priorityMessage ?? '')}</span>
      {overdue > 0 && (
        <button onClick={onViewOverdue} className="px-2 py-0.5 text-[10px] font-semibold bg-amber-600 text-white hover:bg-amber-700 shrink-0">View Overdue</button>
      )}
      <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-[11px] shrink-0 ml-auto">✕</button>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const moduleName = getModuleName(pathname);
  const [instName, setInstName] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('edusmart_sidebar_collapsed') === 'true'; } catch { return false; }
  });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { branding } = useBranding()
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const res = await cachedApiFetch('/tenants/me', 30_000)
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          const n = data?.tenant?.name || data?.branding?.name || ''
          if (n) setInstName(String(n))
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (branding?.name && String(branding.name).trim()) {
      setInstName(String(branding.name))
    }
  }, [branding])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (localStorage.getItem(FOCUS_BANNER_DISMISS_KEY)) return
      setShowCrmBanner(true)
    } catch {
      /* ignore */
    }
  }, [])

  // Get user info from localStorage
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);
  const [briefing, setBriefing] = useState<any>(null);
  const [profileName, setProfileName] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showCrmBanner, setShowCrmBanner] = useState(false);
  const [deleteRequests, setDeleteRequests] = useState<any[]>([]);
  const [broadcastNotifications, setBroadcastNotifications] = useState<any[]>([]);
  const [sentBroadcastNotifications, setSentBroadcastNotifications] = useState<any[]>([]);
  const [broadcastUnreadCount, setBroadcastUnreadCount] = useState(0);
  const [showBroadcasts, setShowBroadcasts] = useState(false);
  const [staffNotifications, setStaffNotifications] = useState<any[]>([]);
  const [showStaffNotif, setShowStaffNotif] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'info' | 'warning' | 'critical'>('info');
  const [broadcastPublishAt, setBroadcastPublishAt] = useState('');
  const [broadcastExpiresAt, setBroadcastExpiresAt] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'role'>('all');
  const [broadcastRole, setBroadcastRole] = useState('admissions_officer');
  const [requestMeta, setRequestMeta] = useState<Record<string, { requesterName?: string; itemName?: string; itemPhone?: string; moduleLabel?: string; inquiryId?: string }>>({});
  const [showRequests, setShowRequests] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<Array<{ date: string; type: string; status: string; notes: string }>>([]);
  const [historyRec, setHistoryRec] = useState<string>('');
  const [historyLead, setHistoryLead] = useState<{ name?: string; phone?: string } | null>(null);
  const [mentions, setMentions] = useState<any[]>([])
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [floatingChat, setFloatingChat] = useState<{ roomId?: number; focus?: string; reopenTick?: number } | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const lastUnreadRef = useRef(0)
  // In-flight guards — prevent overlapping poll requests when backend is slow
  const pollDeleteInFlight = useRef(false)
  const pollUnreadInFlight = useRef(false)
  const pollBroadcastInFlight = useRef(false)
  const pollTenantInFlight = useRef(false)

  function userHeaders() {
    // Session-based auth; no special headers needed
    return {} as Record<string, string>;
  }

  async function loadBroadcastNotifications() {
    try {
      const res = await fetch(`${WEB_API}/notifications`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({} as any));
      setBroadcastNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch {}
  }

  async function loadStaffNotifications() {
    try {
      const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '';
      if (!email) return;
      const res = await fetch(`/api/proxy/notifications/feed?email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({} as any));
      if (data?.notifications) setStaffNotifications(data.notifications);
    } catch {}
  }

  async function loadSentBroadcastNotifications() {
    try {
      const role = (localStorage.getItem('userRole') || '').toLowerCase();
      if (!(role === 'admin' || role === 'senior_staff' || role === 'manager')) {
        setSentBroadcastNotifications([]);
        return;
      }
      const res = await fetch(`${WEB_API}/notifications/sent`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({} as any));
      setSentBroadcastNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch {}
  }

  async function markBroadcastRead(id: string) {
    try {
      await fetch(`${WEB_API}/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      setBroadcastNotifications((prev) => prev.filter((n) => n.id !== id));
      setBroadcastUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }

  async function markAllBroadcastRead() {
    try {
      await fetch(`${WEB_API}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      setBroadcastNotifications([]);
      setBroadcastUnreadCount(0);
    } catch {}
  }

  function playNewMessageTone() {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.24)
    } catch {}
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserName(localStorage.getItem('userName') || '');
      setUserRole(localStorage.getItem('userRole') || '');
    }
    fetch('/api/proxy/briefing').then(r => r.json()).then(d => { if (d.briefing) setBriefing(d.briefing); }).catch(() => {});
    const interval = setInterval(() => setDateTime(new Date()), 1000);

    // Helper: skip poll when tab is hidden to avoid piling up requests
    const isVisible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

    // poll delete requests for admin/senior_staff
    // Interval: 15 000 ms (was 6 000). In-flight guard prevents overlapping calls.
    // Reduced frequency to lower request volume on Render free-tier + shared IP.
    // N+1 item fetches removed — meta is built from delete-request + users list only.
    const poll = setInterval(async () => {
      if (!isVisible() || pollDeleteInFlight.current) return;
      pollDeleteInFlight.current = true;
      try {
        const role = (localStorage.getItem('userRole') || '').toLowerCase();
        if (role === 'admin' || role === 'senior_staff') {
          const res = await fetch(`${WEB_API}/delete-requests`, {
            headers: userHeaders(),
            cache: 'no-store'
          });
          if (!res.ok) {
            setDeleteRequests([]);
            return;
          }
          const data = await res.json().catch(() => ({} as any));
          if (Array.isArray(data?.requests)) {
            const pending = data.requests.filter((r: any) => r.status === 'pending');
            setDeleteRequests(pending);
            // Build meta from users list only — no per-item inquiry/followup fetches
            try {
              const usersRes = await fetch(`${WEB_API}/users`, { cache: 'no-store' });
              const users = await usersRes.json();
              const emailToName: Record<string, string> = {};
              if (Array.isArray(users)) {
                for (const u of users) {
                  const e = (u?.email || '').toLowerCase();
                  if (e) emailToName[e] = (u?.name && String(u.name).trim()) ? String(u.name) : e;
                }
              }
              const meta: Record<string, any> = {};
              for (const r of pending) {
                const rid = r.id;
                meta[rid] = {
                  moduleLabel: r.module === 'followups' ? 'Follow-up' : 'Inquiry',
                  requesterName: emailToName[(r.requestedBy || '').toLowerCase()] || r.requestedBy,
                  inquiryId: r.module === 'inquiries' ? r.itemId : undefined,
                };
              }
              setRequestMeta(meta);
            } catch {}
          }
        } else {
          setDeleteRequests([]);
        }
      } catch {}
      finally { pollDeleteInFlight.current = false; }
    }, 15000);

    // poll chat unread count — 15 000 ms (was 8 000). In-flight guard + visibility.
    // Reduced frequency to lower request volume on Render free-tier.
    const pollUnread = setInterval(async () => {
      if (!isVisible() || pollUnreadInFlight.current) return;
      pollUnreadInFlight.current = true;
      try {
        const email = (localStorage.getItem('userEmail') || '').toLowerCase();
        if (!email) return;
        const res = await fetch(`${WEB_API}/chat/unread-count?user=${encodeURIComponent(email)}`, { cache: 'no-store' });
        if (!res.ok) { setUnreadChatCount(0); return; }
        const data = await res.json().catch(() => ({ count: 0 }));
        const count = typeof data?.count === 'number' ? data.count : 0;
        if (count > lastUnreadRef.current && lastUnreadRef.current >= 0) {
          playNewMessageTone();
        }
        lastUnreadRef.current = count;
        setUnreadChatCount(count);
      } catch {
        setUnreadChatCount(0);
      } finally { pollUnreadInFlight.current = false; }
    }, 15000);

    // poll broadcast unread count — 20 000 ms (was 10 000). In-flight guard + visibility.
    // Reduced frequency to lower request volume on Render free-tier.
    const pollBroadcast = setInterval(async () => {
      if (!isVisible() || pollBroadcastInFlight.current) return;
      pollBroadcastInFlight.current = true;
      try {
        const res = await fetch(`${WEB_API}/notifications/unread-count`, { cache: 'no-store', credentials: 'include' });
        if (!res.ok) { setBroadcastUnreadCount(0); return; }
        const data = await res.json().catch(() => ({ count: 0 }));
        const c = typeof data?.count === 'number' ? data.count : 0;
        setBroadcastUnreadCount(c);
      } catch {
        setBroadcastUnreadCount(0);
      } finally { pollBroadcastInFlight.current = false; }
    }, 20000);

    // Staff assignment notifications polling
    const pollStaffNotif = setInterval(loadStaffNotifications, 30000);
    loadStaffNotifications();

    // Tenant suspension guard — 30 000 ms. Tenant status changes are rare.
    // In-flight guard + visibility. Uses cachedApiFetch (30 s TTL).
    const pollTenant = setInterval(async () => {
      if (!isVisible() || pollTenantInFlight.current) return;
      pollTenantInFlight.current = true;
      try {
        const res = await cachedApiFetch('/tenants/me', 30_000);
        const data = await res.json().catch(() => null);
        const isActive = data?.tenant?.isActive;
        if (!res.ok || data?.success === false || isActive === false) {
          handleTenantSuspendedLogout();
        }
      } catch {
        // ignore; do not block app if the check fails temporarily
      } finally { pollTenantInFlight.current = false; }
    }, 30000);

    return () => { clearInterval(interval); clearInterval(poll); clearInterval(pollUnread); clearInterval(pollBroadcast); clearInterval(pollTenant); }
  }, []);

  useEffect(() => {
    const help = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable)) return;
      e.preventDefault();
      setShowShortcuts((s) => !s);
    };
    window.addEventListener('keydown', help);
    return () => window.removeEventListener('keydown', help);
  }, []);

  useEffect(() => {
    if (showBroadcasts) {
      loadBroadcastNotifications();
      loadSentBroadcastNotifications();
    }
  }, [showBroadcasts]);

  const openProfile = async () => {
    setProfileError('');
    setProfileLoading(true);
    setShowProfile(true);
    try {
      const res = await fetch(`${WEB_API}/users/me`, { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Not authenticated');
      setProfileName(data.name || '');
      setProfileGender(data.gender || '');
      setProfilePhone(data.phone || '');
    } catch (e: any) {
      setProfileError(e?.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setProfileError('');
      setProfileLoading(true);
      const res = await fetch(`${WEB_API}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, gender: profileGender, phone: profilePhone, password: profilePassword || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');
      setUserName(data.name || userName);
      if (typeof window !== 'undefined') {
        if (data.name) localStorage.setItem('userName', data.name);
      }
      setShowProfile(false);
      setProfilePassword('');
    } catch (e: any) {
      setProfileError(e?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLogout = async () => {
    const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || localStorage.getItem('userName') || '') : '';
    try {
      await fetch('/api/marketing/settings/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', module: 'auth', user: userEmail })
      });
    } catch {}
    // Ensure cookies are removed with the same path they were set with ("/")
    Cookies.remove('isAuthenticated', { path: '/' });
    Cookies.remove('role', { path: '/' });
    Cookies.remove('tenant', { path: '/' });
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    // Middleware redirects unauthenticated users to "/" (student login)
    router.replace('/');
  };

  // Tenant-suspension logout:
  // - keep the `tenant` cookie so the login page can block inputs and show "Contact Admin"
  // - clear authentication cookies + localStorage to force unauthenticated UI
  const handleTenantSuspendedLogout = () => {
    try {
      Cookies.remove('isAuthenticated', { path: '/' });
      Cookies.remove('role', { path: '/' });
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
    } catch {}
    router.replace('/');
  };



  return (
    <div className="h-screen" style={{ backgroundColor: 'var(--page-bg)' }}>
      <Sidebar isMobileOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} collapsed={sidebarCollapsed} onToggleCollapse={() => { setSidebarCollapsed(c => { const n = !c; try { localStorage.setItem('edusmart_sidebar_collapsed', String(n)); } catch {} return n; }); }} />
      <div className={`${sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[220px]'} h-full flex flex-col min-w-0`}>
        {/* Top header bar — per spec: white bg / bottom border for light, dark bg for dark */}
        <header className="header-bar flex items-center justify-between theme-transition">
          {/* Left: logo + module */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="lg:hidden p-1.5" style={{ color: 'var(--header-icon)' }} title="Menu">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            {instName ? (
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-bold text-base truncate" style={{ color: 'var(--header-text)' }}>{instName}</span>
                <span className="hidden lg:flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>/ {moduleName}</span>
              </div>
            ) : (
              <span className="font-semibold text-base truncate" style={{ color: 'var(--header-text)' }}>{moduleName}</span>
            )}
          </div>

          {/* Right: tool groups — minimal enterprise header */}
          <div className="flex items-center gap-3">

            {/* Search (Command+K trigger only) */}
            <button onClick={() => openCommandPalette()} className="p-1.5 theme-transition" style={{ color: 'var(--header-icon)' }} title="Search (⌘K)">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>

            {/* Consolidated notifications bell — one dropdown for everything */}
            <div className="relative">
              <button onClick={() => setShowNotifPanel(s => !s)} className="relative p-1.5" style={{ color: 'var(--header-icon)' }} title="Notifications">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>
                {(() => {
                  const totalNotifs = deleteRequests.length + broadcastUnreadCount + staffNotifications.length + unreadChatCount;
                  return totalNotifs > 0 ? <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] leading-none rounded-full px-1 py-0.5 min-w-[16px] text-center">{totalNotifs > 99 ? '99+' : totalNotifs}</span> : null;
                })()}
              </button>
              {showNotifPanel && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold">Notifications</div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {deleteRequests.length > 0 && (
                      <div className="px-3 py-2 text-xs">
                        <span className="font-semibold text-amber-600">{deleteRequests.length}</span> delete request(s)
                      </div>
                    )}
                    {broadcastUnreadCount > 0 && (
                      <div className="px-3 py-2 text-xs">
                        <span className="font-semibold text-blue-600">{broadcastUnreadCount}</span> broadcast(s) unread
                      </div>
                    )}
                    {staffNotifications.length > 0 && (
                      <div className="px-3 py-2 text-xs">
                        <span className="font-semibold text-rose-600">{staffNotifications.length}</span> assignment notification(s)
                      </div>
                    )}
                    {unreadChatCount > 0 && (
                      <div className="px-3 py-2 text-xs">
                        <span className="font-semibold text-teal-600">{unreadChatCount}</span> unread chat message(s)
                      </div>
                    )}
                    {deleteRequests.length === 0 && broadcastUnreadCount === 0 && staffNotifications.length === 0 && unreadChatCount === 0 && (
                      <div className="px-3 py-6 text-xs text-gray-400 text-center">No new notifications</div>
                    )}
                  </div>
                  <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 flex gap-2 text-[11px]">
                    {deleteRequests.length > 0 && <button onClick={() => { setShowRequests(true); setShowNotifPanel(false); }} className="text-amber-700 hover:underline">Requests</button>}
                    {broadcastUnreadCount > 0 && <button onClick={() => { setShowBroadcasts(true); setShowNotifPanel(false); }} className="text-blue-700 hover:underline">Broadcasts</button>}
                    {staffNotifications.length > 0 && <button onClick={() => { setShowStaffNotif(true); setShowNotifPanel(false); }} className="text-rose-700 hover:underline">Assignments</button>}
                    {unreadChatCount > 0 && <button onClick={() => { setFloatingChat({ reopenTick: Date.now() }); setMentions([]); setUnreadChatCount(0); setShowNotifPanel(false); }} className="text-teal-700 hover:underline">Chat</button>}
                  </div>
                </div>
              )}
            </div>

            {/* Profile dropdown — with theme toggle inside */}
            <div className="relative">
              <button onClick={() => setShowProfileMenu(s => !s)} className="hidden sm:flex items-center gap-2 pl-2 pr-2 py-1 theme-transition" style={{ border: '1px solid var(--header-avatar-border)', borderRadius: '10px', color: 'var(--header-text)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  <span className="text-xs font-semibold">{(userName || 'U')[0].toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium truncate max-w-[100px]">{userName || 'Profile'}</span>
              </button>
              <button onClick={() => setShowProfileMenu(s => !s)} className="sm:hidden p-1.5" style={{ color: 'var(--header-icon)' }} title="Profile">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 19.125a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21c-2.676 0-5.216-.584-7.499-1.875z"/></svg>
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="text-sm font-medium truncate">{userName || 'User'}</div>
                    <div className="text-xs text-gray-500 truncate">{userEmail || ''}</div>
                  </div>
                  <button onClick={() => { openProfile(); setShowProfileMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Profile Settings</button>
                  <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between text-sm">
                    <span>Dark mode</span>
                    <ThemeToggle />
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <button onClick={() => { handleLogout(); setShowProfileMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-gray-50 dark:hover:bg-gray-700">Log out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pt-5 min-w-0 content-responsive flex flex-col" style={{overflowAnchor: 'none'}}>
           {briefing && ['/inquiries', '/followups', '/reports', '/analytics', '/marketing'].some(p => pathname === p || pathname.startsWith(p + '/')) ? (
             <BriefingBanner
               briefing={briefing}
               userName={userName}
               onDismiss={() => setBriefing(null)}
               onViewOverdue={() => router.push('/followups')}
             />
           ) : null}
          {children}
        </main>
        {showRequests && (userRole === 'admin' || userRole === 'senior_staff') && (
          <div className="fixed top-13 right-4 z-40 bg-white border rounded shadow-lg w-96 max-h-[70vh] overflow-auto">
            <div className="px-4 py-2 border-b font-semibold flex items-center justify-between">
              <span>Delete Requests</span>
              <div className="flex items-center gap-2">
                {deleteRequests.length > 0 && (
                  <button 
                    onClick={async () => {
                      const officers = Array.from(new Set(deleteRequests.map(r => r.requestedBy)));
                      if (officers.length === 1) {
                        const officerEmail = officers[0];
                        const confirmed = confirm(`Bulk approve all ${deleteRequests.length} requests from ${requestMeta[deleteRequests[0].id]?.requesterName || officerEmail}?`);
                        if (confirmed) {
                          try {
                            const res = await fetch(`${WEB_API}/delete-requests/bulk-approve`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', ...userHeaders() },
                              body: JSON.stringify({ officerEmail })
                            });
                            if (res.ok) {
                              setDeleteRequests([]);
                              alert('Bulk approval successful!');
                            }
                          } catch (error) {
                            alert('Bulk approval failed');
                          }
                        }
                      } else {
                        alert('Bulk approve only works when all requests are from the same officer');
                      }
                    }}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    title="Bulk approve all requests from the same officer"
                  >
                    Bulk Approve
                  </button>
                )}
                <button onClick={() => setShowRequests(false)} className="text-neutral-dark hover:text-primary">×</button>
              </div>
            </div>
            <div>
              {deleteRequests.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">No pending requests</div>
              ) : deleteRequests.map((r) => {
                const meta = requestMeta[r.id] || {}
                return (
                <div key={r.id} className="p-3 border-b text-sm">
                  <div className="font-medium">{meta.moduleLabel || r.module} • {String(r.itemId)}</div>
                  <div className="text-gray-700">{r.reason || 'No reason provided'}</div>
                  <div className="text-xs text-gray-500 mt-1">Requested by: {meta.requesterName || r.requestedBy} • {new Date(r.createdAt).toLocaleString()}</div>
                  {(meta.itemName || meta.itemPhone) && (
                    <div className="text-xs text-gray-600 mt-1">Lead: {meta.itemName || '-'} {meta.itemPhone ? `• ${meta.itemPhone}` : ''}</div>
                  )}
                  <div className="mt-2 flex justify-between items-center gap-2">
                    {meta.inquiryId && (
                      <button onClick={async () => {
                        try {
                          const res = await fetch(`${WEB_API}/followups`, { cache: 'no-store' })
                          const all = await res.json()
                          const fups = Array.isArray(all) ? all.filter((f:any)=> String(f.inquiryId) === String(meta.inquiryId)) : []
                          const rows = fups.sort((a: any,b: any)=>new Date(b.scheduledFor).getTime()-new Date(a.scheduledFor).getTime()).map((f:any)=>({
                            date: new Date(f.scheduledFor).toLocaleString(),
                            type: f.type,
                            status: f.status,
                            notes: f.notes || ''
                          }))
                          setHistoryRows(rows)
                          setHistoryLead({ name: meta.itemName, phone: meta.itemPhone })
                          // Simple recommendations
                          let rec = 'Consider rejecting deletion if there is recent pending activity.'
                          const recentPending = rows.find(r => r.status === 'pending')
                          const completedMany = rows.filter(r => r.status === 'completed').length
                          if (completedMany >= 3 && !recentPending) rec = 'History shows multiple completed follow-ups; deletion may be safe.'
                          if (recentPending) rec = 'Pending follow-up exists. Prefer resolving or rescheduling rather than deleting.'
                          setHistoryRec(rec)
                          setHistoryOpen(true)
                        } catch {
                          setHistoryRows([]); setHistoryRec('Failed to load follow-up history'); setHistoryLead({ name: meta.itemName, phone: meta.itemPhone }); setHistoryOpen(true)
                        }
                      }} className="px-2 py-1 rounded border">View History</button>
                    )}
                    <div className="ml-auto flex gap-2">
                    <button onClick={async () => {
                      const reason = prompt('Reason for rejection?') || 'Not approved'
                      try {
                        const res = await fetch(`${WEB_API}/delete-requests/${r.id}`, { 
                          method: 'PUT', 
                          headers: { 'Content-Type': 'application/json', ...userHeaders() }, 
                          body: JSON.stringify({ status: 'rejected', reason }) 
                        });
                        if (res.ok) {
                          setDeleteRequests(prev => prev.filter(x => x.id !== r.id))
                        }
                      } catch (error) {
                        alert('Failed to reject request');
                      }
                    }} className="px-3 py-1 rounded border">Reject</button>
                    <button onClick={async () => {
                      try {
                        const res = await fetch(`${WEB_API}/delete-requests/${r.id}`, { 
                          method: 'PUT', 
                          headers: { 'Content-Type': 'application/json', ...userHeaders() }, 
                          body: JSON.stringify({ status: 'approved' }) 
                        });
                        if (res.ok) {
                          setDeleteRequests(prev => prev.filter(x => x.id !== r.id))
                          alert('Permission granted. Officer can now delete the item.')
                        }
                      } catch (error) {
                        alert('Failed to approve request');
                      }
                    }} className="px-3 py-1 rounded bg-primary text-white">Approve</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}
        {showBroadcasts && (
          <div className="fixed top-13 right-4 z-40 bg-white border rounded shadow-lg w-96 max-h-[70vh] overflow-auto">
            <div className="px-4 py-2 border-b font-semibold flex items-center justify-between">
              <span>Broadcast Notifications</span>
              <div className="flex items-center gap-2">
                {broadcastNotifications.length > 0 && (
                  <button onClick={markAllBroadcastRead} className="px-2 py-0.5 text-xs rounded border">Mark all read</button>
                )}
                <button onClick={() => setShowBroadcasts(false)} className="text-neutral-dark hover:text-primary">×</button>
              </div>
            </div>
            {(userRole === 'admin' || userRole === 'senior_staff' || userRole === 'manager') && (
              <div className="p-3 border-b space-y-2">
                <input
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Notification title"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
                <textarea
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Write broadcast message..."
                  className="w-full border rounded px-2 py-1 text-sm"
                  rows={3}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={broadcastAudience}
                    onChange={(e) => setBroadcastAudience(e.target.value as any)}
                    className="w-full border rounded px-2 py-1 text-sm"
                    title="Audience"
                  >
                    <option value="all">All users</option>
                    <option value="role">Specific role</option>
                  </select>
                  {broadcastAudience === 'role' && (
                    <select
                      value={broadcastRole}
                      onChange={(e) => setBroadcastRole(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                      title="Target role"
                    >
                      <option value="admissions_officer">Admissions Officer</option>
                      <option value="senior_staff">Senior Staff</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                    </select>
                  )}
                  <select
                    value={broadcastPriority}
                    onChange={(e) => setBroadcastPriority(e.target.value as any)}
                    className="w-full border rounded px-2 py-1 text-sm"
                    title="Priority"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={broadcastPublishAt}
                    onChange={(e) => setBroadcastPublishAt(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                    title="Publish at (optional)"
                    placeholder="Publish at"
                  />
                  <input
                    type="datetime-local"
                    value={broadcastExpiresAt}
                    onChange={(e) => setBroadcastExpiresAt(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                    title="Expires at (optional)"
                    placeholder="Expires at"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      const title = broadcastTitle.trim();
                      const body = broadcastBody.trim();
                      if (!title || !body) return;
                      try {
                        const res = await fetch(`${WEB_API}/notifications/broadcast`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            title,
                            body,
                            audience: broadcastAudience,
                            role: broadcastAudience === 'role' ? broadcastRole : undefined,
                            priority: broadcastPriority,
                            publishAt: broadcastPublishAt || undefined,
                            expiresAt: broadcastExpiresAt || undefined,
                          }),
                        });
                        if (res.ok) {
                          setBroadcastTitle('');
                          setBroadcastBody('');
                          setBroadcastPriority('info');
                          setBroadcastPublishAt('');
                          setBroadcastExpiresAt('');
                          setBroadcastAudience('all');
                          setBroadcastRole('admissions_officer');
                          await loadBroadcastNotifications();
                          await loadSentBroadcastNotifications();
                        }
                      } catch {}
                    }}
                    className="px-3 py-1 rounded bg-primary text-white text-sm"
                  >
                    Send Broadcast
                  </button>
                </div>
              </div>
            )}
            <div>
              {broadcastNotifications.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">No notifications</div>
              ) : (
                broadcastNotifications.map((n) => (
                  <div key={n.id} className="p-3 border-b text-sm">
                    <div className="text-gray-700 mt-1">{n.body}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Sender: {n.createdBy}{n.createdByName ? ` (${n.createdByName})` : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        onClick={() => markBroadcastRead(String(n.id))}
                        className="px-3 py-1 rounded border text-xs"
                      >
                        Mark as read
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {(userRole === 'admin' || userRole === 'senior_staff' || userRole === 'manager') && (
              <div className="border-t">
                <div className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-50 flex items-center justify-between">
                  <span>Sent Broadcasts (Read Tracking)</span>
                  <button
                    onClick={loadSentBroadcastNotifications}
                    className="px-2 py-0.5 text-xs rounded border bg-white text-gray-700 hover:bg-gray-100"
                    title="Refresh read tracking"
                  >
                    Refresh
                  </button>
                </div>
                {sentBroadcastNotifications.length === 0 ? (
                  <div className="p-4 text-sm text-gray-600">No sent broadcasts</div>
                ) : (
                  sentBroadcastNotifications.map((n) => (
                    <div key={`sent_${n.id}`} className="p-3 border-b text-sm">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-gray-700 mt-1">{n.body}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Read: {n.readCount ?? 0}/{n.recipientCount ?? 0} • Unread: {n.unreadCount ?? 0}
                      </div>
                      {Array.isArray(n.readers) && n.readers.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Readers: {n.readers.map((r: any) => `${r.email}${r.name ? ` (${r.name})` : ''}${r.readAt ? ` at ${new Date(r.readAt).toLocaleString()}` : ''}`).join(' • ')}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Follow-up History {historyLead?.name ? `— ${historyLead.name}` : ''} {historyLead?.phone ? `(${historyLead.phone})` : ''}</h3>
                <button className="text-neutral-dark hover:text-primary" onClick={()=>setHistoryOpen(false)}>×</button>
              </div>
              <div className="mb-3 text-sm text-gray-700">
                <strong>Recommendation:</strong> {historyRec}
              </div>
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Method</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historyRows.length === 0 ? (
                      <tr><td className="px-3 py-3" colSpan={4}>No history found.</td></tr>
                    ) : historyRows.map((r, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2 capitalize">{r.type}</td>
                        <td className="px-3 py-2 capitalize">{r.status}</td>
                        <td className="px-3 py-2">{r.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-right">
                <button className="px-4 py-2 rounded border" onClick={()=>setHistoryOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-gray-800 shadow-lg w-full max-w-md p-6" style={{ borderRadius: '16px' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>My Profile</h3>
                <button className="hover:opacity-70" style={{ color: 'var(--text-muted)' }} onClick={() => setShowProfile(false)}>×</button>
              </div>
              {profileError && <div className="mb-3 text-sm" style={{ color: 'var(--error)' }}>{profileError}</div>}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Name</label>
                  <input value={profileName} onChange={e => setProfileName(e.target.value)} className="form-input w-full" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Gender</label>
                  <select value={profileGender} onChange={e => setProfileGender(e.target.value)} className="form-input w-full">
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Phone</label>
                  <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="form-input w-full" placeholder="07xx xxx xxx" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Change Password</label>
                  <input type="password" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} className="form-input w-full" placeholder="••••••••" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button className="btn-md btn-secondary" onClick={() => setShowProfile(false)}>Cancel</button>
                <button className="btn-md btn-primary" onClick={saveProfile} disabled={profileLoading}>{profileLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}
        <FloatingChat
          initialRoomId={floatingChat?.roomId}
          focusMessageId={floatingChat?.focus}
          reopenSignal={floatingChat?.reopenTick}
          unreadCount={unreadChatCount}
          defaultOpen={false}
          onClose={() => setFloatingChat(null)}
        />
        <FloatingAskAi />
        <CommandPalette />
        <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </div>

      {/* Staff Notifications Modal */}
      {showStaffNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowStaffNotif(false)}>
          <div className="bg-white w-full max-w-md mx-4 p-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <button onClick={() => setShowStaffNotif(false)} className="p-1 hover:bg-gray-100 text-gray-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {staffNotifications.length === 0 ? (
                <div className="text-xs text-gray-400 py-8 text-center">No notifications</div>
              ) : (
                staffNotifications.slice(0, 50).map((n, i) => (
                  <div key={i} className="border p-3 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1 py-0.5 text-[9px] font-medium ${n.priority === 'critical' ? 'bg-red-100 text-red-700' : n.priority === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{n.priority}</span>
                      <span className="font-semibold text-gray-800">{n.title}</span>
                    </div>
                    <p className="text-gray-600">{n.body}</p>
                    {n.link && <button onClick={() => { window.location.href = n.link; }} className="text-teal-600 hover:underline text-[10px] mt-1 inline-block">View details →</button>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
// Officer approvals bell (for admissions_officer)
function OfficerApprovalsBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const email = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : ''
        if (!email) return
        const res = await fetch(`${WEB_API}/approvals?officerEmail=${encodeURIComponent(email)}`, { 
          credentials: 'include',
          cache: 'no-store' 
        })
        const data = await res.json()
        const arr = Array.isArray(data?.approvals) ? data.approvals : []
        setItems(arr)
        const me = (localStorage.getItem('userEmail') || '').toLowerCase()
        setCount(arr.filter((a: any) => !a.readBy || !a.readBy[me]).length)
      } catch {}
    }, 10000)  // Reduced from 5000 ms to lower request volume on Render free-tier
    return () => clearInterval(t)
  }, [])
  return (
    <>
      <button onClick={() => setOpen(s => !s)} className="relative text-white hover:text-yellow-200" title="Approvals">
        <svg className="h-5 w-5 inline-block align-middle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 22c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2Zm7-6v-5a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"/>
        </svg>
        {count > 0 && <span className="absolute -top-2 -right-2 bg-green-600 text-white text-xs rounded-full px-1">{count}</span>}
      </button>
      {open && (
        <div className="fixed top-13 right-20 z-40 bg-white border rounded shadow-lg w-80 max-h-[70vh] overflow-auto">
          <div className="px-3 py-2 border-b font-semibold flex items-center justify-between">
            <span>Approvals</span>
            <button onClick={() => setOpen(false)} className="text-neutral-dark hover:text-primary">×</button>
          </div>
          <div>
            {items.length === 0 ? (
              <div className="p-3 text-sm text-gray-600">No approvals</div>
            ) : items.map((a: any) => (
              <div key={a.id} className="p-3 border-b text-sm">
                <div className="font-medium capitalize">{String(a.module).replace('_',' ')} • {a.itemName || String(a.itemId)}</div>
                <div className={`text-xs font-medium ${a.status === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
                  {a.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                </div>
                {a.reason && (
                  <div className="text-xs text-gray-600 mt-1">Reason: {a.reason}</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(a.approvedAt).toLocaleString()}
                </div>
                <div className="mt-2 text-right">
                  <button onClick={async () => {
                    try {
                      const e = (localStorage.getItem('userEmail') || '').toLowerCase()
                      await fetch(`${WEB_API}/approvals/${a.id}/read`, { 
                        method: 'PUT', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ officerEmail: e }) 
                      })
                      setItems(prev => prev.filter(x => x.id !== a.id))
                      setCount(c => Math.max(0, c - 1))
                    } catch {}
                  }} className="px-3 py-1 rounded border">Mark as read</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}