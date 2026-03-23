'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [institutionId, setInstitutionId] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!institutionId.trim() || !email.trim()) {
      setError('Institution ID and email are required')
      return
    }
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), tenant_code: institutionId.trim() })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send reset link')
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-600 text-sm mb-6">
            If an account exists with that email, we&apos;ve sent a password reset link. Check your inbox and spam folder.
          </p>
          <Link href="/" className="text-teal-600 hover:text-teal-700 font-medium text-sm">Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Forgot password</h1>
        <p className="text-gray-600 text-sm mb-6">Enter your Institution ID and email. We&apos;ll send a reset link if the account exists.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-1">Institution ID</label>
            <input
              id="institution"
              type="text"
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
              placeholder="e.g. 1 or tenant001"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
              placeholder="name@institution.com"
              required
            />
          </div>
          {error && <div className="p-2 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{error}</div>}
          <button type="submit" className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700">
            Send reset link
          </button>
        </form>
        <Link href="/" className="block mt-4 text-center text-teal-600 hover:text-teal-700 font-medium text-sm">Back to login</Link>
      </div>
    </div>
  )
}
