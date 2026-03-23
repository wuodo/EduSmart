'use client'
import { useState } from 'react';
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

const SECTIONS = [
  { key: 'user', label: 'User Management', module: 'settings' },
  { key: 'system', label: 'System Configuration', module: 'settings' },
  { key: 'permissions', label: 'Permissions & Access', module: 'settings' },
  { key: 'communication', label: 'Communication Settings', module: 'settings' },
  { key: 'data', label: 'Data & Backup', module: 'settings' },
  { key: 'branding', label: 'Branding & Appearance', module: 'settings' },
  { key: 'audit', label: 'Audit & Logs', module: 'settings' },
  { key: 'integrations', label: 'Integrations', module: 'settings' },
  { key: 'smart', label: 'Other Smart Features', module: 'settings' },
];

export default function MarketingSettingsPage() {
  const [section, setSection] = useState('system'); // Default to system configuration
  const { canView, loading } = usePermissions();
  
  // If permissions are still loading, show a loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh]">
      <aside className="w-64 ml-3 md:ml-4 pr-6 border-r border-gray-200 dark:border-gray-700 sticky top-20 self-start h-[calc(100vh-5rem)] overflow-auto bg-white/70 dark:bg-white/5 backdrop-blur-sm">
        <h1 className="text-xl font-semibold mb-4 pl-6 pr-2 text-gray-900 dark:text-white">Marketing Settings</h1>
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
                onClick={() => allowed && setSection(s.key)}
                disabled={!allowed}
              >
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 pl-8">
        {section === 'user' && <Guard module="settings"><UserManagementPage /></Guard>}
        {section === 'system' && <Guard module="settings"><SystemConfig /></Guard>}
        {section === 'permissions' && <Guard module="settings"><Permissions /></Guard>}
        {section === 'communication' && <Guard module="settings"><Communication /></Guard>}
        {section === 'data' && <Guard module="settings"><DataBackup /></Guard>}
        {section === 'branding' && <Guard module="settings"><Branding /></Guard>}
        {section === 'audit' && <Guard module="settings"><AuditLogs /></Guard>}
        {section === 'integrations' && <Guard module="settings"><Integrations /></Guard>}
        {section === 'smart' && <Guard module="settings"><SmartFeatures /></Guard>}
      </main>
    </div>
  );
} 