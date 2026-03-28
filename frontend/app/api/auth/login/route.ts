import { NextRequest, NextResponse } from 'next/server'
import { addAuditLog } from '../../marketing/settings/_auditStore'

const BACKEND = (process.env.BACKEND_API_URL || 'http://localhost:5000').replace(/\/+$/, '')
const LOGIN_TIMEOUT_MS = 35_000 // 35s — covers Render free-tier cold start (typically ≤30s)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant_code, email, password } = body
    if (!tenant_code || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.ip || 'unknown'

    // AbortController: cancel the backend call after LOGIN_TIMEOUT_MS.
    // Without this, a Render cold start hangs the server-side fetch for up to 120s,
    // the browser gives up, the user retries, and repeated failed attempts eventually
    // trigger the backend in-memory rate limiter (429).
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(`${BACKEND}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': clientIp,
        },
        body: JSON.stringify({ tenant_code, email, password }),
        signal: controller.signal,
      })
    } catch (fetchErr: any) {
      clearTimeout(timer)
      const isTimeout = fetchErr?.name === 'AbortError'
      console.warn('[login-proxy] backend fetch failed:', isTimeout ? 'timeout' : fetchErr?.message)
      return NextResponse.json(
        { error: isTimeout ? 'server_starting' : 'Backend unavailable', detail: isTimeout ? 'The server is waking up. Please try again in a moment.' : undefined },
        { status: 503 }
      )
    }
    clearTimeout(timer)

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Forward throttle metadata so the client can display accurate wait times
      // and we can diagnose whether the 429 comes from our code, Supabase, or Render.
      const responseHeaders: Record<string, string> = {}
      const retryAfter = res.headers.get('retry-after')
      const rateLimitLimit = res.headers.get('x-ratelimit-limit')
      const rateLimitRemaining = res.headers.get('x-ratelimit-remaining')
      const rateLimitReset = res.headers.get('x-ratelimit-reset')
      if (retryAfter) responseHeaders['retry-after'] = retryAfter
      if (rateLimitLimit) responseHeaders['x-ratelimit-limit'] = rateLimitLimit
      if (rateLimitRemaining) responseHeaders['x-ratelimit-remaining'] = rateLimitRemaining
      if (rateLimitReset) responseHeaders['x-ratelimit-reset'] = rateLimitReset
      if (res.status === 429) {
        console.warn('[login-proxy] 429 received from backend — source headers:', {
          'retry-after': retryAfter,
          'x-ratelimit-limit': rateLimitLimit,
          'x-ratelimit-remaining': rateLimitRemaining,
          'x-ratelimit-reset': rateLimitReset,
          error: data?.error,
        })
      }
      return NextResponse.json(
        { error: data?.error || 'Invalid login credentials' },
        { status: res.status, headers: responseHeaders }
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