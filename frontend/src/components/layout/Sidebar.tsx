'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBranding } from '@/contexts/BrandingContext'
import {
  MegaphoneIcon, CogIcon, CalendarIcon, DocumentTextIcon, ChartBarIcon, BellIcon,
  CalendarDaysIcon, ViewColumnsIcon, ClipboardDocumentCheckIcon, EnvelopeIcon,
  HomeIcon, PhoneIcon, CheckBadgeIcon, UserGroupIcon, BookOpenIcon,
  ChartPieIcon, ArrowTrendingUpIcon, QueueListIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { cachedApiFetch } from '@/utils/apiClient'

interface NavigationItem {
  name?: string;
  title?: string;
  href: string;
  icon: any;
}

interface SidebarProps {
  isMobileOpen: boolean;
  onClose: () => void;
}

/** Align with PermissionsContext: UI role "manager" maps to senior_staff for access. */
function normalizeNavRole(role: string): string {
  const r = (role || '').toLowerCase().trim()
  if (r === 'manager') return 'senior_staff'
  return r
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Inquiries', href: '/inquiries', icon: PhoneIcon },
  { name: 'Pipeline', href: '/pipeline', icon: ViewColumnsIcon },
  { name: 'QA review', href: '/qa-review', icon: ClipboardDocumentCheckIcon },
  { name: 'Follow-ups', href: '/followups', icon: CalendarIcon },
  { name: 'Calendar', href: '/calendar', icon: CalendarDaysIcon },
  { name: 'ADM Letters', href: '/admission-letters', icon: DocumentTextIcon },
  { name: 'Registrations', href: '/registrations', icon: CheckBadgeIcon },
  { name: 'Courses', href: '/courses', icon: BookOpenIcon },
  { name: 'Campaigns', href: '/marketing/campaigns', icon: MegaphoneIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartPieIcon },
  { name: 'Reports', href: '/reports', icon: ArrowTrendingUpIcon },
  { name: 'Email', href: '/email/inbox', icon: EnvelopeIcon },
  { name: 'Workflows', href: '/workflows', icon: QueueListIcon },
  { name: 'Accountability', href: '/accountability', icon: UserGroupIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

function SidebarItem({ item, pathname, onClose, collapsed }: {
  item: NavigationItem;
  pathname: string;
  onClose: () => void;
  collapsed?: boolean;
}) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div>
        <Link
          href={item.href}
          onClick={onClose}
        className={`group flex items-center px-2 py-1.5 text-compact-sm font-medium transition-colors ${
          isActive
            ? 'bg-white/15 border-l-4 pl-1.5'
            : 'hover:bg-white/10'
        }`}
        style={{
          color: 'var(--brand-sidebar-text, #ffffff)',
          ...(isActive ? { borderLeftColor: 'var(--brand-sidebar-active, var(--brand-accent, #14b8a6))' } : {})
        }}
        >
          <item.icon
            className="mr-2 h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--brand-sidebar-text, #ffffff)', opacity: isActive ? 1 : 0.8 }}
            aria-hidden="true"
          />
          {!collapsed && (item.name || item.title)}
        </Link>
    </div>
  );
}

export default function Sidebar({ isMobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState('');
  const [title, setTitle] = useState<string>('Marketing');
  const [logo, setLogo] = useState<string | null>(null);
  const { branding } = useBranding()
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Prefer cookie (set at login) since localStorage may not be used anymore
      const match = document.cookie.match(/(?:^|; )role=([^;]+)/)
      const cookieRole = match ? decodeURIComponent(match[1]) : ''
      if (cookieRole) {
        setUserRole(cookieRole)
        return
      }
    } catch {}

    // Fallback: attempt to load from session
    ;(async () => {
      try {
        const res = await fetch('/api/proxy/users/me', { credentials: 'include', cache: 'no-store' })
        if (res.ok) {
          const me = await res.json().catch(() => ({}))
          if (me?.role) setUserRole(String(me.role))
        }
      } catch {}
    })()
  }, []);

  useEffect(() => {
    // Update sidebar title from tenant details
    (async () => {
      try {
        const res = await cachedApiFetch('/tenants/me', 30_000)
        if (res.ok) {
          const data = await res.json()
          const n = data?.tenant?.name || data?.branding?.name
          const lg = data?.tenant?.logo || data?.branding?.logo
          if (n && String(n).trim()) setTitle(String(n))
          if (lg && String(lg).trim()) setLogo(String(lg))
          else {
            const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/)
            const t = m ? decodeURIComponent(m[1]) : ''
            if (t) setTitle(t.charAt(0).toUpperCase() + t.slice(1))
          }
        }
      } catch {
        // fall back to cookie
        try {
          const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/)
          const t = m ? decodeURIComponent(m[1]) : ''
          if (t) setTitle(t.charAt(0).toUpperCase() + t.slice(1))
        } catch {}
      }
    })()
  }, [])

  useEffect(() => {
    // React to branding updates immediately after save
    if (branding) {
      if (branding.name && String(branding.name).trim()) setTitle(String(branding.name))
      if (branding.logo && String(branding.logo).trim()) setLogo(String(branding.logo))
    }
  }, [branding])

  // Only show Settings and Courses for admin and senior_staff (and manager → senior_staff)
  const navRole = normalizeNavRole(userRole)
  const filteredNavigation = navigation.filter(item => {
    if (item.name === 'Settings' || item.name === 'Courses') {
      return navRole === 'admin' || navRole === 'senior_staff'
    }
    return true
  })

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'w-14' : 'w-48'} transform transition-all duration-300 ease-in-out h-full
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col border-r border-white/10 sidebar-static
      `}
      style={{ backgroundColor: 'var(--brand-sidebar-bg, var(--brand-primary, #003366))' }}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-white/20 shrink-0">
          <div className="flex items-center gap-2">
            {logo && !collapsed ? (
              <img
                src={logo}
                alt={title}
                className="h-6 w-auto object-contain"
                onError={() => setLogo(null)}
              />
            ) : (
              <h1 className="text-compact font-bold text-white truncate max-w-[8rem]">
                {collapsed ? (title ? title.charAt(0) : '') : title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="inline-flex text-white hover:text-yellow-200 p-1"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M4 12h16M10 6l-6 6 6 6' : 'M4 12h16M14 6l6 6-6 6'} />
              </svg>
            </button>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden text-white hover:text-yellow-200 p-1"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto">
          {filteredNavigation.map((item) => (
            <SidebarItem
              key={item.name || item.title}
              item={item}
              pathname={pathname}
              onClose={onClose}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>
    </>
  );
} 