import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { auditLogger } from '../utils/auditLogger';
import { archiveDeletedRecord } from '../utils/deletionArchive';
import { listArchivedRecords } from '../utils/deletionArchive';

function safeJson(res: Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}
import { getNurturingRecommendation, predictFollowupOutcome } from '../utils/followupNurturing';

function getRole(req: any): string {
  return String((req as any).user?.role || '').toLowerCase();
}
function getEmail(req: any): string {
  return String((req as any).user?.email || '');
}

async function getTenantId(req: any): Promise<number | null> {
  const t = req?.tenant;
  if (t?.id) return Number(t.id);
  const hdr = String(req?.headers?.['x-tenant'] || '').trim();
  if (hdr) {
    const idNum = parseInt(hdr, 10);
    if (!isNaN(idNum)) {
      const exists = await prisma.tenant.findFirst({ where: { id: idNum, isActive: true }, select: { id: true } });
      if (exists?.id) return Number(exists.id);
    }
  }
  if (process.env.NODE_ENV === 'development') {
    const fallback = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' }, select: { id: true } });
    if (fallback?.id) return Number(fallback.id);
    const any = await prisma.tenant.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (any?.id) return Number(any.id);
  }
  return null;
}

// Get all follow-ups
export const getFollowups = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    const email = getEmail(req);
    const tenantId = await getTenantId(req as any);
    const owner = String((req.query.owner as string) || '').trim();
    const inquiryIdParam = String((req.query.inquiryId as string) || '').trim();

    const where: any = { tenantId };
    if (inquiryIdParam) {
      const parsedId = parseInt(inquiryIdParam);
      if (!Number.isNaN(parsedId)) {
        where.inquiryId = parsedId;
      }
    }
    if (role === 'admissions_officer') {
      const e = (email || '__none__');
      where.OR = [
        { createdBy: { equals: e, mode: 'insensitive' } },
        { assignedTo: { equals: e, mode: 'insensitive' } },
        { inquiry: { tenantId, createdBy: { equals: e, mode: 'insensitive' } } },
      ];
    } else if (role === 'admin' || role === 'senior_staff') {
      if (owner) {
        const o = owner;
        where.OR = [
          { createdBy: { equals: o, mode: 'insensitive' } },
          { assignedTo: { equals: o, mode: 'insensitive' } },
          { inquiry: { tenantId, createdBy: { equals: o, mode: 'insensitive' } } },
        ];
      }
    }

    const followups = await prisma.followup.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      include: { inquiry: true }
    });
    const mapped = followups.map(f => ({
      ...f,
      inquiryName: f.inquiryName || f.inquiry?.fullName || '',
      inquiryPhone: f.inquiry?.phone || ''
    }));
    return safeJson(res, mapped);
  } catch (err) {
    console.error('Error fetching followups:', err);
    return safeJson(res, { error: 'Failed to fetch follow-ups' }, 500);
  }
};

// Get follow-up by id
export const getFollowupById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return safeJson(res, { error: 'Invalid follow-up id' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    const tenantId = await getTenantId(req as any);
    const followup = await prisma.followup.findFirst({
      where: { id, tenantId },
      include: { inquiry: true }
    });
    if (!followup) return safeJson(res, { error: 'Not found' }, 404);
    if (role === 'admissions_officer') {
      const isOwner = (
        followup.createdBy === email ||
        followup.assignedTo === email ||
        followup.inquiry?.createdBy === email
      );
      if (!isOwner) return safeJson(res, { error: 'Forbidden' }, 403);
    }
    return safeJson(res, {
      ...followup,
      inquiryName: followup.inquiryName || followup.inquiry?.fullName || '',
      inquiryPhone: followup.inquiry?.phone || ''
    });
  } catch (err) {
    console.error('Error fetching followup by id:', err);
    return safeJson(res, { error: 'Failed to fetch follow-up' }, 500);
  }
};

