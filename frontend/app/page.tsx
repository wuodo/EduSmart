'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Cookies from 'js-cookie'

const STORAGE_KEY = 'edusmart_last_institution_id'
const DEBOUNCE_MS = 400

type ActiveField = 'institution' | 'email' | 'password' | null

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning. Ready to make an impact today?'
  if (h < 17) return 'Good afternoon. Let\'s keep things moving.'
  return 'Good evening. You\'re doing great—keep going.'
}

export default function Home() {
  const router = useRouter()
  const [institutionId, setInstitutionId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(STORAGE_KEY) || ''
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [awaitingOtp, setAwaitingOtp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeField, setActiveField] = useState<ActiveField>(null)
  const [message, setMessage] = useState(getGreeting)
  const [institutionName, setInstitutionName] = useState<string | null>(null)
  const msgDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tenantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (institutionId.trim()) {
      localStorage.setItem(STORAGE_KEY, institutionId.trim())
    }
  }, [institutionId])

  // Fetch tenant name by code (debounced)
  const fetchTenantName = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) {
      setInstitutionName(null)
      return
    }
    try {
      const res = await fetch(`/api/proxy/tenants/by-code?code=${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      setInstitutionName(data?.name ?? null)
    } catch {
      setInstitutionName(null)
    }
  }, [])

  // Message updates for field interaction (immediate on focus, debounced revert on blur)
  useEffect(() => {
    if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current)

    if (activeField === 'institution') {
      if (institutionName) {
        setMessage(`Welcome back to ${institutionName}`)
      } else if (institutionId.trim().length > 0) {
        setMessage('Great start. Let\'s get you into your workspace.')
      } else {
        setMessage(getGreeting())
      }
      return
    }

    if (activeField === 'email') {
      setMessage('Almost there. Your dashboard is waiting.')
      return
    }

    if (activeField === 'password') {
      setMessage('Secure and steady. You\'re one step away.')
      return
    }

    // On blur - revert to greeting after short delay
    msgDebounceRef.current = setTimeout(() => {
      setMessage(getGreeting())
    }, 600)
    return () => {
      if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current)
    }
  }, [activeField, institutionId, institutionName])

  // Debounced tenant lookup when institution ID changes
  useEffect(() => {
    if (tenantDebounceRef.current) clearTimeout(tenantDebounceRef.current)
    tenantDebounceRef.current = setTimeout(() => {
      fetchTenantName(institutionId)
    }, DEBOUNCE_MS)
    return () => {
      if (tenantDebounceRef.current) clearTimeout(tenantDebounceRef.current)
    }
  }, [institutionId, fetchTenantName])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!institutionId.trim() || !email.trim() || !password.trim()) {
      setError('Invalid login credentials')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenant_code: institutionId.trim(),
          email: email.trim(),
          password,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Invalid login credentials')
      if (data?.requiresOtp) {
        setAwaitingOtp(true)
        setChallengeId(String(data.challengeId || ''))
        setMessage('Verification required. Enter the code sent to your email.')
        setPassword('')
        return
      }

      Cookies.set('isAuthenticated', 'true', { expires: 7 })
      if (data?.user?.role) Cookies.set('role', String(data.user.role), { expires: 7 })
      Cookies.set('tenant', institutionId.trim(), { expires: 7 })

      if (typeof window !== 'undefined') {
        localStorage.setItem('userEmail', email.trim())
        localStorage.setItem('userRole', String(data?.dbRole || 'admissions_officer'))
        if (data?.name) localStorage.setItem('userName', String(data.name))
      }

      router.replace('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid login credentials')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!challengeId || !otpCode.trim()) {
      setError('Enter the verification code')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeId,
          code: otpCode.trim(),
          tenant_code: institutionId.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Verification failed')
      Cookies.set('isAuthenticated', 'true', { expires: 7 })
      if (data?.user?.role) Cookies.set('role', String(data.user.role), { expires: 7 })
      Cookies.set('tenant', institutionId.trim(), { expires: 7 })
      if (typeof window !== 'undefined') {
        localStorage.setItem('userEmail', email.trim())
        localStorage.setItem('userRole', String(data?.dbRole || 'admissions_officer'))
        if (data?.name) localStorage.setItem('userName', String(data.name))
      }
      router.replace('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-6"
      style={{
        background: 'linear-gradient(180deg, #f0fdfa 0%, #e6fffa 50%, #ccfbf1 100%)',
      }}
    >
      {/* Centered card container */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row min-h-[480px] md:min-h-[520px]">
        {/* Left: Experience Panel */}
        <div
          className="relative flex-1 flex flex-col items-center justify-center p-8 md:p-10 text-white min-h-[200px] md:min-h-0"
          style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 40%, #115e59 100%)',
          }}
        >
          {/* Subtle geometric background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.07]">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-2 border-white" />
            <div className="absolute top-1/2 -left-16 w-64 h-64 rounded-full border-2 border-white" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
            <div className="text-sm font-medium tracking-tight opacity-80">EduSmart</div>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 mb-4">Welcome to EdusSmart CRM</h1>
            <p
              key={message}
              className="text-base md:text-lg text-gradient-animate animate-message-fade min-h-[2.5rem]"
            >
              {message}
            </p>
            <p className="text-sm text-white/70 mt-3">Empowering institutions. Simplifying admissions.</p>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Enter your credentials to continue</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={awaitingOtp ? verifyOtp : handleSubmit}>
            <div>
                <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-1">
                  Institution ID
                </label>
                <input
                  id="institution"
                  type="text"
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  onFocus={() => setActiveField('institution')}
                  onBlur={() => setActiveField(null)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                  placeholder="e.g. 1 or tenant001"
                  required
                  autoComplete="organization"
                />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setActiveField('email')}
                  onBlur={() => setActiveField(null)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                  placeholder="name@institution.com"
                  required
                  autoComplete="email"
                />
              </div>
              {!awaitingOtp && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setActiveField('password')}
                  onBlur={() => setActiveField(null)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>
              )}
              {awaitingOtp && (
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                    placeholder="Enter 6-digit code"
                    required
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-70 transition-colors"
              >
                {loading ? (awaitingOtp ? 'Verifying...' : 'Signing in...') : (awaitingOtp ? 'Verify Code' : 'Sign In')}
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link href="/forgot-password" className="text-teal-600 hover:text-teal-700">Forgot password?</Link>
              </p>
            </form>
        </div>
      </div>
    </div>
  )
}
