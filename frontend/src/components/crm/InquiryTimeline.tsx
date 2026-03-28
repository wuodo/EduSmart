'use client'

import { useEffect, useState } from 'react'
import { WEB_API } from '@/utils/api'

type Ev = { type: string; at: string; label: string; meta?: unknown }

export default function InquiryTimeline({ inquiryId }: { inquiryId: string }) {
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!inquiryId) return
    setLoading(true)
    fetch(`${WEB_API}/inquiries/${inquiryId}/timeline`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEvents(Array.isArray(d?.events) ? d.events : []))
      .catch(() => setErr('Could not load timeline'))
      .finally(() => setLoading(false))
  }, [inquiryId])

  if (loading) return <p className="text-xs text-gray-500 py-2">Loading activity…</p>
  if (err) return <p className="text-xs text-rose-600 py-2">{err}</p>
  if (events.length === 0) return <p className="text-xs text-gray-500 py-2">No activity yet.</p>

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-900/40 max-h-56 overflow-y-auto">
      <ul className="text-xs divide-y divide-gray-100 dark:divide-gray-800">
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="px-3 py-2 flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400">{new Date(e.at).toLocaleString()}</span>
            <span className="text-gray-800 dark:text-gray-200">{e.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