// Create follow-up
export const createFollowup = async (req: Request, res: Response) => {
  try {
    const creator = getEmail(req);
    const { inquiryId, type, scheduledFor, status, assignedTo, notes, completedAt, paymentStatus, paymentCode, paymentDate } = req.body;
    const tenantId = await getTenantId(req as any);
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: parseInt(inquiryId), tenantId }
    });
    if (!inquiry) {
      return safeJson(res, { error: 'Invalid inquiryId' }, 400);
    }
    const followup = await prisma.followup.create({
      data: {
        inquiryId: parseInt(inquiryId),
        inquiryName: inquiry.fullName,
        tenantId,
        type,
        scheduledFor: new Date(scheduledFor),
        status: status || 'pending',
        assignedTo,
        notes,
        completedAt: completedAt ? new Date(completedAt) : null,
        createdBy: creator || null,
        paymentStatus,
        paymentCode,
        paymentDate: paymentDate ? new Date(paymentDate) : null
      },
      include: { inquiry: true }
    });
    // If completed and paid, update inquiry
    if (status === 'completed' && paymentStatus === 'Paid') {
      await prisma.inquiry.update({
        where: { id: parseInt(inquiryId), tenantId },
        data: { paymentStatus, paymentCode, paymentDate: paymentDate ? new Date(paymentDate) : null }
      });
    }
    // Set firstResponseAt if not already set
    if (!inquiry.firstResponseAt) {
      await prisma.inquiry.update({
        where: { id: parseInt(inquiryId), tenantId },
        data: { firstResponseAt: new Date() }
      });
    }
    
    // Log followup creation
    await auditLogger.createFollowup(req, {
      followupId: followup.id,
      inquiryId: parseInt(inquiryId),
      followupData: { type, scheduledFor, status, assignedTo, notes, paymentStatus }
    });
    
    return safeJson(res, followup, 201);
  } catch (err) {
    console.error('Error creating followup:', err);
    return safeJson(res, { error: 'Failed to create follow-up' }, 500);
  }
};

// Update follow-up
export const updateFollowup = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    const email = getEmail(req);
    const id = parseInt(req.params.id);
    const tenantId = await getTenantId(req as any);

    const existing = await prisma.followup.findFirst({ where: { id, tenantId }, include: { inquiry: true } });
    if (!existing) return safeJson(res, { error: 'Follow-up not found' }, 404);

    if (role === 'admissions_officer') {
      const isOwner = (
        existing.createdBy === email ||
        existing.assignedTo === email ||
        existing.inquiry?.createdBy === email
      );
      if (!isOwner) return safeJson(res, { error: 'Forbidden' }, 403);
    }

    const { inquiryId, type, scheduledFor, status, assignedTo, notes, completedAt, paymentStatus, paymentCode, paymentDate } = req.body;
    // Ensure inquiry exists
    const inquiry = await prisma.inquiry.findFirst({ where: { id: parseInt(inquiryId), tenantId } });
    if (!inquiry) {
      return safeJson(res, { error: 'Invalid inquiryId' }, 400);
    }
    const followup = await prisma.followup.update({
      where: { id, tenantId } as any,
      data: {
        inquiryId: parseInt(inquiryId),
        inquiryName: inquiry.fullName,
        type,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : existing?.scheduledFor ?? new Date(),
        status,
        assignedTo,
        notes,
        completedAt: completedAt ? new Date(completedAt) : null,
        paymentStatus,
        paymentCode,
        paymentDate: paymentDate ? new Date(paymentDate) : null
      },
      include: { inquiry: true }
    });
    // When followup is completed, always sync paymentStatus to inquiry (Paid or Not Paid)
    if (status === 'completed') {
      await prisma.inquiry.update({
        where: { id: parseInt(inquiryId), tenantId },
        data: {
          paymentStatus: paymentStatus || null,
          paymentCode: paymentStatus === 'Paid' ? (paymentCode || null) : null,
          paymentDate: paymentStatus === 'Paid' && paymentDate ? new Date(paymentDate) : null
        }
      });
    }
    
    // Log followup update
    await auditLogger.updateFollowup(req, id.toString(), {
      changes: req.body,
      inquiryId: parseInt(inquiryId)
    });
    
    return safeJson(res, followup);
  } catch (err) {
    return safeJson(res, { error: 'Failed to update follow-up' }, 500);
  }
};

