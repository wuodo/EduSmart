"use client"

import { useBranding } from '@/contexts/BrandingContext'
import { useEffect, useState } from 'react'

export default function Branding() {
  const { branding, refresh } = useBranding()
  const [primary, setPrimary] = useState('#0d9488')
  const [secondary, setSecondary] = useState('#14b8a6')
  const [accent, setAccent] = useState('#5eead4')
  const [logo, setLogo] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    setPrimary(branding?.primaryColor || '#0d9488')
    setSecondary(branding?.secondaryColor || '#14b8a6')
    setAccent(branding?.accentColor || '#5eead4')
    setLogo(branding?.logo || '')
  }, [branding])

  useEffect(() => {
    // Lightweight role load from cookie set on login; for stronger security, also rely on backend role checks on PUT
    try {
      const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
      const r = m ? decodeURIComponent(m[1]) : ''
      setRole((r || '').toLowerCase())
    } catch {}
  }, [])

  const save = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const tenant = (() => { try { const m=document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m?decodeURIComponent(m[1]):'' } catch { return '' } })()
      const res = await fetch('/api/proxy/tenants/me/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(tenant ? { 'x-tenant': tenant } : {}) },
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

  const onLogoFile = async (file: File) => {
    try {
      setError('')
      setSuccess('')
      setUploading(true)
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.onload = () => resolve(String(reader.result || ''))
        reader.readAsDataURL(file)
      })
      const tenant = (() => { try { const m=document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m?decodeURIComponent(m[1]):'' } catch { return '' } })()
      let res = await fetch('/api/proxy/tenants/me/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tenant ? { 'x-tenant': tenant } : {}) },
        body: JSON.stringify({ dataUrl })
      })
      let data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Fallback path
        res = await fetch('/api/proxy/tenants/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(tenant ? { 'x-tenant': tenant } : {}) },
          body: JSON.stringify({ dataUrl })
        })
        data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.message || data.error || 'Logo upload failed')
      }
      if (data.logo) setLogo(String(data.logo))
      setSuccess('Logo uploaded')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logo upload failed')
    } finally {
      setUploading(false)
    }
  }

  const disabled = role !== 'admin'

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Branding & Appearance</h2>
      {disabled && (
        <div className="mb-4 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
          Only admins can edit branding. You can view current values below.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex items-center gap-3 opacity-100">
          <span className="w-32">Primary</span>
          <input disabled={disabled} type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="h-10 w-16" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-32">Secondary</span>
          <input disabled={disabled} type="color" value={secondary} onChange={e => setSecondary(e.target.value)} className="h-10 w-16" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-32">Accent</span>
          <input disabled={disabled} type="color" value={accent} onChange={e => setAccent(e.target.value)} className="h-10 w-16" />
        </label>
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <label className="flex items-center gap-3">
            <span className="w-32">Logo URL</span>
            <input disabled={disabled} type="url" value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://... or /assets/..." className="flex-1 border rounded px-3 py-2" />
          </label>
          <div className="flex items-center gap-3">
            <input disabled={disabled || uploading} type="file" accept="image/png,image/jpeg" onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f) }} className="border rounded px-2 py-1" />
            <span className="text-xs text-gray-500">Max 2MB, up to 512x512</span>
            {uploading && <span className="text-sm text-gray-600">Uploading...</span>}
            {logo && <img src={logo} alt="Logo preview" className="h-8 w-auto object-contain" />}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving || disabled} className="px-4 py-2 rounded text-white disabled:opacity-50" style={{ backgroundColor: 'var(--brand-primary)' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {error && <span className="text-rose-600 text-sm">{error}</span>}
        {success && <span className="text-green-600 text-sm">{success}</span>}
      </div>
    </div>
  );
}