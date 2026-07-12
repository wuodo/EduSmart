'use client'

import { useMarketingData } from '@/hooks/useMarketingData'
import AdmissionLetterList from '@/components/marketing/AdmissionLetterList'
import { useEffect, useState } from 'react'
import { WEB_API } from '@/utils/api'
import { usePermissions } from '../settings/PermissionsContext'

export default function AdmissionLettersPage() {
  const { inquiries, refreshInquiries } = useMarketingData()
  const perms = usePermissions()
  const canView = perms?.canView?.('admission_letters') ?? true

  const [owner, setOwner] = useState('')
  const [owners, setOwners] = useState<{ label: string; value: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const role = typeof window !== 'undefined' ? (localStorage.getItem('userRole') || '').toLowerCase() : ''
    const admin = role === 'admin' || role === 'senior_staff'
    setIsAdmin(admin)
    if (admin) {
      fetch(`${WEB_API}/users`, {
        cache: 'no-store',
        credentials: 'include',
      })
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
    if (isAdmin) refreshInquiries(owner || undefined)
  }, [owner, isAdmin])

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">WELCOME TO EDUSMART</h2>
          <p className="text-gray-500">Your current role does not have access to this section.</p>
        </div>
      </div>
    )
  }

  const inputClass =
    'w-full min-w-0 px-2 py-1.5 text-[13px] border border-neutral-light bg-white/90 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40'
  const selectClass = inputClass

  // Compute stats — flow-based: Generated includes all non-null letter statuses
  const counts: Record<string, number> = {}
  for (const i of inquiries as any[]) {
    const s = String(i?.letterStatus || 'Not Generated')
    counts[s] = (counts[s] || 0) + 1
  }
  const total = inquiries.length
  const notGenerated = counts['Not Generated'] || 0
  const generated = total - notGenerated // any status other than "Not Generated"
  const breakdownStatuses = ['Generated', 'Sending', 'Sent', 'Downloaded', 'Acknowledged', 'Signed']
  const cards = [
    { label: 'Total', value: total, color: 'bg-primary text-white' },
    { label: 'No Letter', value: notGenerated, color: 'bg-gray-600 text-white' },
    { label: 'Letter Gen.', value: generated, color: 'bg-blue-600 text-white' },
    ...breakdownStatuses.filter(s => (counts[s] || 0) > 0 || s === 'Sent').map(s => ({
      label: s, value: counts[s] || 0,
      color: s === 'Sending' ? 'bg-sky-500 text-white' : s === 'Sent' ? 'bg-amber-600 text-white' : s === 'Downloaded' ? 'bg-emerald-600 text-white' : s === 'Acknowledged' ? 'bg-green-700 text-white' : s === 'Signed' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white',
    })),
  ]

  const filteredInquiries = inquiries.filter((i: any) => {
    const letterStatus = String(i.letterStatus || 'Not Generated')
    const matchesStatus = !status || letterStatus === status
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      String(i.fullName || i.name || '').toLowerCase().includes(q) ||
      String(i.phone || '').toLowerCase().includes(q) ||
      String(i.email || '').toLowerCase().includes(q) ||
      String(i.programOfInterest || '').toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold">Admission Letters</h1>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 mb-3">
        {cards.map(card => (
          <div key={card.label} className={`shadow-sm ring-1 ring-black/5 p-2 px-3 flex flex-col items-center shrink-0 card-hover ${card.color}`}>
            <div className="text-sm font-bold">{card.value}</div>
            <div className="text-[9px] font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-200">
        {/* Filters directly above the table */}
        <div className="p-3 sm:p-4 border-b border-neutral-light">
          <div className="flex flex-wrap md:flex-nowrap md:items-center gap-2">
            <div className="flex-[1.6] min-w-[220px]">
              <input
                type="text"
                placeholder="Search admission letters..."
                className={inputClass}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap md:flex-nowrap gap-2 items-center flex-1 min-w-[220px]">
              <select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="Not Generated">Not Generated</option>
                <option value="Generated">Generated</option>
                <option value="Downloaded">Downloaded</option>
                <option value="Sent">Sent</option>
                <option value="Acknowledged">Acknowledged</option>
              </select>
              {isAdmin && owners.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-300 px-2 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-yellow-800">Owner</span>
                  <select
                    className="px-2 py-1 border border-yellow-300 bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                  >
                    <option value="">All Owners</option>
                    {owners.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          <AdmissionLetterList inquiries={filteredInquiries} onRefresh={async () => { await refreshInquiries() }} />
        </div>
      </div>
    </div>
  )
} 