// Delete follow-up
export const deleteFollowup = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    const email = getEmail(req);
    const id = parseInt(req.params.id);
    const tenantId = await getTenantId(req as any);

    if (role === 'admissions_officer') {
      const existing = await prisma.followup.findFirst({ where: { id, tenantId }, include: { inquiry: true } });
      const isOwner = existing && (
        existing.createdBy === email ||
        existing.assignedTo === email ||
        existing.inquiry?.createdBy === email
      );
      if (!isOwner) {
        // check approval table
        const approval = await prisma.deleteApproval.findFirst({
          where: { officerEmail: String(email).toLowerCase(), module: 'followups', itemId: String(id), status: 'approved' }
        });
        if (!approval) return safeJson(res, { error: 'Forbidden' }, 403);
      }
    }

    const existing = await prisma.followup.findFirst({
      where: { id, tenantId },
      include: { comments: true },
    });
    if (!existing) return safeJson(res, { error: 'Not found' }, 404);
    archiveDeletedRecord({
      type: 'followup',
      tenantId,
      deletedBy: email,
      payload: existing,
    });
    await prisma.followupComment.deleteMany({ where: { followupId: id } });
    await prisma.followup.delete({ where: { id, tenantId } as any });
    
    // Log followup deletion
    await auditLogger.deleteFollowup(req, id.toString());
    
    return safeJson(res, { message: 'Deleted' });
  } catch (err) {
    return safeJson(res, { error: 'Failed to delete follow-up' }, 500);
  }
};

// Recently deleted followups (archived records)
export const getDeletedRecentFollowups = async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { error: 'Missing tenant' }, 400);
    const role = getRole(req);
    const email = getEmail(req).toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const items = listArchivedRecords(1000)
      .filter((e) => e.type === 'followup' && e.tenantId === tenantId)
      .filter((e) => {
        if (role === 'admin' || role === 'senior_staff') return true;
        const createdBy = String(e.payload?.createdBy || '').toLowerCase();
        const assignedTo = String(e.payload?.assignedTo || '').toLowerCase();
        return createdBy === email || assignedTo === email || String(e.deletedBy || '').toLowerCase() === email;
      })
      .slice(0, limit)
      .map((e) => ({
        archiveId: e.archiveId,
        deletedAt: e.deletedAt,
        deletedBy: e.deletedBy,
        id: e.payload?.id,
        inquiryId: e.payload?.inquiryId,
        inquiryName: e.payload?.inquiryName || '',
        type: e.payload?.type || '',
        scheduledFor: e.payload?.scheduledFor || null,
      }));
    return safeJson(res, { items });
  } catch (err) {
    return safeJson(res, { error: 'Failed to fetch deleted follow-ups' }, 500);
  }
};

// Notify prospects who haven’t responded in X days (for demo, use GET endpoint; in production, use a cron job)
export const notifyUnresponsiveProspects = async (req: Request, res: Response) => {
  try {
    const X = parseInt(req.query.days as string) || 3; // default 3 days
    const now = new Date();
    const threshold = new Date(now.getTime() - X * 24 * 60 * 60 * 1000);
    const unresponsive = await prisma.followup.findMany({
      where: {
        status: 'pending',
        scheduledFor: { lt: threshold }
      },
      include: { inquiry: true }
    });
    for (const f of unresponsive) {
      // Replace with real notification logic
      console.log(`Notify prospect ${f.inquiry?.fullName} (${f.inquiry?.email || f.inquiry?.phone}) about pending follow-up #${f.id}`);
    }
    return safeJson(res, { notified: unresponsive.length });
  } catch (err) {
    console.error('Error notifying unresponsive prospects:', err);
    return safeJson(res, { error: 'Failed to notify unresponsive prospects' }, 500);
  }
};

