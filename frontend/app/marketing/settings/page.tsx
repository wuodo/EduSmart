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
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const Bars3IconAny: any = Bars3Icon;
const XMarkIconAny: any = XMarkIcon;

const SECTIONS = [
  { key: 'user', label: 'User Management', module: 'settings' },
  { key: 'system', label: 'System Configuration', module: 'settings' },
  { key: 'permissions', label: 'Permissions & Access', module: 'settings' },
  { key: 'communication', label: 'Communication Settings', module: 'settings' },
  { key: 'data', label: 'Data & Backup', module: 'settings' },
  { key: 'branding', label: 'Branding & Appearance', module: 'settings' },
  { key: 'audit', label: 'Audit & Logs', module: 'settings' },
  { key: 'integrations', label: 'Integrations', module: 'settings' },
  { key: 'auto', label: 'Automations', module: 'settings' },
  { key: 'smart', label: 'Smart Features', module: 'settings' },
  { key: 'crm', label: 'CRM integrations', module: 'settings' },
];

export default function MarketingSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [section, setSection] = useState('system');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { canView } = usePermissions();

  useEffect(() => {
    const s = searchParams.get('section');
    if (!s || !SECTIONS.some((x) => x.key === s)) return;
    setSection(s);
  }, [searchParams]);

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
        return (
          <button
            key={s.key}
            className={`w-full -mx-2 pr-2 pl-6 py-1.5 text-left text-sm font-medium transition ${
              section === s.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-gray-700/60'
            } ${!allowed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
            onClick={() => allowed && goSection(s.key)}
            disabled={!allowed}
          >
            {s.label}
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
        fixed lg:static inset-y-0 left-0 z-40 w-64 flex-shrink-0 
        ml-0 lg:ml-3 xl:ml-4 pr-6 border-r border-gray-200 dark:border-gray-700
        bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm
        lg:sticky lg:top-20 lg:self-start lg:h-[calc(100vh-5rem)] overflow-auto
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        pt-14 lg:pt-0
      `}>
        <h1 className="text-xl font-semibold mb-1 pl-6 pr-2 pt-4 text-gray-900 dark:text-white">Marketing Settings</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 pl-6 pr-2 mb-3">
          Choose a section below (scroll on small screens).{' '}
          <span className="text-gray-600 dark:text-gray-300">Automations</span>,{' '}
          <span className="text-gray-600 dark:text-gray-300">Smart Features</span>, and{' '}
          <span className="text-gray-600 dark:text-gray-300">CRM integrations</span> follow Integrations.
        </p>
        <NavContent />
      </aside>

      <main className="flex-1 pl-4 lg:pl-8 pt-12 lg:pt-0 min-w-0">
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