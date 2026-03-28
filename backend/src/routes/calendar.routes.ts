import express from 'express'
import prisma from '../lib/prisma'

const router = express.Router()

function safeJson(res: express.Response, body: any, status?: number) {
  if (res.headersSent) return
  if (status) res.status(status)
  res.json(body)
}

// Calendar events: followups + tasks (scoped by tenant)
router.get('/events', async (req, res) => {
  try {
    const followups = await prisma.followup.findMany({
      where: { tenantId: (req as any).tenant?.id },
      select: { id: true, inquiryName: true, scheduledFor: true, status: true },
      take: 500,
      orderBy: { scheduledFor: 'asc' },
    })
    const tasks = await prisma.task.findMany({
      where: { tenantId: (req as any).tenant?.id },
      take: 500,
      orderBy: { dueDate: 'asc' },
    })
    const events = [
      ...followups.map(f => ({
        id: `followup-${f.id}`,
        title: `Follow-up: ${f.inquiryName}`,
        date: f.scheduledFor,
        type: 'followup',
        status: f.status
      })),
      ...tasks.map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        date: t.dueDate,
        type: 'task',
        status: t.status
      }))
    ]
    return safeJson(res, { events })
  } catch (e) {
    return safeJson(res, { error: 'Failed to fetch calendar events', details: e }, 500)
  }
})

// Tasks CRUD (scoped by tenant)
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
    let inquiryIdNum: number | undefined
    if (inquiryId !== undefined && inquiryId !== null && String(inquiryId).trim() !== '') {
      const n = parseInt(String(inquiryId), 10)
      if (!Number.isNaN(n)) {
        const exists = await prisma.inquiry.findFirst({ where: { id: n, tenantId: tid } })
        if (exists) inquiryIdNum = n
      }
    }
    const task = await prisma.task.create({ 
      data: { 
        title, 
        description, 
        dueDate: dueDate ? new Date(dueDate) : null, 
        status: status || 'pending', 
        createdBy, 
        ownerEmail, 
        visibility, 
        type, 
        outcome, 
        reminderAt: reminderAt ? new Date(reminderAt) : null,
        tenantId: tid,
        inquiryId: inquiryIdNum ?? null,
      } 
    })
    return safeJson(res, { task }, 201)
  } catch (e) {
    return safeJson(res, { error: 'Failed to create task' }, 500)
  }
})

router.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, dueDate, status, ownerEmail, visibility, type, outcome, reminderAt } = req.body || {}
    const task = await prisma.task.update({ 
      where: { 
        id: Number(id),
        tenantId: (req as any).tenant?.id
      }, 
      data: { 
        title, 
        description, 
        dueDate: dueDate ? new Date(dueDate) : undefined, 
        status, 
        ownerEmail, 
        visibility, 
        type, 
        outcome, 
        reminderAt: reminderAt ? new Date(reminderAt) : undefined 
      } 
    })
    return safeJson(res, { task })
  } catch (e) {
    return safeJson(res, { error: 'Failed to update task' }, 500)
  }
})

router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params
    await prisma.task.delete({ 
      where: { 
        id: Number(id),
        tenantId: (req as any).tenant?.id
      } 
    })
    return safeJson(res, { success: true })
  } catch (e) {
    return safeJson(res, { error: 'Failed to delete task' }, 500)
  }
})

// Quick complete with optional outcome (scoped by tenant)
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { id } = req.params
    const { outcome } = req.body || {}
    const task = await prisma.task.update({ 
      where: { 
        id: Number(id),
        tenantId: (req as any).tenant?.id
      }, 
      data: { status: 'completed', outcome } 
    })
    return safeJson(res, { task })
  } catch (e) {
    return safeJson(res, { error: 'Failed to complete task' }, 500)
  }
})

// Due reminders within N minutes for an owner (scoped by tenant)
router.get('/reminders/due', async (req, res) => {
  try {
    const owner = String((req.query.owner as string) || '').trim()
    const within = parseInt(String(req.query.withinMinutes || '5'), 10)
    const now = new Date()
    const until = new Date(now.getTime() + within * 60 * 1000)
    const where: any = {
      status: { not: 'completed' },
      tenantId: (req as any).tenant?.id
    }
    if (owner) where.ownerEmail = owner
    if (req.query.reminderAt) {
      where.reminderAt = { gte: now, lte: until }
    }
    const tasks = await prisma.task.findMany({ where, take: 100 })
    return safeJson(res, { tasks })
  } catch (e) {
    return safeJson(res, { error: 'Failed to fetch due reminders' }, 500)
  }
})

export { router as calendarRoutes }


