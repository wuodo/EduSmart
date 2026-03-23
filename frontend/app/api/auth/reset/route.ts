import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const { token, password, tenant_code } = (await request.json()) || {}
    if (!token || !password) return NextResponse.json({ error: 'Missing token or password' }, { status: 400 })
    const resp = await fetch(`${BACKEND}/api/users/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, tenant_code: tenant_code || undefined })
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


