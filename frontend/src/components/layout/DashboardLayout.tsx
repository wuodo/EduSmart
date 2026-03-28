'use client'

import Sidebar from './Sidebar'
import { usePathname } from 'next/navigation'
import { useBranding } from '@/contexts/BrandingContext'
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
// import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

const CRM_BANNER_DISMISS_KEY = 'edusmart_crm_updates_banner_v1';
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const moduleName = getModuleName(pathname);
  const [instName, setInstName] = useState<string>('');
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
      if (localStorage.getItem(CRM_BANNER_DISMISS_KEY)) return
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
    const interval = setInterval(() => setDateTime(new Date()), 1000);

    // Helper: skip poll when tab is hidden to avoid piling up requests
    const isVisible = () => typeof document !== 'undefined' && document.visibilityState === 'visible';

    // poll delete requests for admin/senior_staff
    // Interval: 6 000 ms (was 5 000). In-flight guard prevents overlapping calls.
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
    }, 6000);

    // poll chat unread count — 8 000 ms (was 4 000). In-flight guard + visibility.
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
    }, 8000);

    // poll broadcast unread count — 10 000 ms (was 5 000). In-flight guard + visibility.
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
    }, 10000);

    // Tenant suspension guard — 30 000 ms (was 5 000). Tenant status changes are rare.
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
      const res = await fetch(`${WEB_API}/users/me`, { cache: 'no-store' });
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
    <div className="flex h-screen bg-neutral-light overflow-hidden">
      <Sidebar isMobileOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Top teal bar, no top padding */}
        <div className="w-full h-14 flex items-center px-2 xs:px-3 sm:px-6 shadow-sm justify-between overflow-hidden" style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-header-icon, #ffffff)' }}>
          {/* Left side - Tenant name (desktop) and hamburger menu (mobile) */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden text-white hover:text-yellow-200 flex-shrink-0 mobile-touch-friendly"
              title="Menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Tenant name — always visible, uppercase bold, high-contrast */}
            {instName ? (
              <div className="flex flex-col justify-center min-w-0">
                <span
                  className="text-white font-extrabold uppercase tracking-widest truncate leading-tight"
                  style={{ fontSize: '0.8rem', textShadow: '0 1px 3px rgba(0,0,0,0.35)', letterSpacing: '0.12em' }}
                >
                  {instName}
                </span>
                <span className="hidden lg:block text-white/70 text-[10px] truncate leading-tight uppercase tracking-wide">{moduleName}</span>
              </div>
            ) : (
              <span className="text-white font-semibold truncate text-sm">{moduleName}</span>
            )}
          </div>

          {/* Right side - Mobile controls and desktop controls */}
          <div className="flex items-center gap-1 xs:gap-2 sm:gap-3 md:gap-4 lg:gap-6 flex-shrink-0 min-w-0">
                         {/* Mobile controls - Profile, notifications, mentions, time */}
            <div className="flex lg:hidden items-center gap-2">
               <button
                 type="button"
                 onClick={() => openCommandPalette()}
                 className="text-white hover:text-yellow-200 mobile-touch-friendly"
                 title="Search (Ctrl+K)"
               >
                 <MagnifyingGlassIconAny className="h-5 w-5" />
               </button>
               {/* Theme toggle - mobile */}
               <ThemeToggle />
               {/* Profile icon */}
               <button
                 onClick={openProfile}
                 className="text-white hover:text-yellow-200 mobile-touch-friendly"
                 title="Profile"
               >
                 <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 19.125a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21c-2.676 0-5.216-.584-7.499-1.875z"></path>
                 </svg>
               </button>

              {(userRole === 'admin' || userRole === 'senior_staff') ? (
                <button
                  onClick={() => setShowRequests(s => !s)}
                  className="relative text-white hover:text-yellow-200 mobile-touch-friendly"
                  title="Delete Requests"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 22c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2Zm7-6v-5a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"/>
                  </svg>
                  {deleteRequests.length > 0 && (
                    <span className="absolute -top-1 right-0 bg-red-500 text-white text-[10px] leading-none rounded-full px-1 py-0.5">{deleteRequests.length}</span>
                  )}
                </button>
              ) : (
                <div className="mobile-touch-friendly">
                  <OfficerApprovalsBell />
                </div>
              )}

              {/* Broadcast notifications (separate from chats/approvals) */}
              <button
                onClick={() => setShowBroadcasts((s) => !s)}
                className="relative text-white hover:text-yellow-200 mobile-touch-friendly"
                title="Broadcast Notifications"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3 10.5V13a1.5 1.5 0 001.5 1.5H6l1.5 4.5h2l-1.2-4.5H12a6 6 0 006-6V6a1 1 0 00-1.447-.894L12 7.5H4.5A1.5 1.5 0 003 9v1.5Z"/>
                </svg>
                {broadcastUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] leading-none rounded-full px-1 py-0.5">
                    {broadcastUnreadCount > 99 ? '99+' : broadcastUnreadCount}
                  </span>
                )}
              </button>

              {/* Chat (mobile) with unread badge */}
              <button 
                onClick={async () => { setFloatingChat({ reopenTick: Date.now() }); setMentions([]); setUnreadChatCount(0); try { const email=(localStorage.getItem('userEmail')||'').toLowerCase(); await fetch(`${WEB_API}/chat/mark-read`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: email }) }); } catch {} }} 
                className="relative text-white hover:text-yellow-200 mobile-touch-friendly" 
                title="Chat"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="12" r=".9" fill="currentColor"/>
                  <circle cx="12" cy="12" r=".9" fill="currentColor"/>
                  <circle cx="16" cy="12" r=".9" fill="currentColor"/>
                </svg>
                {unreadChatCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full px-1 py-0.5">{unreadChatCount}</span>
                )}
              </button>

              {/* Time - mobile only */}
              <div className="flex flex-col items-end">
                <span suppressHydrationWarning className="text-white text-compact-xs font-medium">{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span suppressHydrationWarning className="text-white text-compact-xs">{dateTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
              {/* Mobile logout */}
              <button
                onClick={handleLogout}
                className="text-teal-100 hover:text-white ml-1 mobile-touch-friendly"
                title="Logout"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
            
            {/* Desktop controls - hidden on mobile */}
            <div className="hidden md:flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="text-white/90 hover:text-white text-[11px] font-semibold px-2 py-1 rounded border border-white/25 hover:bg-white/10"
                title="Keyboard shortcuts (?)"
              >
                ?
              </button>
              <CommandPaletteTriggerButton />
              <div className="flex flex-col items-end mr-3 sm:mr-6">
                <span suppressHydrationWarning className="text-white text-compact-xs font-medium">{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span suppressHydrationWarning className="text-white text-compact-xs">{dateTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <ThemeToggle />
              {/* Chat bubble - desktop quick open */}
              <button 
                onClick={async () => { setFloatingChat({ reopenTick: Date.now() }); setMentions([]); setUnreadChatCount(0); try { const email=(localStorage.getItem('userEmail')||'').toLowerCase(); await fetch(`${WEB_API}/chat/mark-read`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: email }) }); } catch {} }} 
                className="text-white hover:text-yellow-200" 
                title="Open Chat"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8" cy="12" r=".9" fill="currentColor"/>
                  <circle cx="12" cy="12" r=".9" fill="currentColor"/>
                  <circle cx="16" cy="12" r=".9" fill="currentColor"/>
                </svg>
                {unreadChatCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1">{unreadChatCount}</span>
                )}
              </button>
            </div>
            
            {/* Mentions panel removed; counts are shown on chat icons instead */}
            
            {(userRole === 'admin' || userRole === 'senior_staff') ? (
              <button onClick={() => setShowRequests(s => !s)} className="hidden sm:block relative text-white hover:text-yellow-200" title="Delete Requests">
                <svg className="h-5 w-5 inline-block align-middle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 22c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2Zm7-6v-5a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"/>
                </svg>
                {deleteRequests.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1">{deleteRequests.length}</span>
                )}
              </button>
            ) : (
              <div className="hidden sm:block">
                <OfficerApprovalsBell />
              </div>
            )}
            <button onClick={() => setShowBroadcasts((s) => !s)} className="hidden sm:block relative text-white hover:text-yellow-200" title="Broadcast Notifications">
              <svg className="h-5 w-5 inline-block align-middle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3 10.5V13a1.5 1.5 0 001.5 1.5H6l1.5 4.5h2l-1.2-4.5H12a6 6 0 006-6V6a1 1 0 00-1.447-.894L12 7.5H4.5A1.5 1.5 0 003 9v1.5Z"/>
              </svg>
              {broadcastUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs rounded-full px-1">
                  {broadcastUnreadCount > 99 ? '99+' : broadcastUnreadCount}
                </span>
              )}
            </button>
            <button type="button" onClick={openProfile} className="hidden sm:flex items-center gap-2 group min-w-0">
              <svg className="h-6 w-6 text-white group-hover:text-yellow-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 19.125a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21c-2.676 0-5.216-.584-7.499-1.875z"></path></svg>
              <span className="text-white text-compact-sm font-semibold group-hover:text-yellow-200 truncate max-w-[22vw] sm:max-w-[18vw] md:max-w-[12vw]">{userName || 'My Profile'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-white/80 hover:text-white px-1 xs:px-2 sm:px-3 md:px-4 py-1 rounded hover:bg-white/10 text-compact-xs sm:text-compact-sm font-semibold ml-1 xs:ml-2 sm:ml-4 whitespace-nowrap mobile-touch-friendly transition-colors"
              title="Logout"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pt-5 min-w-0 content-responsive flex flex-col">
          {showCrmBanner && (
            <div className="mb-4 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/90 dark:bg-teal-950/35 px-3 py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                <span className="font-semibold">CRM updates:</span> Pipeline view, inquiry timelines, merge duplicates, and CRM
                integrations (webhooks and round-robin) are available from the sidebar and Settings.
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-teal-800 dark:text-teal-200 hover:underline shrink-0 self-start"
                onClick={() => {
                  try {
                    localStorage.setItem(CRM_BANNER_DISMISS_KEY, '1')
                  } catch {
                    /* ignore */
                  }
                  setShowCrmBanner(false)
                }}
              >
                Dismiss
              </button>
            </div>
          )}
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
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">My Profile</h3>
                <button className="text-neutral-dark hover:text-primary" onClick={() => setShowProfile(false)}>×</button>
              </div>
              {profileError && <div className="mb-3 text-sm text-rose-600">{profileError}</div>}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Gender</label>
                  <select value={profileGender} onChange={e => setProfileGender(e.target.value)} className="w-full border rounded px-3 py-2">
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="07xx xxx xxx" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Change Password</label>
                  <input type="password" value={profilePassword} onChange={e => setProfilePassword(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="••••••••" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button className="px-4 py-2 rounded border" onClick={() => setShowProfile(false)}>Cancel</button>
                <button className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50" onClick={saveProfile} disabled={profileLoading}>{profileLoading ? 'Saving...' : 'Save'}</button>
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
    }, 5000)
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