'use client'

import { useEffect, useState } from 'react'
import { useBranding } from '@/contexts/BrandingContext'

export default function BrandingSettingsPage() {
  const { branding, refresh } = useBranding()
  const [primary, setPrimary] = useState(branding?.primaryColor || '#0d9488')
  const [secondary, setSecondary] = useState(branding?.secondaryColor || '#afd657')
  const [accent, setAccent] = useState(branding?.accentColor || '#39b1ed')
  const [logo, setLogo] = useState(branding?.logo || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setPrimary(branding?.primaryColor || '#0d9488')
    setSecondary(branding?.secondaryColor || '#afd657')
    setAccent(branding?.accentColor || '#39b1ed')
    setLogo(branding?.logo || '')
  }, [branding])

  const save = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const res = await fetch('/api/proxy/tenants/me/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: primary, secondaryColor: secondary, accentColor: accent, logo })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to save')
      setSuccess('Branding updated')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Branding</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center gap-3">
          <span className="w-32">Primary</span>
          <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="h-10 w-16" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-32">Secondary</span>
          <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} className="h-10 w-16" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-32">Accent</span>
          <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="h-10 w-16" />
        </label>
        <label className="flex items-center gap-3 col-span-1 md:col-span-2">
          <span className="w-32">Logo URL</span>
          <input type="url" value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://..." className="flex-1 border rounded px-3 py-2" />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded text-white" style={{ backgroundColor: 'var(--brand-primary)' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {error && <span className="text-rose-600 text-sm">{error}</span>}
        {success && <span className="text-green-600 text-sm">{success}</span>}
      </div>
    </div>
  )
}