// Get nurturing recommendation for an inquiry
export const getNurturingRecommendationForInquiry = async (req: Request, res: Response) => {
  try {
    const inquiryId = parseInt(req.params.inquiryId);
    if (isNaN(inquiryId)) {
      return safeJson(res, { error: 'Invalid inquiryId' }, 400);
    }
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { error: 'Missing tenant' }, 400);
    const role = getRole(req);
    const email = getEmail(req);

    if (role === 'admissions_officer') {
      const allowed = await prisma.inquiry.findFirst({
        where: {
          id: inquiryId,
          tenantId,
          OR: [
            { createdBy: { equals: email || '__none__', mode: 'insensitive' } },
            { assignedTo: { equals: email || '__none__', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (!allowed) return safeJson(res, { error: 'Forbidden' }, 403);
    }
    const recommendation = await getNurturingRecommendation(inquiryId, tenantId);
    return safeJson(res, { recommendation });
  } catch (err) {
    return safeJson(res, { error: 'Failed to get nurturing recommendation' }, 500);
  }
};

// Get follow-up outcome prediction for an inquiry
export const getFollowupOutcomePrediction = async (req: Request, res: Response) => {
  try {
    const inquiryId = parseInt(req.params.inquiryId);
    if (isNaN(inquiryId)) {
      return safeJson(res, { error: 'Invalid inquiryId' }, 400);
    }
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { error: 'Missing tenant' }, 400);
    const role = getRole(req);
    const email = getEmail(req);

    if (role === 'admissions_officer') {
      const allowed = await prisma.inquiry.findFirst({
        where: {
          id: inquiryId,
          tenantId,
          OR: [
            { createdBy: { equals: email || '__none__', mode: 'insensitive' } },
            { assignedTo: { equals: email || '__none__', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (!allowed) return safeJson(res, { error: 'Forbidden' }, 403);
    }

    const prediction = await predictFollowupOutcome(inquiryId, tenantId);
    return safeJson(res, prediction);
  } catch (err) {
    return safeJson(res, { error: 'Failed to get follow-up outcome prediction' }, 500);
  }
};

// Performance analytics for staff
export const getPerformanceAnalytics = async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { error: 'Missing tenant' }, 400);

    const role = getRole(req);
    const email = getEmail(req);
    const isAdminLike = role === 'admin' || role === 'senior_staff';

    const staffParam = String((req.query.staff as string) || '').trim();
    // Default: admins see tenant-wide (no staff filter), officers see own
    let staff = staffParam || email || '';
    if (role === 'admissions_officer') staff = email || staff;
    if (!staff && !isAdminLike) return safeJson(res, { error: 'Missing staff parameter' }, 400);

    const staffFilter = staff
      ? {
          OR: [
            { assignedTo: { equals: staff, mode: 'insensitive' } },
            { createdBy: { equals: staff, mode: 'insensitive' } },
          ],
        }
      : {};

    // 1. Get all inquiries in tenant (optionally filtered by staff)
    const inquiries = await prisma.inquiry.findMany({
      where: { tenantId, ...staffFilter } as any,
      include: { followups: true },
    });
    if (!inquiries.length) {
      return safeJson(res, {
        totalLeads: 0,
        conversions: 0,
        avgResponseTimeHrs: null,
        conversionRate24h: null,
        conversionRateAfter24h: null,
        overdueFollowups: 0,
        channelEffectiveness: {},
        staff: staff || null,
      });
    }
    let conversions = 0;
    let responseTimes: number[] = [];
    let within24h = 0, after24h = 0, conv24h = 0, convAfter24h = 0;
    let channelStats: Record<string, { total: number, converted: number }> = {};
    let overdueFollowups = 0;
    const now = new Date();
    for (const inquiry of inquiries) {
      // Conversion: paymentStatus === 'Paid' or status === 'Registered'
      const isConverted = inquiry.paymentStatus === 'Paid' || inquiry.status === 'Registered';
      if (isConverted) conversions++;
      // First follow-up
      const followupsSorted = [...(inquiry.followups || [])].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
      const firstFollowup = followupsSorted[0];
      if (firstFollowup) {
        const responseTimeHrs = (new Date(firstFollowup.scheduledFor).getTime() - new Date(inquiry.createdAt).getTime()) / (1000 * 60 * 60);
        responseTimes.push(responseTimeHrs);
        // Channel stats
        channelStats[firstFollowup.type] = channelStats[firstFollowup.type] || { total: 0, converted: 0 };
        channelStats[firstFollowup.type].total++;
        if (isConverted) channelStats[firstFollowup.type].converted++;
        // 24h conversion
        if (responseTimeHrs <= 24) {
          within24h++;
          if (isConverted) conv24h++;
        } else {
          after24h++;
          if (isConverted) convAfter24h++;
        }
      }
      // Overdue followups
      for (const f of inquiry.followups) {
        if (f.status === 'pending' && new Date(f.scheduledFor) < now) overdueFollowups++;
      }
    }
    const avgResponseTimeHrs = responseTimes.length ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;
    const conversionRate24h = within24h ? conv24h / within24h : null;
    const conversionRateAfter24h = after24h ? convAfter24h / after24h : null;
    // Channel effectiveness
    const channelEffectiveness: Record<string, number> = {};
    for (const [type, stats] of Object.entries(channelStats)) {
      channelEffectiveness[type] = stats.total ? stats.converted / stats.total : 0;
    }
    return safeJson(res, {
      totalLeads: inquiries.length,
      conversions,
      avgResponseTimeHrs,
      conversionRate24h,
      conversionRateAfter24h,
      overdueFollowups,
      channelEffectiveness,
      staff: staff || null,
    });
  } catch (err) {
    return safeJson(res, { error: 'Failed to get performance analytics' }, 500);
  }
}; 