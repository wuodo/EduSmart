'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const token = params.get('token') || ''
  const tenant = params.get('tenant') || ''

  useEffect(() => {
    if (!token) setError('Missing token. Please use the link sent to your email.')
  }, [token])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!token) { setError('Missing token'); return }
    if (!tenant) { setError('Missing Institution ID. Use the full link from your email.'); return }
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    try {
      const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, tenant_code: tenant }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')
      setSuccess('Password reset successful. Redirecting to login...')
      setTimeout(() => router.push('/'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h1 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Reset Password</h1>
        <input type="password" placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full mb-3 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        <input type="password" placeholder="Confirm new password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full mb-3 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
        {error && <div className="text-rose-600 dark:text-rose-400 text-sm mb-2">{error}</div>}
        {success && <div className="text-green-600 dark:text-green-400 text-sm mb-2">{success}</div>}
        <button type="submit" className="w-full bg-orange-600 text-white py-2 rounded font-semibold">Reset Password</button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}


