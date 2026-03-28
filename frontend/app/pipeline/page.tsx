'use client'

import { useMarketingData } from '@/hooks/useMarketingData'
import Link from 'next/link'
import { useMemo } from 'react'

const STATUS_PRIORITY = ['hot', 'warm', 'cold', 'Pending', 'scholarship-seeker', 'graduate']

export default function PipelinePage() {
  const { inquiries, loading, refreshInquiries } = useMarketingData() as any

  const keys = useMemo(() => {
    const out = new Set<string>()
    for (const x of inquiries || []) out.add(String(x.status || '').trim() || 'other')
    return Array.from(out).sort((a, b) => {
      const ia = STATUS_PRIORITY.indexOf(a)
      const ib = STATUS_PRIORITY.indexOf(b)
      if (ia >= 0 && ib >= 0) return ia - ib
      if (ia >= 0) return -1
      if (ib >= 0) return 1
      return a.localeCompare(b)
    })
  }, [inquiries])

  return (
    <div className="space-y-4 p-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pipeline</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Columns by lead status. Click a card to open the inquiry.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshInquiries()}
          className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[320px]">
        {keys.map((status) => {
          const rows = (inquiries || []).filter(
            (i: any) => (String(i.status || '').trim() || 'other') === status,
          )
          return (
            <div
              key={status}
              className="flex-shrink-0 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col"
            >
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 font-semibold text-sm text-teal-800 dark:text-teal-300">
                {status} <span className="text-gray-400 font-normal">({rows.length})</span>
              </div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                {rows.map((i: any) => (
                  <Link
                    key={i.id}
                    href={`/inquiries?openInquiry=${i.id}`}
                    className="block rounded border border-gray-100 dark:border-gray-800 px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                  >
                    <div className="font-medium text-gray-900 dark:text-white truncate">{i.fullName}</div>
                    <div className="text-[11px] text-gray-500 truncate">{i.programOfInterest}</div>
                  </Link>
                ))}
                {rows.length === 0 && <p className="text-xs text-gray-400 px-1">Empty</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
