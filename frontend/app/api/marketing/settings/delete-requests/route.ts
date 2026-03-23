import { NextRequest, NextResponse } from 'next/server'
import { addAuditLog } from '../_auditStore'
import { getCurrentUser } from '../_getCurrentUser'

type DeleteRequest = {
  id: string
  module: string
  itemId: string | number
  reason?: string
  requestedBy?: string
  requestedByRole?: string
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
}

let requests: DeleteRequest[] = []

export async function GET() {
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const user = await getCurrentUser(req)
    const requestedBy = user?.email || undefined
    const requestedByRole = user?.role || undefined
    const r: DeleteRequest = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      module: String(body?.module || 'unknown'),
      itemId: body?.itemId ?? 'unknown',
      reason: body?.reason || undefined,
      requestedBy,
      requestedByRole,
      createdAt: Date.now(),
      status: 'pending'
    }
    requests.unshift(r)
    addAuditLog({ action: 'delete_permission_request', module: r.module, user: requestedBy, details: { itemId: r.itemId, reason: r.reason } })
    return NextResponse.json({ success: true, request: r })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create request' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status } = body || {}
    const idx = requests.findIndex(x => x.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['approved', 'rejected'].includes(String(status))) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    requests[idx].status = status
    addAuditLog({ action: 'delete_permission_' + status, module: requests[idx].module, details: { requestId: id, itemId: requests[idx].itemId } })
    return NextResponse.json({ success: true, request: requests[idx] })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update request' }, { status: 400 })
  }
}

