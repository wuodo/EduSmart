"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users2, CreditCard, ShieldCheck, SlidersHorizontal, HardDrive,
  BarChart3, Activity, KeyRound, Globe, Siren, ListChecks, Gavel, FileCheck2, LifeBuoy, Cog, Timer, Wrench, RotateCcw
} from 'lucide-react';
import React from 'react';
import Topbar from './_components/Topbar';

const nav = [
  { href: '/cpanel/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cpanel/tenants', label: 'Tenants', icon: Building2 },
  { href: '/cpanel/users', label: 'Users', icon: Users2 },
  { href: '/cpanel/billing', label: 'Billing', icon: CreditCard },
  { href: '/cpanel/security', label: 'Security', icon: ShieldCheck },
  { href: '/cpanel/limits', label: 'Limits', icon: SlidersHorizontal },
  { href: '/cpanel/incidents', label: 'Incidents', icon: Siren },
  { href: '/cpanel/release', label: 'Release', icon: ListChecks },
  { href: '/cpanel/settings', label: 'Settings', icon: Cog },
  { href: '/cpanel/backups', label: 'Backups', icon: HardDrive },
  { href: '/cpanel/restore-requests', label: 'Restore Requests', icon: RotateCcw },
  { href: '/cpanel/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/cpanel/usage', label: 'API Usage', icon: Activity },
  { href: '/cpanel/sso', label: 'SSO/SCIM', icon: KeyRound },
  { href: '/cpanel/governance', label: 'Governance', icon: Gavel },
  { href: '/cpanel/compliance', label: 'Compliance', icon: FileCheck2 },
  { href: '/cpanel/domains', label: 'Domains', icon: Globe },
  { href: '/cpanel/sla', label: 'SLAs', icon: Timer },
  { href: '/cpanel/platform', label: 'Platform', icon: Wrench },
  { href: '/cpanel/support', label: 'Support', icon: LifeBuoy },
];

export default function CpanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen text-gray-900" style={{ backgroundColor: '#e9ebef' }}>
      <div className="flex h-screen">
        <aside className="hidden md:block w-56 bg-teal-800 text-white overflow-y-auto sticky top-0 self-start">
          <div className="px-6 py-3 border-b border-white/20">
            <div className="text-lg font-semibold">EduSmart Cpanel</div>
            <div className="text-[11px] text-white/80">Super Admin</div>
          </div>
          <nav className="p-3 space-y-0.5">
            {nav.map(item => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon as any;
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded ${active ? 'font-medium' : ''}`} style={{ backgroundColor: active ? '#0d9488' : 'transparent', color: '#fff' }}>
                  {Icon ? <Icon size={16}/> : null}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto">
          <header className="sticky top-0 z-20"><Topbar /></header>
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


