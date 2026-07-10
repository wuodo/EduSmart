import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export async function getStaffPerformance(req: Request, res: Response) {
  try {
    const tenantId = ((req as any).tenant as { id: number } | undefined)?.id;
    if (!tenantId) { res.status(400).json({ success: false, message: 'Tenant required' }); return; }

    const staff = await prisma.user.findMany({ where: { tenantId } });
    const now = new Date();
    const results = [];

    for (const user of staff) {
      const totalInquiries = await prisma.inquiry.count({ where: { createdBy: user.email, tenantId } });
      const hotLeads = await prisma.inquiry.count({ where: { createdBy: user.email, tenantId, status: 'Hot' } });
      const pendingFollowups = await prisma.followup.count({ where: { assignedTo: user.email, tenantId, status: 'pending' } });
      const overdueFollowups = await prisma.followup.count({ where: { assignedTo: user.email, tenantId, status: 'pending', scheduledFor: { lte: now } } });
      const completedFollowups = await prisma.followup.count({ where: { assignedTo: user.email, tenantId, status: 'completed' } });
      const conversions = await prisma.inquiry.count({ where: { createdBy: user.email, tenantId, status: 'Paid' } });
      const conversionRate = totalInquiries > 0 ? Math.round((conversions / totalInquiries) * 100) : 0;
      const followupRate = totalInquiries > 0 ? Math.round((completedFollowups / totalInquiries) * 100) : 0;

      results.push({
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        totalInquiries,
        hotLeads,
        pendingFollowups,
        overdueFollowups,
        completedFollowups,
        conversions,
        conversionRate,
        followupRate,
        score: conversionRate + followupRate,
      });
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ success: true, staff: results });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getSlaSummary(req: Request, res: Response) {
  try {
    const tenantId = ((req as any).tenant as { id: number } | undefined)?.id;
    if (!tenantId) { res.status(400).json({ success: false, message: 'Tenant required' }); return; }

    const now = new Date();
    const slaThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const breached = await prisma.inquiry.findMany({
      where: {
        tenantId,
        firstResponseAt: null,
        createdAt: { lte: slaThreshold },
        status: { notIn: ['Registered', 'Paid', 'Cancelled'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const within24h = await prisma.inquiry.count({
      where: { tenantId, firstResponseAt: { not: null }, createdAt: { gte: slaThreshold } },
    });
    const totalNew = await prisma.inquiry.count({
      where: { tenantId, createdAt: { gte: slaThreshold } },
    });

    res.json({
      success: true,
      sla: {
        slaComplianceRate: totalNew > 0 ? Math.round((within24h / totalNew) * 100) : 100,
        breachedCount: breached.length,
        totalNew,
        respondedWithin24h: within24h,
        breaches: breached.map(i => ({
          id: i.id,
          fullName: i.fullName,
          email: i.email,
          createdAt: i.createdAt,
          assignedTo: i.assignedTo,
          status: i.status,
          score: i.score,
        })),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function getEscalationSummary(req: Request, res: Response) {
  try {
    const tenantId = ((req as any).tenant as { id: number } | undefined)?.id;
    if (!tenantId) { res.status(400).json({ success: false, message: 'Tenant required' }); return; }

    const now = new Date();
    const critical = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const criticalOverdue = await prisma.followup.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lte: critical },
        tenantId,
      },
      include: { inquiry: { select: { fullName: true } } },
      orderBy: { scheduledFor: 'asc' },
    });

    const staffPending = await prisma.followup.groupBy({
      by: ['assignedTo'],
      where: { tenantId, status: 'pending' },
      _count: { id: true },
    });

    res.json({
      success: true,
      escalations: {
        criticalOverdue: criticalOverdue.map(f => ({
          id: f.id,
          type: f.type,
          assignedTo: f.assignedTo,
          scheduledFor: f.scheduledFor,
          inquiryName: f.inquiry.fullName,
          inquiryId: f.inquiryId,
        })),
        staffBacklog: staffPending.map(s => ({
          email: s.assignedTo,
          pendingCount: s._count.id,
        })),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}

export async function updateInquiryFirstResponse(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (!id) { res.status(400).json({ success: false, message: 'Inquiry ID required' }); return; }
    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: { firstResponseAt: new Date() },
    });
    res.json({ success: true, inquiry });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
}
