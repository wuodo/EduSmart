import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) || {}
    const { challengeId, code, tenant_code } = body
    if (!challengeId || !code || !tenant_code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const res = await fetch(`${BACKEND}/api/users/login/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp },
      body: JSON.stringify({ challengeId, code, tenant_code }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data?.error || 'Verification failed' }, { status: res.status })

    const response = NextResponse.json(data, { status: 200 })
    const token = data?.token
    if (token) {
      response.cookies.set('session', token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      })
      response.cookies.set('isAuthenticated', 'true', { httpOnly: false, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
      response.cookies.set('role', (data?.dbRole || data?.user?.role || '').toString(), { httpOnly: false, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
      response.cookies.set('tenant', String(tenant_code), { httpOnly: false, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    }
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

