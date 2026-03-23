import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const resp = await fetch(`${origin}/api/proxy/calendar/events`, { cache: 'no-store' })
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    return NextResponse.json(json, { status: resp.status })
  } catch {
    return NextResponse.json({ events: [] }, { status: 200 })
  }
}


