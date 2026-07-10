import express from 'express'
import prisma from '../lib/prisma'

const router = express.Router()

function safeJson(res: express.Response, body: any, status?: number) {
  if (res.headersSent) return
  if (status) res.status(status)
  res.json(body)
}

// Calendar events: followups + tasks with full metadata
router.get('/events', async (req, res) => {
  try {
    const tid = (req as any).tenant?.id
    const month = req.query.month ? parseInt(String(req.query.month)) : null
    const year = req.query.year ? parseInt(String(req.query.year)) : null
    const search = String(req.query.search || '').trim().toLowerCase()
    const type = String(req.query.type || '').trim().toLowerCase()

    const dateFilter: any = {}
    if (month !== null && year !== null) {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0, 23, 59, 59)
      dateFilter.scheduledFor = { gte: start, lte: end }
    }

    let followups = await prisma.followup.findMany({
      where: { tenantId: tid, ...dateFilter },
      select: { id: true, inquiryId: true, inquiryName: true, type: true, scheduledFor: true, status: true, notes: true, assignedTo: true },
      take: 500,
      orderBy: { scheduledFor: 'asc' },
    })

    if (search) {
      followups = followups.filter(f => f.inquiryName?.toLowerCase().includes(search) || f.notes?.toLowerCase().includes(search))
    }

    const taskWhere: any = { tenantId: tid }
    if (month !== null && year !== null) {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0, 23, 59, 59)
      taskWhere.dueDate = { gte: start, lte: end }
    }
    let tasks = await prisma.task.findMany({ where: taskWhere, take: 500, orderBy: { dueDate: 'asc' } })
    if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search))

    const mapFollowupColor = (t: string) => {
      const map: Record<string, string> = { call: '#0d9488', sms: '#6366f1', whatsapp: '#22c55e', email: '#3b82f6' }
      return map[t] || '#0d9488'
    }
    const mapTaskColor = (t: string) => {
      const map: Record<string, string> = { call: '#0d9488', email: '#3b82f6', meeting: '#f59e0b', demo: '#8b5cf6', other: '#6b7280' }
      return map[t] || '#6b7280'
    }

    const events = [
      ...followups.map(f => ({
        id: `followup-${f.id}`,
        dbId: f.id,
        title: `Follow-up: ${f.inquiryName}`,
        date: f.scheduledFor,
        type: 'followup',
        subType: f.type,
        status: f.status,
        notes: f.notes,
        assignedTo: f.assignedTo,
        inquiryId: f.inquiryId,
        color: mapFollowupColor(f.type),
      })),
      ...tasks.map(t => ({
        id: `task-${t.id}`,
        dbId: t.id,
        title: t.title,
        date: t.dueDate,
        type: 'task',
        subType: t.type,
        status: t.status,
        notes: t.description,
        ownerEmail: t.ownerEmail,
        inquiryId: t.inquiryId,
        color: mapTaskColor(t.type || 'other'),
      })),
    ]

    if (type && type !== 'all') events.filter(e => e.type === type)

    return safeJson(res, { events })
  } catch (e) {
    return safeJson(res, { error: 'Failed to fetch calendar events', details: e }, 500)
  }
})

// Create a follow-up from calendar
router.post('/followups', async (req, res) => {
  try {
    const { inquiryId, type, scheduledFor, notes, assignedTo } = req.body || {}
    const tid = (req as any).tenant?.id
    if (!inquiryId || !type || !scheduledFor) return safeJson(res, { error: 'inquiryId, type, scheduledFor required' }, 400)

    const inquiry = await prisma.inquiry.findFirst({ where: { id: Number(inquiryId), tenantId: tid } })
    if (!inquiry) return safeJson(res, { error: 'Inquiry not found' }, 404)

    const followup = await prisma.followup.create({
      data: {
        inquiryId: Number(inquiryId),
        inquiryName: inquiry.fullName,
        type,
        scheduledFor: new Date(scheduledFor),
        status: 'pending',
        notes,
        assignedTo: assignedTo || null,
        tenantId: tid,
      },
    })
    return safeJson(res, { followup }, 201)
  } catch (e) {
    return safeJson(res, { error: 'Failed to create follow-up' }, 500)
  }
})

// Complete a follow-up from calendar
router.post('/followups/:id/complete', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const tid = (req as any).tenant?.id
    const followup = await prisma.followup.update({
      where: { id, tenantId: tid },
      data: { status: 'completed', completedAt: new Date() },
    })
    await prisma.inquiry.updateMany({
      where: { id: followup.inquiryId, tenantId: tid, firstResponseAt: null },
      data: { firstResponseAt: new Date() },
    })
    return safeJson(res, { followup })
  } catch (e) {
    return safeJson(res, { error: 'Failed to complete follow-up' }, 500)
  }
})

