import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Simple sentiment analysis (rule-based for demo)
function analyzeSentiment(message?: string): string {
  if (!message) return 'neutral';
  const positive = ['thank', 'interested', 'excited', 'happy', 'great', 'good'];
  const negative = ['angry', 'not happy', 'disappointed', 'bad', 'unhappy', 'complain'];
  const msg = message.toLowerCase();
  if (positive.some(word => msg.includes(word))) return 'positive';
  if (negative.some(word => msg.includes(word))) return 'negative';
  return 'neutral';
}

// Simple scoring function
function scoreInquiry(data: any): number {
  let score = 0;
  if (data.source === 'Referral') score += 30;
  if (data.source === 'Walk-in') score += 20;
  if (data.source === 'Facebook' || data.source === 'Instagram') score += 10;
  if (data.programOfInterest) score += 10;
  if (data.phone) score += 10;
  if (data.email) score += 5;
  if (data.paymentStatus === 'Paid') score += 30;
  if (data.notes) score += 5;
  return score;
}

// Recommendation logic
function getRecommendation(data: any): string {
  if (data.paymentStatus === 'Paid') return 'Proceed to registration.';
  if (data.status === 'Pending') return 'Follow up with prospect.';
  if (data.status === 'Contacted') return 'Send brochure or invite for campus visit.';
  return 'Review inquiry details.';
}

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

const logError = (error: any, context: string) => {
  console.error(`[${context}] Error:`, error);
  if (error instanceof Error) {
    console.error('Stack trace:', error.stack);
  }
};

