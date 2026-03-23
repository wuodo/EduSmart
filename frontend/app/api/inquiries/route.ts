import { NextRequest, NextResponse } from 'next/server'

// Fallback API route: some parts of the UI (or old builds) call /api/inquiries directly.
// We forward to the backend so GET /api/inquiries never 404s on the Next server.
let BACKEND = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
if (BACKEND.includes('localhost:3000') || BACKEND.endsWith(':3000')) BACKEND = 'http://localhost:5000'
BACKEND = BACKEND.replace(/\/+$/, '').replace(/\/api$/, '')

function forwardHeaders(req: NextRequest) {
  const h: Record<string, string> = {}
  const auth = req.headers.get('authorization')
  const cookie = req.headers.get('cookie')
  let tenant = req.headers.get('x-tenant') || ''
  if (!tenant) {
    const cookieTenant = req.cookies.get('tenant')?.value
    if (cookieTenant) tenant = cookieTenant
  }
  if (auth) h['authorization'] = auth
  if (tenant) h['x-tenant'] = tenant
  if (cookie) h['cookie'] = cookie
  return h
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search || ''
  const res = await fetch(`${BACKEND}/api/inquiries${search}`, {
    cache: 'no-store',
    headers: forwardHeaders(req),
  })
  const arrayBuffer = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const response = new NextResponse(arrayBuffer, { status: res.status, headers: { 'Content-Type': contentType } })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) response.headers.set('set-cookie', setCookie)
  return response
}

