'use client'

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { usePermissions, Guard } from './PermissionsContext';
import UserManagementPage from './UserManagement';
import SystemConfig from './SystemConfig';
import Permissions from './Permissions';
import Communication from './Communication';
import DataBackup from './DataBackup';
import Branding from './Branding';
import AuditLogs from './AuditLogs';
import Integrations from './Integrations';
import SmartFeatures from './SmartFeatures';
import Automations from './Automations';
import CrmIntegrations from './CrmIntegrations';
import {
  Bars3Icon,
  XMarkIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  KeyIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  PaintBrushIcon,
  ClipboardDocumentListIcon,
  PuzzlePieceIcon,
  BoltIcon,
  SparklesIcon,
  ArrowPathRoundedSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const Bars3IconAny: any = Bars3Icon;
const XMarkIconAny: any = XMarkIcon;
const UsersIconAny: any = UsersIcon;
const WrenchScrewdriverIconAny: any = WrenchScrewdriverIcon;
const KeyIconAny: any = KeyIcon;
const ChatBubbleLeftRightIconAny: any = ChatBubbleLeftRightIcon;
const CircleStackIconAny: any = CircleStackIcon;
const PaintBrushIconAny: any = PaintBrushIcon;
const ClipboardDocumentListIconAny: any = ClipboardDocumentListIcon;
const PuzzlePieceIconAny: any = PuzzlePieceIcon;
const BoltIconAny: any = BoltIcon;
const SparklesIconAny: any = SparklesIcon;
const ArrowPathRoundedSquareIconAny: any = ArrowPathRoundedSquareIcon;
const ChevronLeftIconAny: any = ChevronLeftIcon;
const ChevronRightIconAny: any = ChevronRightIcon;

const SETTINGS_SIDEBAR_COLLAPSE_KEY = 'edusmart.settings.sidebarCollapsed.v1';

const SECTIONS = [
  { key: 'user', label: 'User Management', module: 'settings', icon: UsersIconAny },
  { key: 'system', label: 'System Configuration', module: 'settings', icon: WrenchScrewdriverIconAny },
  { key: 'permissions', label: 'Permissions & Access', module: 'settings', icon: KeyIconAny },
  { key: 'communication', label: 'Communication Settings', module: 'settings', icon: ChatBubbleLeftRightIconAny },
  { key: 'data', label: 'Data & Backup', module: 'settings', icon: CircleStackIconAny },
  { key: 'branding', label: 'Branding & Appearance', module: 'settings', icon: PaintBrushIconAny },
  { key: 'audit', label: 'Audit & Logs', module: 'settings', icon: ClipboardDocumentListIconAny },
  { key: 'integrations', label: 'Integrations', module: 'settings', icon: PuzzlePieceIconAny },
  { key: 'auto', label: 'Automations', module: 'settings', icon: BoltIconAny },
  { key: 'smart', label: 'Smart Features', module: 'settings', icon: SparklesIconAny },
  { key: 'crm', label: 'CRM integrations', module: 'settings', icon: ArrowPathRoundedSquareIconAny },
];

export default function MarketingSettingsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [section, setSection] = useState('system');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { canView } = usePermissions();

  useEffect(() => {
    const s = searchParams.get('section');
    if (!s || !SECTIONS.some((x) => x.key === s)) return;
    setSection(s);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let manual: boolean | null = null;
    try {
      const raw = localStorage.getItem(SETTINGS_SIDEBAR_COLLAPSE_KEY);
      if (raw === '1') manual = true;
      if (raw === '0') manual = false;
    } catch {}

    const recompute = () => {
      // Collapse on smaller desktops to maximize space; expand on xl+
      const autoCollapsed = window.innerWidth < 1280;
      setCollapsed(manual ?? autoCollapsed);
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, []);

  const goSection = useCallback(
    (key: string) => {
      setSection(key);
      setSidebarOpen(false);
      const next = new URLSearchParams(searchParams.toString());
      next.set('section', key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const currentSection = SECTIONS.find(s => s.key === section);

  const NavContent = () => (
    <nav className="flex flex-col gap-1">
      {SECTIONS.map(s => {
        const allowed = canView ? canView(s.module) : true;
        const Icon = (s as any).icon as any;
        return (
          <button
            key={s.key}
            title={collapsed ? s.label : undefined}
            className={`w-full py-1.5 text-left text-sm font-medium transition flex items-center gap-2 ${
              section === s.key
                ? 'bg-primary text-white shadow-sm border-l-[3px] border-white/30'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-700/60 border-l-[3px] border-transparent'
            } ${!allowed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${collapsed ? 'px-2 justify-center' : 'pl-5 pr-2'}`}
            onClick={() => allowed && goSection(s.key)}
            disabled={!allowed}
          >
            {Icon ? <Icon className={`h-5 w-5 flex-shrink-0 ${section === s.key ? 'text-white' : ''}`} /> : null}
            {!collapsed && <span className="min-w-0 truncate">{s.label}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-[80vh] relative">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden flex items-center gap-2 absolute top-0 left-0 z-20 px-3 py-2 bg-white/90 dark:bg-gray-800/90 border-b border-gray-200 w-full">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
        >
          {sidebarOpen ? <XMarkIconAny className="h-5 w-5" /> : <Bars3IconAny className="h-5 w-5" />}
        </button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
          Settings — {currentSection?.label || ''}
        </span>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 flex-shrink-0 
        ${collapsed ? 'w-16' : 'w-64'}
        ml-0 lg:ml-3 xl:ml-4 ${collapsed ? 'pr-2' : 'pr-6'} border-r border-gray-200 dark:border-gray-700
        bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm
        lg:sticky lg:top-20 lg:self-start lg:h-[calc(100vh-5rem)] overflow-auto
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        pt-14 lg:pt-0
      `}>
        <div className={`pt-4 ${collapsed ? 'px-2' : 'pl-3 pr-2'} flex items-start justify-end gap-2`}>
          <button
            type="button"
            className="hidden lg:inline-flex p-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => {
              setCollapsed((c) => {
                const next = !c;
                try {
                  localStorage.setItem(SETTINGS_SIDEBAR_COLLAPSE_KEY, next ? '1' : '0');
                } catch {}
                return next;
              });
            }}
          >
            {collapsed ? <ChevronRightIconAny className="h-4 w-4" /> : <ChevronLeftIconAny className="h-4 w-4" />}
          </button>
        </div>
        <NavContent />
      </aside>

      <main className="flex-1 pl-4 lg:pl-6 xl:pl-8 pt-12 lg:pt-0 min-w-0">
        {section === 'user' && <Guard module="settings"><UserManagementPage /></Guard>}
        {section === 'system' && <Guard module="settings"><SystemConfig /></Guard>}
        {section === 'permissions' && <Guard module="settings"><Permissions /></Guard>}
        {section === 'communication' && <Guard module="settings"><Communication /></Guard>}
        {section === 'data' && <Guard module="settings"><DataBackup /></Guard>}
        {section === 'branding' && <Guard module="settings"><Branding /></Guard>}
        {section === 'audit' && <Guard module="settings"><AuditLogs /></Guard>}
        {section === 'integrations' && <Guard module="settings"><Integrations /></Guard>}
        {section === 'smart' && <Guard module="settings"><SmartFeatures /></Guard>}
        {section === 'auto' && <Guard module="settings"><Automations /></Guard>}
        {section === 'crm' && <Guard module="settings"><CrmIntegrations /></Guard>}
      </main>
    </div>
  );
}

