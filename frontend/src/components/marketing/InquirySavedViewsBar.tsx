'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InquiryFilterSnapshot } from '@/lib/inquirySavedViews'
import { deleteSavedView, loadSavedViews, saveNamedView, type SavedInquiryView } from '@/lib/inquirySavedViews'
import { BookmarkIcon, TrashIcon } from '@heroicons/react/24/outline'

const BookmarkIconAny: any = BookmarkIcon
const TrashIconAny: any = TrashIcon

export default function InquirySavedViewsBar({
  snapshot,
  onApply,
  isAdmin,
}: {
  snapshot: InquiryFilterSnapshot
  onApply: (filters: InquiryFilterSnapshot) => void
  isAdmin: boolean
}) {
  const [views, setViews] = useState<SavedInquiryView[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setViews(loadSavedViews())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = () => {
    const n = name.trim()
    if (!n) {
      setToast('Enter a name for this view.')
      window.setTimeout(() => setToast(null), 2500)
      return
    }
    const toSave = { ...snapshot }
    if (!isAdmin) toSave.owner = ''
    saveNamedView(n, toSave)
    setName('')
    refresh()
    setToast(`Saved “${n}”.`)
    window.setTimeout(() => setToast(null), 2500)
  }

  const remove = () => {
    if (!selectedId) return
    deleteSavedView(selectedId)
    setSelectedId('')
    refresh()
    setToast('View removed.')
    window.setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <BookmarkIconAny className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Saved views</span>
        <select
          value={selectedId}
          onChange={(e) => {
            const id = e.target.value
            setSelectedId(id)
            if (!id) return
            const v = views.find((x) => x.id === id)
            if (!v) return
            const f = { ...v.filters }
            if (!isAdmin) f.owner = ''
            onApply(f)
            setToast(`Loaded “${v.name}”.`)
            window.setTimeout(() => setToast(null), 2500)
          }}
          className="min-w-[10rem] max-w-[16rem] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[13px] px-2 py-1.5"
          title="Load a saved filter set"
        >
          <option value="">Load saved view…</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={remove}
          disabled={!selectedId}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-[12px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
          title="Delete selected saved view"
        >
          <TrashIconAny className="h-3.5 w-3.5" />
          Delete
        </button>
        <span className="hidden sm:inline text-gray-300 dark:text-gray-600">|</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name for current filters"
          className="min-w-[8rem] flex-1 max-w-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[13px] px-2 py-1.5"
        />
        <button
          type="button"
          onClick={save}
          className="rounded-md bg-teal-600 text-white hover:bg-teal-700 text-[13px] font-semibold px-3 py-1.5 shrink-0"
        >
          Save
        </button>
      </div>
      {toast && (
        <p className="text-xs text-gray-600 dark:text-gray-400" role="status">
          {toast}
        </p>
      )}
      <p className="text-[11px] text-gray-500 dark:text-gray-500 leading-snug">
        Saved views are stored in this browser for your account and tenant. Owner filter is only kept for admin and senior staff.
      </p>
    </div>
  )
}
