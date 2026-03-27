import { Request, Response } from 'express';
import prisma from '../lib/prisma';

function getUserRole(req: Request): string | null {
  const role = (req as any).user?.role;
  return role ? String(role).toLowerCase() : null;
}

function getUserEmail(req: Request): string | null {
  const email = (req as any).user?.email;
  return email ? String(email) : null;
}

function buildUserFilter(req: Request) {
  const userRole = getUserRole(req);
  const userEmail = getUserEmail(req);

  if (userRole === 'admin' || userRole === 'senior_staff') {
    const owner = req.query.owner as string;
    if (owner) {
      return { OR: [{ createdBy: owner }, { assignedTo: owner }] };
    }
    return {};
  } else if (userRole === 'admissions_officer') {
    return { OR: [{ createdBy: userEmail }, { assignedTo: userEmail }] };
  }
  return {};
}

function buildFollowupUserFilter(req: Request) {
  const userRole = getUserRole(req);
  const userEmail = getUserEmail(req);
  const owner = req.query.owner as string;

  if (userRole === 'admissions_officer') {
    return { OR: [{ createdBy: userEmail }, { assignedTo: userEmail }, { inquiry: { createdBy: userEmail } }] };
  }
  if ((userRole === 'admin' || userRole === 'senior_staff') && owner) {
    return { OR: [{ createdBy: owner }, { assignedTo: owner }, { inquiry: { createdBy: owner } }] };
  }
  return {};
}

export const analyticsController = {
  async getOverview(req: Request, res: Response) {
    try {
      const userFilter = buildUserFilter(req);
      const followupUserFilter = buildFollowupUserFilter(req);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // --- Parallel count queries (no rows loaded into memory) ---
      const [
        totalInquiries,
        withFollowup,
        paid,
        registered,
        overdueFollowups,
        hotLeadsCount,
        newHotLeadsThisWeek,
        dropoffStages,
        genderBreakdown,
        followupStatusCounts,
        // DB-level count of inquiries that have at least one followup
        inquiriesWithFollowupCount,
        // DB-level count of paid inquiries
        paidInquiriesCount,
      ] = await Promise.all([
        prisma.inquiry.count({ where: userFilter }),
        prisma.inquiry.count({ where: { ...userFilter, followups: { some: {} } } }),
        prisma.inquiry.count({ where: { ...userFilter, paymentStatus: 'Paid' } }),
        prisma.inquiry.count({ where: { ...userFilter, status: 'Registered' } }),
        prisma.followup.count({
          where: { status: 'pending', scheduledFor: { lt: now }, ...followupUserFilter },
        }),
        prisma.inquiry.count({ where: { ...userFilter, status: 'hot' } }),
        prisma.inquiry.count({ where: { ...userFilter, status: 'hot', createdAt: { gte: weekAgo } } }),
        prisma.inquiry.groupBy({ by: ['dropoffStage'], where: userFilter, _count: { _all: true } }),
        prisma.inquiry.groupBy({ by: ['gender'], where: userFilter, _count: { _all: true } }),
        prisma.followup.groupBy({ by: ['status'], _count: { _all: true }, ...(Object.keys(followupUserFilter).length ? { where: followupUserFilter } : {}) }),
        // Use count not findMany — zero row data transferred
        prisma.inquiry.count({ where: { ...userFilter, followups: { some: {} } } }),
        prisma.inquiry.count({ where: { ...userFilter, paymentStatus: 'Paid' } }),
      ]);

      const percentWithFollowup = totalInquiries ? (inquiriesWithFollowupCount / totalInquiries) * 100 : 0;

      // avgFollowupsBeforePayment: use DB aggregate instead of loading all rows
      let avgFollowupsBeforePayment = 0;
      if (paidInquiriesCount > 0) {
        const followupCountForPaid = await prisma.followup.count({
          where: { ...followupUserFilter, inquiry: { paymentStatus: 'Paid' } },
        });
        avgFollowupsBeforePayment = followupCountForPaid / paidInquiriesCount;
      }

      // Timeline: 6 months in parallel (still 6 count queries but no row data)
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      }).reverse();
      const inquiriesPerMonth = await Promise.all(
        months.map(({ year, month }) =>
          prisma.inquiry
            .count({
              where: {
                ...userFilter,
                createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) },
              },
            })
            .then((count) => ({ year, month, count }))
        )
      );

      // Busiest day: use a lightweight groupBy via raw SQL to avoid loading all dates into Node
      let busiestDay: string | null = null;
      try {
        const rows: any[] = await (prisma as any).$queryRaw`
          SELECT EXTRACT(DOW FROM "createdAt")::int AS dow, COUNT(*)::int AS cnt
          FROM inquiries
          ${Object.keys(userFilter).length ? prisma.$queryRaw`WHERE 1=1` : prisma.$queryRaw``}
          GROUP BY dow ORDER BY cnt DESC LIMIT 1
        `;
        busiestDay = rows[0]?.dow != null ? String(rows[0].dow) : null;
      } catch {
        busiestDay = null;
      }

      const sortedDropoff = [...dropoffStages].sort((a, b) => b._count._all - a._count._all);
      const mostCommonDropoff = sortedDropoff[0]?.dropoffStage || null;

      return res.json({
        funnel: { totalInquiries, withFollowup, paid, registered },
        overdueFollowups,
        timeline: { inquiriesPerMonth },
        followupEffectiveness: { percentWithFollowup, avgFollowupsBeforePayment },
        dropoff: sortedDropoff,
        mostCommonDropoff,
        hotLeads: { count: hotLeadsCount, newThisWeek: newHotLeadsThisWeek },
        genderBreakdown,
        followupStatus: followupStatusCounts,
        smart: { busiestInquiryDay: busiestDay },
      });
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching analytics overview' });
    }
  },
};