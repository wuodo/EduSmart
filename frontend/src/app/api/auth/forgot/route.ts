import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const { email } = (await request.json()) || {}
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    const resp = await fetch(`${BACKEND}/api/users/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.status })
  } catch (_e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

