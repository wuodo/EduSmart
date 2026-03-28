'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { cachedApiFetch } from '@/utils/apiClient'

export interface Branding {
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  logo?: string
  name?: string
  subdomain?: string
}

interface BrandingContextType {
  branding: Branding | null
  refresh: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined)

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding | null>(null)

  const refresh = async () => {
    try {
      const res = await cachedApiFetch('/tenants/me/branding', 60_000)
      if (res.ok) {
        const data = await res.json()
        setBranding(data.branding || null)
      }
    } catch (_) {
      // noop
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    // Default to a teal/green palette when tenant branding is not set
    const primary = branding?.primaryColor || '#0f766e' // teal-700
    const secondary = branding?.secondaryColor || '#22c55e' // green-500
    const accent = branding?.accentColor || '#14b8a6' // teal-500
    root.style.setProperty('--brand-primary', primary)
    root.style.setProperty('--brand-secondary', secondary)
    root.style.setProperty('--brand-accent', accent)

    // Convert HEX to HSL parts for Tailwind CSS variables (shadcn theme uses hsl(var(--primary)))
    const toHslParts = (hex: string): string => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
      if (!m) return '180 100% 25%'
      const r = parseInt(m[1], 16) / 255
      const g = parseInt(m[2], 16) / 255
      const b = parseInt(m[3], 16) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      let h = 0, s = 0
      const l = (max + min) / 2
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max - min)
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
        }
        h /= 6
      }
      const H = Math.round(h * 360)
      const S = Math.round(s * 100)
      const L = Math.round(l * 100)
      return `${H} ${S}% ${L}%`
    }

    // Update shadcn/tailwind theme variables so all bg-primary, text-primary*, hover, etc use brand colors
    root.style.setProperty('--primary', toHslParts(primary))
    root.style.setProperty('--secondary', toHslParts(secondary))
    root.style.setProperty('--accent', toHslParts(accent))
  }, [branding])

  const value = useMemo(() => ({ branding, refresh }), [branding])

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within a BrandingProvider')
  return ctx
}


