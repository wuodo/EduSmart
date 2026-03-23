import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { role, email, password } = body || {}
    if (!role || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Resolve tenant from header, cookie, or body (supports ID or subdomain/name)
    let tenant = request.headers.get('x-tenant') || ''
    if (!tenant && body?.tenant != null) tenant = String(body.tenant)

    const res = await fetch(`${BACKEND}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tenant ? { 'x-tenant': tenant } : {}) },
      body: JSON.stringify({ role, email, password })
    })

    const data = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as any).error || 'Invalid credentials or not approved', backendStatus: res.status },
        { status: res.status }
      )
    }

    const response = NextResponse.json({ success: true, role: (data as any).role || role, name: (data as any).name || email }, { status: 200 })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) response.headers.set('set-cookie', setCookie)

    response.cookies.set('isAuthenticated', 'true', {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    response.cookies.set('role', String((data as any).role || role || ''), {
      httpOnly: false,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    if (tenant) {
      response.cookies.set('tenant', tenant, {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      })
    }
    return response
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

