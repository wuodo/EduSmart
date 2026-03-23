import { NextRequest, NextResponse } from 'next/server'
import { addAuditLog } from '../_auditStore'
import { getCurrentUser } from '../_getCurrentUser'

type Approval = {
  id: string
  module: 'inquiries' | 'followups' | 'admission_letters'
  itemId: string | number
  officerEmail: string
  approvedAt: number
  approvedBy?: string
  readBy?: Record<string, number> // officerEmail -> timestamp
  status: 'approved' | 'rejected'
  itemName?: string
  reason?: string
}

let approvals: Approval[] = []

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req)
  const email = (user?.email || '').toLowerCase()
  const mine = email ? approvals.filter(a => a.officerEmail.toLowerCase() === email) : []
  return NextResponse.json({ approvals: mine })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const officerEmail = String(body?.officerEmail || '')
    if (!officerEmail) return NextResponse.json({ error: 'officerEmail required' }, { status: 400 })
    const itemId = body?.itemId
    const module = body?.module
    const user = await getCurrentUser(req)
    const approvedBy = user?.email || undefined
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    const approval: Approval = { id, officerEmail, itemId, module, approvedAt: Date.now(), approvedBy, readBy: {}, status: (body?.status === 'rejected' ? 'rejected' : 'approved'), itemName: body?.itemName, reason: body?.reason }
    approvals.unshift(approval)
    addAuditLog({ action: approval.status === 'approved' ? 'delete_permission_approved' : 'delete_permission_rejected', module, user: approvedBy, details: { officerEmail, itemId, reason: approval.reason } })

    // Persist to backend for authorization
    try {
      const backend = process.env.BACKEND_API_URL || ''
      const target = backend ? `${backend}/api/approvals` : `${req.nextUrl.origin}/api/proxy/approvals`
      await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerEmail, module, itemId, status: approval.status, itemName: approval.itemName, reason: approval.reason, approvedBy })
      })
    } catch {}
    return NextResponse.json({ success: true, approval })
  } catch {
    return NextResponse.json({ error: 'Failed to add approval' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, markReadFor } = body || {}
    const idx = approvals.findIndex(a => a.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (markReadFor) {
      approvals[idx].readBy = approvals[idx].readBy || {}
      approvals[idx].readBy![String(markReadFor).toLowerCase()] = Date.now()
    }
    return NextResponse.json({ success: true, approval: approvals[idx] })
  } catch {
    return NextResponse.json({ error: 'Failed to update approval' }, { status: 400 })
  }
}

