import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Helper functions for user access control
function getUserRole(req: Request): string | null {
  const role = (req as any).user?.role;
  return role ? String(role).toLowerCase() : null;
}

function getUserEmail(req: Request): string | null {
  const email = (req as any).user?.email;
  return email ? String(email) : null;
}

// Helper to build user filter based on role
function buildUserFilter(req: Request) {
  const userRole = getUserRole(req);
  const userEmail = getUserEmail(req);
  
  if (userRole === 'admin' || userRole === 'senior_staff') {
    // Check if owner filter is provided
    const owner = req.query.owner as string;
    if (owner) {
      return {
        OR: [
          { createdBy: owner },
          { assignedTo: owner },
          { followups: { some: { createdBy: owner } } }
        ]
      };
    }
    // No filter - show all data
    return {};
  } else if (userRole === 'admissions_officer') {
    // Only show user's own data
    return {
      OR: [
        { createdBy: userEmail },
        { assignedTo: userEmail },
        { followups: { some: { createdBy: userEmail } } }
      ]
    };
  }
  
  return {};
}

export const analyticsController = {
  async getOverview(req: Request, res: Response) {
    try {
      const userFilter = buildUserFilter(req);
      
      // Admissions Funnel
      const totalInquiries = await prisma.inquiry.count({ where: userFilter });
      const withFollowup = await prisma.inquiry.count({ 
        where: { 
          ...userFilter,
          followups: { some: {} } 
        } 
      });
      const paid = await prisma.inquiry.count({ 
        where: { 
          ...userFilter,
          paymentStatus: 'Paid' 
        } 
      });
      const registered = await prisma.inquiry.count({ 
        where: { 
          ...userFilter,
          status: 'Registered' 
        } 
      });

      // Overdue follow-ups (from Followup table)
      const now = new Date();
      let overdueFollowupsQuery: any = {
        where: {
          status: 'pending',
          scheduledFor: { lt: now },
        },
      };
      
      // Apply user filter to followups
      if (getUserRole(req) === 'admissions_officer') {
        const userEmail = getUserEmail(req);
        overdueFollowupsQuery.where = {
          ...overdueFollowupsQuery.where,
          OR: [
            { createdBy: userEmail },
            { assignedTo: userEmail },
            { inquiry: { createdBy: userEmail } }
          ]
        };
      } else if (getUserRole(req) === 'admin' || getUserRole(req) === 'senior_staff') {
        const owner = req.query.owner as string;
        if (owner) {
          overdueFollowupsQuery.where = {
            ...overdueFollowupsQuery.where,
            OR: [
              { createdBy: owner },
              { assignedTo: owner },
              { inquiry: { createdBy: owner } }
            ]
          };
        }
      }
      
      const overdueFollowups = await prisma.followup.count(overdueFollowupsQuery);

      // Timeline: new inquiries per month (last 6 months)
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return { year: d.getFullYear(), month: d.getMonth() + 1 };
      }).reverse();
      const inquiriesPerMonth = await Promise.all(months.map(async ({ year, month }) => {
        const count = await prisma.inquiry.count({
          where: {
            ...userFilter,
            createdAt: {
              gte: new Date(year, month - 1, 1),
              lt: new Date(year, month, 1),
            },
          },
        });
        return { year, month, count };
      }));

      // 4. Follow-up Effectiveness
      const inquiriesWithFollowups = await prisma.inquiry.findMany({ 
        where: userFilter,
        include: { followups: true } 
      });
      const inquiriesWithAtLeastOneFollowup = inquiriesWithFollowups.filter(i => i.followups.length > 0);
      const percentWithFollowup = totalInquiries ? (inquiriesWithAtLeastOneFollowup.length / totalInquiries) * 100 : 0;
      // For paid inquiries, average number of followups before payment
      const paidInquiries = inquiriesWithFollowups.filter(i => i.paymentStatus === 'Paid');
      let avgFollowupsBeforePayment = 0;
      if (paidInquiries.length > 0) {
        avgFollowupsBeforePayment = paidInquiries.reduce((sum, i) => sum + i.followups.length, 0) / paidInquiries.length;
      }

      // 6. Drop-off Analysis
      const dropoffStages = await prisma.inquiry.groupBy({
        by: ['dropoffStage'],
        where: userFilter,
        _count: { _all: true },
      });
      const mostCommonDropoff = dropoffStages.sort((a, b) => b._count._all - a._count._all)[0]?.dropoffStage || null;

      // 7. Hot Leads (status === 'hot')
      const hotLeadsCount = await prisma.inquiry.count({ 
        where: { 
          ...userFilter,
          status: 'hot' 
        } 
      });
      // New hot leads this week
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newHotLeadsThisWeek = await prisma.inquiry.count({ 
        where: { 
          ...userFilter,
          status: 'hot', 
          createdAt: { gte: weekAgo } 
        } 
      });

      // 9. Gender Breakdown
      const genderBreakdown = await prisma.inquiry.groupBy({ 
        by: ['gender'], 
        where: userFilter,
        _count: { _all: true } 
      });

      // 10. Follow-up Status (from Followup table)
      let followupStatusQuery: any = {
        by: ['status'],
        _count: { _all: true }
      };
      
      // Apply user filter to followup status counts
      if (getUserRole(req) === 'admissions_officer') {
        const userEmail = getUserEmail(req);
        followupStatusQuery.where = {
          OR: [
            { createdBy: userEmail },
            { assignedTo: userEmail },
            { inquiry: { createdBy: userEmail } }
          ]
        };
      } else if (getUserRole(req) === 'admin' || getUserRole(req) === 'senior_staff') {
        const owner = req.query.owner as string;
        if (owner) {
          followupStatusQuery.where = {
            OR: [
              { createdBy: owner },
              { assignedTo: owner },
              { inquiry: { createdBy: owner } }
            ]
          };
        }
      }
      
      const followupStatusCounts = await prisma.followup.groupBy(followupStatusQuery);

      // Busiest inquiry day (by day of week)
      const allInquiries = await prisma.inquiry.findMany({ 
        where: userFilter,
        select: { createdAt: true } 
      });
      const dayCounts: Record<string, number> = {};
      allInquiries.forEach(i => {
        const day = i.createdAt.getDay();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const payload = JSON.parse(JSON.stringify({
        funnel: { totalInquiries, withFollowup, paid, registered },
        overdueFollowups,
        timeline: { inquiriesPerMonth },
        followupEffectiveness: {
          percentWithFollowup,
          avgFollowupsBeforePayment,
        },
        dropoff: dropoffStages,
        mostCommonDropoff,
        hotLeads: { count: hotLeadsCount, newThisWeek: newHotLeadsThisWeek },
        genderBreakdown,
        followupStatus: followupStatusCounts,
        smart: {
          busiestInquiryDay: busiestDay,
        },
      }));
      return res.json(payload);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching analytics overview' });
    }
  },
}; 