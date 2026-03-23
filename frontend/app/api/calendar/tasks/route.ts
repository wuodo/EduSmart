import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const resp = await fetch(`${origin}/api/proxy/calendar/tasks`, { cache: 'no-store' })
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    return NextResponse.json(json, { status: resp.status })
  } catch {
    return NextResponse.json({ tasks: [] }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin
  const body = await req.text()
  const resp = await fetch(`${origin}/api/proxy/calendar/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': req.headers.get('content-type') || 'application/json' },
    body
  })
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    return NextResponse.json(json, { status: resp.status })
  } catch {
    return NextResponse.json({ success: false, error: text || 'Backend error' }, { status: resp.status || 500 })
  }
}


