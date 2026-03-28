import { NextRequest, NextResponse } from 'next/server'

function backendBase() {
  return (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '')
}

export async function GET(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || ''
    const res = await fetch(`${backendBase()}/api/marketing-settings/automation`, {
      headers: { cookie },
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: (json as any)?.error || 'Load failed' }, { status: res.status })
    }
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Failed to load automation' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const cookie = req.headers.get('cookie') || ''
    const res = await fetch(`${backendBase()}/api/marketing-settings/automation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return NextResponse.json(json, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to save automation' }, { status: 500 })
  }
}