// Reschedule a follow-up
router.put('/followups/:id/reschedule', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const { scheduledFor } = req.body || {}
    if (!scheduledFor) return safeJson(res, { error: 'scheduledFor required' }, 400)
    const followup = await prisma.followup.update({
      where: { id, tenantId: (req as any).tenant?.id },
      data: { scheduledFor: new Date(scheduledFor) },
    })
    return safeJson(res, { followup })
  } catch (e) {
    return safeJson(res, { error: 'Failed to reschedule follow-up' }, 500)
  }
})

// Reschedule a task
router.put('/tasks/:id/reschedule', async (req, res) => {
  try {
    const { dueDate } = req.body || {}
    if (!dueDate) return safeJson(res, { error: 'dueDate required' }, 400)
    const task = await prisma.task.update({
      where: { id: Number(req.params.id), tenantId: (req as any).tenant?.id },
      data: { dueDate: new Date(dueDate) },
    })
    return safeJson(res, { task })
  } catch (e) {
    return safeJson(res, { error: 'Failed to reschedule task' }, 500)
  }
})

// Tasks CRUD
router.get('/tasks', async (req, res) => {
  try {
    const owner = String((req.query.owner as string) || '').trim()
    const where: any = { tenantId: (req as any).tenant?.id }
    if (owner) where.ownerEmail = owner
    const tasks = await prisma.task.findMany({ where, orderBy: { dueDate: 'asc' }, take: 200 })
    return safeJson(res, { tasks })
  } catch (e) {
    return safeJson(res, { error: 'Failed to fetch tasks' }, 500)
  }
})

router.post('/tasks', async (req, res) => {
  try {
    const { title, description, dueDate, status, createdBy, ownerEmail, visibility, type, outcome, reminderAt, inquiryId } = req.body || {}
    if (!title) return safeJson(res, { error: 'Title is required' }, 400)
    const tid = (req as any).tenant?.id
    const task = await prisma.task.create({
      data: {
        title, description,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'pending', createdBy, ownerEmail, visibility, type, outcome,
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        tenantId: tid,
        inquiryId: inquiryId ? parseInt(String(inquiryId)) : null,
      }
    })
    return safeJson(res, { task }, 201)
  } catch (e) {
    return safeJson(res, { error: 'Failed to create task' }, 500)
  }
})

router.put('/tasks/:id', async (req, res) => {
  try {
    const { title, description, dueDate, status, ownerEmail, visibility, type, outcome, reminderAt } = req.body || {}
    const task = await prisma.task.update({
      where: { id: Number(req.params.id), tenantId: (req as any).tenant?.id },
      data: {
        title, description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status, ownerEmail, visibility, type, outcome,
        reminderAt: reminderAt ? new Date(reminderAt) : undefined,
      }
    })
    return safeJson(res, { task })
  } catch (e) {
    return safeJson(res, { error: 'Failed to update task' }, 500)
  }
})

router.delete('/tasks/:id', async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: Number(req.params.id), tenantId: (req as any).tenant?.id } })
    return safeJson(res, { success: true })
  } catch (e) {
    return safeJson(res, { error: 'Failed to delete task' }, 500)
  }
})

router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { outcome } = req.body || {}
    const task = await prisma.task.update({
      where: { id: Number(req.params.id), tenantId: (req as any).tenant?.id },
      data: { status: 'completed', outcome }
    })
    return safeJson(res, { task })
  } catch (e) {
    return safeJson(res, { error: 'Failed to complete task' }, 500)
  }
})

router.get('/reminders/due', async (req, res) => {
  try {
    const owner = String((req.query.owner as string) || '').trim()
    const within = parseInt(String(req.query.withinMinutes || '5'), 10)
    const now = new Date()
    const until = new Date(now.getTime() + within * 60 * 1000)
    const where: any = { status: { not: 'completed' }, tenantId: (req as any).tenant?.id }
    if (owner) where.ownerEmail = owner
    where.reminderAt = { gte: now, lte: until }
    const tasks = await prisma.task.findMany({ where, take: 100 })
    return safeJson(res, { tasks })
  } catch (e) {
    return safeJson(res, { error: 'Failed to fetch due reminders' }, 500)
  }
})

export { router as calendarRoutes }
