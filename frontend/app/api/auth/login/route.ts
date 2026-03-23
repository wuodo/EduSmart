import { NextRequest, NextResponse } from 'next/server'
import { addAuditLog } from '../../marketing/settings/_auditStore'

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant_code, email, password } = body
    if (!tenant_code || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const res = await fetch(`${BACKEND}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': clientIp,
      },
      body: JSON.stringify({ tenant_code, email, password })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || 'Invalid login credentials' },
        { status: res.status }
      )
    }
    if (data?.requiresOtp && data?.challengeId) {
      return NextResponse.json({ requiresOtp: true, challengeId: data.challengeId, message: data?.message || 'Verification required' }, { status: 200 })
    }

    // Audit log: login
    addAuditLog({
      action: 'login',
      module: 'auth',
      user: email,
      details: { role: data?.user?.role, tenant_code }
    })

    const response = NextResponse.json({
      success: true,
      token: data?.token,
      user: data?.user,
      dbRole: data?.dbRole,
      name: data?.name || email
    }, { status: 200 })
    // Set session cookie for frontend domain (backend sets it for backend domain, so we set it explicitly)
    const token = data?.token
    if (token) {
      response.cookies.set('session', token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }
    response.cookies.set('isAuthenticated', 'true', {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    response.cookies.set('role', (data?.dbRole || data?.user?.role || '').toString(), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    response.cookies.set('tenant', String(tenant_code), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 