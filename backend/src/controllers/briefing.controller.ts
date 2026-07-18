import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export async function getDailyBriefing(req: Request, res: Response) {
  try {
    const tenant = (req as any).tenant as { id: number } | undefined;
    const tenantId = tenant?.id;
    if (!tenantId) { res.status(400).json({ error: 'Tenant required' }); return; }

    const email = ((req as any).user?.email || '').toLowerCase();
    const userName = ((req as any).user?.name || '').trim();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const [hotLeads, newToday, overdueFollowups, pendingFollowups, conversions, unreadEmails, tasksDue, totalInquiries] = await Promise.all([
      prisma.inquiry.count({ where: { tenantId, status: 'Hot', OR: [{ assignedTo: email }, { createdBy: email }] } }),
      prisma.inquiry.count({ where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd }, OR: [{ assignedTo: email }, { createdBy: email }] } }),
      prisma.followup.count({ where: { tenantId, assignedTo: email, status: 'pending', scheduledFor: { lte: now } } }),
      prisma.followup.count({ where: { tenantId, assignedTo: email, status: 'pending', scheduledFor: { gte: now } } }),
      prisma.inquiry.count({ where: { tenantId, paymentStatus: 'Paid', OR: [{ assignedTo: email }, { createdBy: email }] } }),
      0,
      prisma.task.count({ where: { tenantId, ownerEmail: email, status: { not: 'completed' }, dueDate: { lte: now } } }),
      prisma.inquiry.count({ where: { tenantId, OR: [{ assignedTo: email }, { createdBy: email }] } }),
    ]);

    const conversionRate = totalInquiries > 0 ? Math.round((conversions / totalInquiries) * 100) : 0;

    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    res.json({
      success: true,
      briefing: {
        greeting,
        userName: userName ? userName.split(' ')[0] : '',
        hotLeads,
        newToday,
        overdueFollowups,
        pendingFollowups,
        conversions,
        conversionRate,
        unreadEmails,
        tasksDue,
        score: Math.max(0, Math.min(100, 50 + conversionRate * 2 - overdueFollowups * 5)),
        priorityMessage: overdueFollowups > 0
          ? `You have ${overdueFollowups} overdue follow-up(s) — start with those`
          : hotLeads > 0
            ? `You have ${hotLeads} hot lead(s) ready for action`
            : 'All caught up — review new inquiries',
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
