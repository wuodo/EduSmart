import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const origin = req.nextUrl.origin
  const body = await req.text()
  const resp = await fetch(`${origin}/api/proxy/calendar/tasks/${params.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': req.headers.get('content-type') || 'application/json' },
    body
  })
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    return NextResponse.json(json, { status: resp.status })
  } catch {
    return NextResponse.json({ success: resp.ok }, { status: resp.ok ? 200 : 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const origin = req.nextUrl.origin
  const resp = await fetch(`${origin}/api/proxy/calendar/tasks/${params.id}`, { method: 'DELETE' })
  return new NextResponse(null, { status: resp.status })
}