export const inquiryController = {
  // Get all inquiries (paginated)
  async getAllInquiries(req: Request, res: Response) {
    try {
      const userRole = getUserRole(req);
      const userEmail = getUserEmail(req);
      const owner = String((req.query.owner as string) || '').trim();
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
      const skip = (page - 1) * limit;

      const where: any = {};
      if (userRole === 'admissions_officer') {
        where.OR = [
          { createdBy: userEmail || '__none__' },
          { assignedTo: userEmail || '__none__' },
        ];
      } else if (userRole === 'admin' || userRole === 'senior_staff') {
        if (owner) {
          where.OR = [{ createdBy: owner }, { assignedTo: owner }];
        }
      }

      const [inquiries, total] = await Promise.all([
        prisma.inquiry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true, fullName: true, phone: true, email: true, status: true,
            programOfInterest: true, source: true, paymentStatus: true,
            createdAt: true, updatedAt: true, createdBy: true, assignedTo: true,
            letterStatus: true, tenantId: true, intakePeriod: true, gender: true,
            kcseGrade: true, studyMode: true, score: true, sentiment: true,
            nextFollowupAt: true, dropoffStage: true,
          },
        }),
        prisma.inquiry.count({ where }),
      ]);
      return res.json({ data: inquiries, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      logError(error, 'getAllInquiries');
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching inquiries', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Get single inquiry
  async getInquiry(req: Request, res: Response) {
    try {
      const inquiry = await prisma.inquiry.findUnique({ where: { id: parseInt(req.params.id) } });
      if (!inquiry) {
        return res.status(404).json({ message: 'Inquiry not found' });
      }
      // Map 'name' to 'fullName'
      return res.json({ ...inquiry, fullName: inquiry.fullName });
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching inquiry', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Create new inquiry
  async createInquiry(req: Request, res: Response) {
    try {
      const { documents, fullName, ...rest } = req.body;

      // Validate required fields
      if (!fullName) {
        return res.status(400).json({ message: 'Full name is required' });
      }

      // Duplicate detection
      const duplicate = await prisma.inquiry.findFirst({
        where: {
          OR: [
            { phone: rest.phone },
            { email: rest.email }
          ]
        }
      });
      if (duplicate) {
        return res.status(409).json({ message: 'Duplicate inquiry detected', duplicate });
      }

      // Sanitize documents: only allow array of strings (file names or URLs), or undefined
      let safeDocuments = undefined;
      if (Array.isArray(documents)) {
        safeDocuments = documents.map((doc: any) =>
          typeof doc === 'string' ? doc : doc?.name || null
        ).filter(Boolean);
      }

      // Smart fields
      const score = scoreInquiry({ ...rest, fullName });
      const sentiment = analyzeSentiment(rest.message);
      const recommendation = getRecommendation(rest);
      const nextFollowupAt = rest.nextFollowupAt ? new Date(rest.nextFollowupAt) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
      const dropoffStage = 'Inquiry';

      // Use fullName directly (not name)
      const inquiry = await prisma.inquiry.create({
        data: {
          ...rest,
          fullName,
          documents: safeDocuments,
          status: rest.status || 'hot',
          createdAt: new Date(),
          updatedAt: new Date(),
          score,
          sentiment,
          recommendation,
          nextFollowupAt,
          dropoffStage
        }
      });

      return res.status(201).json(inquiry);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(400).json({ 
        message: 'Error creating inquiry', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  // Update inquiry
  async updateInquiry(req: Request, res: Response) {
    try {
      // Recalculate smart fields on update
      const { message, paymentStatus, status, ...rest } = req.body;
      const score = scoreInquiry({ ...req.body });
      const sentiment = analyzeSentiment(message);
      const recommendation = getRecommendation(req.body);
      let nextFollowupAt = req.body.nextFollowupAt;
      if (!nextFollowupAt) nextFollowupAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const dropoffStage = req.body.dropoffStage || 'Inquiry';
      const inquiry = await prisma.inquiry.update({
        where: { id: parseInt(req.params.id) },
        data: {
          ...rest,
          message,
          paymentStatus,
          status,
          score,
          sentiment,
          recommendation,
          nextFollowupAt,
          dropoffStage
        }
      });
      return res.json(inquiry);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(400).json({ message: 'Error updating inquiry', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Delete inquiry
  async deleteInquiry(req: Request, res: Response) {
    try {
      const role = getUserRole(req);
      const email = getUserEmail(req) || '';
      const id = parseInt(req.params.id);

      if (role === 'admissions_officer') {
        const existing = await prisma.inquiry.findUnique({ where: { id } });
        const isOwner = existing && (existing.createdBy === email || existing.assignedTo === email);
        if (!isOwner) {
          const approval = await prisma.deleteApproval.findFirst({
            where: { officerEmail: String(email).toLowerCase(), module: 'inquiries', itemId: String(id), status: 'approved' }
          });
          if (!approval) return res.status(403).json({ message: 'Forbidden' });
        }
      }

      await prisma.inquiry.delete({ where: { id } });
      return res.json({ message: 'Inquiry deleted successfully' });
    } catch (error) {
      if (res.headersSent) return;
      return res.status(400).json({ message: 'Error deleting inquiry', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Search inquiries (paginated)
  async searchInquiries(req: Request, res: Response) {
    try {
      const { query, source, status, dateRange } = req.query;
      const userRole = getUserRole(req);
      const userEmail = getUserEmail(req);
      const owner = String((req.query.owner as string) || '').trim();
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
      const skip = (page - 1) * limit;

      const where: any = {};
      if (userRole === 'admissions_officer') {
        where.OR = [{ createdBy: userEmail || '__none__' }, { assignedTo: userEmail || '__none__' }];
      } else if (userRole === 'admin' || userRole === 'senior_staff') {
        if (owner) {
          where.OR = [{ createdBy: owner }, { assignedTo: owner }];
        }
      }

      const searchConditions: any = {};
      if (query) {
        searchConditions.OR = [
          { fullName: { contains: query as string, mode: 'insensitive' } },
          { phone: { contains: query as string, mode: 'insensitive' } },
          { programOfInterest: { contains: query as string, mode: 'insensitive' } }
        ];
      }
      if (source) searchConditions.source = source;
      if (status) searchConditions.status = status;
      if (dateRange) {
        const [startDate, endDate] = (dateRange as string).split(',');
        searchConditions.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
      }

      const finalWhere = Object.keys(searchConditions).length > 0
        ? { AND: [where, searchConditions] }
        : where;

      const [inquiries, total] = await Promise.all([
        prisma.inquiry.findMany({
          where: finalWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true, fullName: true, phone: true, email: true, status: true,
            programOfInterest: true, source: true, paymentStatus: true,
            createdAt: true, createdBy: true, assignedTo: true, tenantId: true,
          },
        }),
        prisma.inquiry.count({ where: finalWhere }),
      ]);
      return res.json({ data: inquiries, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error searching inquiries', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // PATCH letterStatus
  async updateLetterStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { letterStatus } = req.body;
      const inquiry = await prisma.inquiry.update({ where: { id: parseInt(id) }, data: { letterStatus } });
      return res.json(inquiry);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(400).json({ message: 'Error updating letter status', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // Bulk create inquiries
  async bulkCreateInquiries(req: Request, res: Response) {
    try {
      const { inquiries } = req.body;
      if (!Array.isArray(inquiries) || inquiries.length === 0) {
        return res.status(400).json({ message: 'No inquiries provided' });
      }
      if (inquiries.length > 500) {
        return res.status(400).json({ message: 'Bulk limit is 500 records per request' });
      }
      const mappedInquiries = inquiries.map(({ fullName, name, email, phone, message, ...rest }: any) => ({
        name: fullName || name,
        email,
        phone,
        message,
        ...rest
      }));
      const created = await prisma.inquiry.createMany({ data: mappedInquiries, skipDuplicates: true });
      // Return count only — never load all inquiries post-bulk
      return res.json({ successCount: created.count });
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Bulk inquiry creation failed', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // --- SMART ANALYTICS ENDPOINTS ---

  // 1. Overdue follow-ups (capped at 100)
  async getOverdueFollowups(req: Request, res: Response) {
    try {
      const now = new Date();
      const userFilter = buildUserFilter(req);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));

      const where: any = {
        nextFollowupAt: { lt: now },
        status: { not: 'Registered' },
        ...userFilter,
      };

      const overdue = await prisma.inquiry.findMany({
        where,
        orderBy: { nextFollowupAt: 'asc' },
        take: limit,
        select: {
          id: true, fullName: true, phone: true, programOfInterest: true,
          nextFollowupAt: true, status: true, assignedTo: true, createdBy: true,
        },
      });
      return res.json(overdue);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching overdue followups', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // 2. Source effectiveness (single groupBy — no N+1)
  async getSourceEffectiveness(req: Request, res: Response) {
    try {
      const userFilter = buildUserFilter(req);

      const [totalBySource, paidBySource] = await Promise.all([
        prisma.inquiry.groupBy({
          by: ['source'],
          where: userFilter,
          _count: { _all: true },
        }),
        prisma.inquiry.groupBy({
          by: ['source'],
          where: { ...userFilter, paymentStatus: 'Paid' },
          _count: { _all: true },
        }),
      ]);

      const paidMap = new Map(paidBySource.map((r) => [r.source, r._count._all]));
      const data = totalBySource
        .filter((r) => r.source)
        .map((r) => {
          const total = r._count._all;
          const paid = paidMap.get(r.source) ?? 0;
          return { source: r.source, total, paid, conversionRate: total ? Math.round((paid / total) * 100) : 0 };
        });
      return res.json(data);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching source effectiveness', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // 3. Funnel visualization
  async getFunnel(req: Request, res: Response) {
    try {
      const userFilter = buildUserFilter(req);
      
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
      return res.json({ totalInquiries, withFollowup, paid, registered });
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching funnel data', error: error instanceof Error ? error.message : String(error) });
    }
  },

  // 4. Drop-off analysis
  async getDropoff(req: Request, res: Response) {
    try {
      const userFilter = buildUserFilter(req);
      
      // Count by dropoffStage
      const stages = await prisma.inquiry.groupBy({
        by: ['dropoffStage'],
        where: userFilter,
        _count: { _all: true }
      });
      return res.json(stages);
    } catch (error) {
      if (res.headersSent) return;
      return res.status(500).json({ message: 'Error fetching dropoff analysis', error: error instanceof Error ? error.message : String(error) });
    }
  }
}; 