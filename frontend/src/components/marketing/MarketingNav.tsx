'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MarketingNav = () => {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/followups"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/followups' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        📅 Follow-ups
      </Link>
      <Link
        href="/analytics"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/analytics' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        📈 Analytics
      </Link>
      <Link
        href="/reports"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/reports' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        🧾 Reports
      </Link>
      <Link
        href="/admission-letters"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/admission-letters' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        📄 Admission Letters
      </Link>
      <Link
        href="/calendar"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/calendar' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        🗓️ Calendar
      </Link>
      <Link
        href="/marketing/campaigns"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/campaigns' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        📢 Campaigns
      </Link>
      <Link
        href="/registrations"
        className={`flex items-center gap-2 px-4 py-2 rounded-md ${
          pathname === '/marketing/registrations' ? 'bg-primary text-white' : 'text-neutral-dark hover:bg-neutral-light/50'
        }`}
      >
        📝 Registrations
      </Link>
    </div>
  )
}

export default MarketingNav 