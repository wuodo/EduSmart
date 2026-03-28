"use client"

import { useBranding } from '@/contexts/BrandingContext'
import { useEffect, useState } from 'react'

function ColorRow({ label, value, onChange, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; disabled: boolean; hint?: string
}) {
  return (
    <label className="flex items-center gap-3 group">
      <div
        className="h-7 w-7 rounded border border-gray-300 flex-shrink-0 shadow-sm"
        style={{ backgroundColor: value }}
      />
      <input
        disabled={disabled}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
      />
      <div className="min-w-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</p>}
      </div>
      <span className="ml-auto text-xs font-mono text-gray-400">{value}</span>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-5">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  )
}

export default function Branding() {
  const { branding, refresh } = useBranding()

  const [primary,   setPrimary]   = useState('#0d9488')
  const [secondary, setSecondary] = useState('#14b8a6')
  const [accent,    setAccent]    = useState('#5eead4')
  const [logo,      setLogo]      = useState('')

  const [headerIconColor,     setHeaderIconColor]     = useState('#ffffff')
  const [sidebarBg,           setSidebarBg]           = useState('#0d9488')
  const [sidebarTextColor,    setSidebarTextColor]    = useState('#ffffff')
  const [sidebarActiveColor,  setSidebarActiveColor]  = useState('#5eead4')
  const [darkHeaderBg,        setDarkHeaderBg]        = useState('#1e293b')
  const [darkSidebarBg,       setDarkSidebarBg]       = useState('#0f172a')
  const [tableHeaderBg,       setTableHeaderBg]       = useState('#f1f5f9')
  const [tableHeaderTextColor,setTableHeaderTextColor]= useState('#374151')
  const [actionBtnColor,      setActionBtnColor]      = useState('#0d9488')
  const [actionBtnTextColor,  setActionBtnTextColor]  = useState('#ffffff')

  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [role,      setRole]      = useState('')

  useEffect(() => {
    const p = branding?.primaryColor || '#0d9488'
    setPrimary(p)
    setSecondary(branding?.secondaryColor || '#14b8a6')
    setAccent(branding?.accentColor || '#5eead4')
    setLogo(branding?.logo || '')
    const cfg = branding?.brandingConfig || {}
    setHeaderIconColor(    cfg.headerIconColor     || '#ffffff')
    setSidebarBg(          cfg.sidebarBg           || p)
    setSidebarTextColor(   cfg.sidebarTextColor    || '#ffffff')
    setSidebarActiveColor( cfg.sidebarActiveColor  || branding?.accentColor || '#5eead4')
    setDarkHeaderBg(       cfg.darkHeaderBg        || '#1e293b')
    setDarkSidebarBg(      cfg.darkSidebarBg       || '#0f172a')
    setTableHeaderBg(      cfg.tableHeaderBg       || '#f1f5f9')
    setTableHeaderTextColor(cfg.tableHeaderTextColor || '#374151')
    setActionBtnColor(     cfg.actionBtnColor      || p)
    setActionBtnTextColor( cfg.actionBtnTextColor  || '#ffffff')
  }, [branding])

  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )role=([^;]+)/)
      setRole((m ? decodeURIComponent(m[1]) : '').toLowerCase())
    } catch {}
  }, [])

  const getTenant = () => {
    try { const m = document.cookie.match(/(?:^|; )tenant=([^;]+)/); return m ? decodeURIComponent(m[1]) : '' } catch { return '' }
  }

  const save = async () => {
    try {
      setSaving(true); setError(''); setSuccess('')
      const res = await fetch('/api/proxy/tenants/me/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(getTenant() ? { 'x-tenant': getTenant() } : {}) },
        body: JSON.stringify({
          primaryColor: primary, secondaryColor: secondary, accentColor: accent, logo,
          brandingConfig: {
            headerIconColor, sidebarBg, sidebarTextColor, sidebarActiveColor,
            darkHeaderBg, darkSidebarBg, tableHeaderBg, tableHeaderTextColor,
            actionBtnColor, actionBtnTextColor,
          },
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to save')
      setSuccess('Branding updated successfully')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const onLogoFile = async (file: File) => {
    try {
      setError(''); setSuccess(''); setUploading(true)
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.onload  = () => resolve(String(reader.result || ''))
        reader.readAsDataURL(file)
      })
      const tenant = getTenant()
      let res = await fetch('/api/proxy/tenants/me/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tenant ? { 'x-tenant': tenant } : {}) },
        body: JSON.stringify({ dataUrl })
      })
      let data = await res.json().catch(() => ({}))
      if (!res.ok) {
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
      <h2 className="text-xl font-semibold mb-1">Branding &amp; Appearance</h2>
      <p className="text-sm text-gray-500 mb-4">Customise colors for header, sidebar, tables, and action buttons across all modules.</p>

      {disabled && (
        <div className="mb-4 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
          Only admins can edit branding. You can view current values below.
        </div>
      )}

      <Section title="Base Colors">
        <ColorRow disabled={disabled} label="Primary"   value={primary}   onChange={setPrimary}   hint="Header bar background, key accents" />
        <ColorRow disabled={disabled} label="Secondary" value={secondary} onChange={setSecondary} hint="Badge highlights, secondary actions" />
        <ColorRow disabled={disabled} label="Accent"    value={accent}    onChange={setAccent}    hint="Hover states, active borders" />
      </Section>

      <Section title="Header Bar">
        <ColorRow disabled={disabled} label="Icon &amp; Text Color" value={headerIconColor} onChange={setHeaderIconColor} hint="Icons, buttons, text in the top header bar" />
      </Section>

      <Section title="Sidebar">
        <ColorRow disabled={disabled} label="Background"    value={sidebarBg}          onChange={setSidebarBg}          hint="Sidebar panel background" />
        <ColorRow disabled={disabled} label="Text &amp; Icons" value={sidebarTextColor}  onChange={setSidebarTextColor}  hint="Nav item text and icon color" />
        <ColorRow disabled={disabled} label="Active Item"   value={sidebarActiveColor}  onChange={setSidebarActiveColor} hint="Left border on active nav item" />
      </Section>

      <Section title="Dark Theme">
        <ColorRow disabled={disabled} label="Dark Header BG"  value={darkHeaderBg}  onChange={setDarkHeaderBg}  hint="Header background in dark mode" />
        <ColorRow disabled={disabled} label="Dark Sidebar BG" value={darkSidebarBg} onChange={setDarkSidebarBg} hint="Sidebar background in dark mode" />
      </Section>

      <Section title="Table Headers">
        <ColorRow disabled={disabled} label="Header Background" value={tableHeaderBg}        onChange={setTableHeaderBg}        hint="thead row background in all tables" />
        <ColorRow disabled={disabled} label="Header Text"       value={tableHeaderTextColor} onChange={setTableHeaderTextColor} hint="Column header label text color" />
      </Section>

      <Section title="Action Buttons">
        <ColorRow disabled={disabled} label="Button Background" value={actionBtnColor}     onChange={setActionBtnColor}     hint="Primary action buttons in every module" />
        <ColorRow disabled={disabled} label="Button Text"       value={actionBtnTextColor} onChange={setActionBtnTextColor} hint="Text / icon color on action buttons" />
      </Section>

      <Section title="Logo">
        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-center gap-3">
            <span className="text-sm font-medium w-24">Logo URL</span>
            <input
              disabled={disabled}
              type="url"
              value={logo}
              onChange={e => setLogo(e.target.value)}
              placeholder="https://... or /assets/..."
              className="flex-1 border rounded px-3 py-1.5 text-sm disabled:opacity-60"
            />
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              disabled={disabled || uploading}
              type="file"
              accept="image/png,image/jpeg"
              onChange={e => { const f = e.target.files?.[0]; if (f) onLogoFile(f) }}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-xs text-gray-400">PNG/JPG · Max 2 MB · up to 512×512 px</span>
            {uploading && <span className="text-xs text-gray-500 animate-pulse">Uploading…</span>}
            {logo && <img src={logo} alt="Logo preview" className="h-8 w-auto object-contain border rounded" />}
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={save}
          disabled={saving || disabled}
          className="px-5 py-2 rounded text-sm font-semibold text-white disabled:opacity-50 transition"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {error   && <span className="text-rose-600 text-sm">{error}</span>}
        {success && <span className="text-green-600 text-sm">{success}</span>}
      </div>
    </div>
  )
}