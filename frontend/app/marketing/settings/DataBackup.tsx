'use client'

import { useEffect, useRef, useState } from 'react'

const API_URL = '/api/marketing/settings/data-backup'

function getUserHeaders() {
  return {};
}

const TYPES = ['inquiries','followups','students','programs','audit-logs','users','admission-letters','registrations'] as const

type ExportType = typeof TYPES[number]

export default function DataBackup() {
  const [downloading, setDownloading] = useState<string>('')
  const [uploading, setUploading] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<ExportType | 'system'>('inquiries')
  const [currentRole, setCurrentRole] = useState<string>('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirm, setConfirm] = useState<{ open: boolean; type: 'systemExport' | 'systemImport' | null }>({ open: false, type: null })

  useEffect(() => {
    if (typeof document === 'undefined') return
    try {
      const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
      const r = m ? decodeURIComponent(m[1]) : (localStorage.getItem('userRole') || '')
      if (r) setCurrentRole(r.toLowerCase())
    } catch {
      // ignore
    }
  }, [])

  const isSuperAdmin = currentRole === 'super_admin'

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const doExport = async (type: ExportType | 'system') => {
    if (type === 'system' && !isSuperAdmin) {
      showToast('error', 'Only super admin can perform a full system backup.')
      return
    }
    try {
      setDownloading(type)
      const res = await fetch(`${API_URL}?type=${encodeURIComponent(type)}`, { headers: getUserHeaders() })
      if (!res.ok) { showToast('error', `Failed to export ${type}`); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showToast('success', `Export for ${type} downloaded.`)
    } finally {
      setDownloading('')
    }
  }

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (importType === 'system' && !isSuperAdmin) {
      showToast('error', 'Only super admin can perform a system restore.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      setUploading(importType)
      const text = await file.text()
      const res = await fetch(`${API_URL}?type=${encodeURIComponent(importType)}`, {
        method: 'POST',
        headers: { ...getUserHeaders(), 'Content-Type': 'application/json' },
        body: text
      })
      if (!res.ok) { showToast('error', 'Import failed'); return }
      await res.json().catch(() => ({}))
      showToast('success', 'Import completed successfully.')
    } finally {
      setUploading('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-md px-4 py-2 text-sm border ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Data & Backup</h2>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-xl">
            Export encrypted-friendly JSON snapshots for off-site storage, and carefully restore individual modules or full system snapshots.
            System-level operations are restricted to super administrators.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirm({ open: true, type: 'systemExport' })}
            disabled={!!downloading || !isSuperAdmin}
            className="px-3 py-2 rounded bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading === 'system' ? 'Backing up...' : 'System Backup'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Quick Exports</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Download individual datasets as JSON. Use these for analytics, safe archiving, or migration between environments.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button key={t} onClick={() => doExport(t)} disabled={!!downloading}
                className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60">
                {downloading === t ? 'Exporting...' : `Export ${t.replace('-', ' ')}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">Exports download as JSON snapshots for backup or migration.</p>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Import / Restore (JSON)</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Restore data from a trusted JSON backup file. System restore replaces multiple modules and should only be done by super admins.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <select value={importType} onChange={e => setImportType(e.target.value as any)} className="px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
              {[...TYPES, 'system'].map(t => (
                <option key={t} value={t} disabled={t === 'system' && !isSuperAdmin}>
                  {t.replace('-', ' ')}
                  {t === 'system' && !isSuperAdmin ? ' (super admin only)' : ''}
                </option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={onImportFileChange}
              className="text-sm"
              disabled={!!uploading}
            />
          </div>
          <p className="text-xs text-gray-500">
            Choose a dataset (or system) and upload a JSON backup to restore. System restore expects the exact structure produced by System Backup.
          </p>
        </div>
      </div>

      {confirm.open && confirm.type && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {confirm.type === 'systemExport' ? 'Confirm System Backup' : 'Confirm System Restore'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {confirm.type === 'systemExport'
                ? 'This will generate a JSON snapshot containing user and lead data. Store it securely and avoid downloading to shared or insecure devices.'
                : 'System restore can overwrite large parts of your tenant data. Only proceed if you fully trust the backup source.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm({ open: false, type: null })}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirm.type === 'systemExport') {
                    setConfirm({ open: false, type: null })
                    doExport('system')
                  } else {
                    setConfirm({ open: false, type: null })
                    if (fileRef.current) fileRef.current.click()
                  }
                }}
                className="px-3 py-1.5 rounded bg-primary text-white text-sm hover:bg-primary/90"
              >
                {confirm.type === 'systemExport' ? 'Proceed with Backup' : 'Proceed with Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 