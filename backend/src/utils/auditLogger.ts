import { Request } from 'express';
import prisma from '../lib/prisma';

export interface AuditLogData {
  action: string;
  module: string;
  details?: any;
  ip?: string;
  userAgent?: string;
}

// Get user from authenticated session only
const getUserFromRequest = async (req: Request): Promise<string | null> => {
  try {
    const sessionUser = (req as any).user?.email as string | undefined;
    if (sessionUser) return sessionUser;
    // Try to get user from session first
    const sessionId = req.cookies?.session;
    if (sessionId) {
      const session = await prisma.$queryRaw`
        SELECT u.email as user_email 
        FROM sessions s 
        LEFT JOIN users u ON s."userId" = u.id 
        WHERE s.token = ${sessionId} AND s."expiresAt" > NOW()
      ` as any[];
      if (session.length > 0) {
        return session[0].user_email;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
};

// Get IP address from request
const getIpFromRequest = (req: Request): string => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         (req.connection as any).socket?.remoteAddress || 
         'unknown';
};

// Get user agent from request
const getUserAgentFromRequest = (req: Request): string => {
  return req.headers['user-agent'] || 'unknown';
};

// Main audit logging function
export const logAudit = async (req: Request, data: AuditLogData): Promise<void> => {
  try {
    const user = await getUserFromRequest(req);
    const ip = getIpFromRequest(req);
    const userAgent = getUserAgentFromRequest(req);

    await prisma.auditLog.create({
      data: {
        action: data.action,
        module: data.module,
        user: user,
        details: {
          ...data.details,
          ip,
          userAgent,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Error logging audit:', error);
    // Don't throw - audit logging should not break the main functionality
  }
};

// Convenience functions for common actions
export const auditLogger = {
  // Authentication
  login: (req: Request, email: string, success: boolean, details?: any) => 
    logAudit(req, {
      action: success ? 'login_success' : 'login_failed',
      module: 'auth',
      details: { email, ...details }
    }),

  logout: (req: Request, email: string) => 
    logAudit(req, {
      action: 'logout',
      module: 'auth',
      details: { email }
    }),

  // User management
  createUser: (req: Request, userData: any) => 
    logAudit(req, {
      action: 'user_created',
      module: 'user_management',
      details: { userData }
    }),

  updateUser: (req: Request, userId: string, changes: any) => 
    logAudit(req, {
      action: 'user_updated',
      module: 'user_management',
      details: { userId, changes }
    }),

  deleteUser: (req: Request, userId: string) => 
    logAudit(req, {
      action: 'user_deleted',
      module: 'user_management',
      details: { userId }
    }),

  // Inquiry management
  createInquiry: (req: Request, inquiryData: any) => 
    logAudit(req, {
      action: 'inquiry_created',
      module: 'inquiries',
      details: { inquiryData }
    }),

  updateInquiry: (req: Request, inquiryId: string, changes: any) => 
    logAudit(req, {
      action: 'inquiry_updated',
      module: 'inquiries',
      details: { inquiryId, changes }
    }),

  deleteInquiry: (req: Request, inquiryId: string) => 
    logAudit(req, {
      action: 'inquiry_deleted',
      module: 'inquiries',
      details: { inquiryId }
    }),

  // Follow-up management
  createFollowup: (req: Request, followupData: any) => 
    logAudit(req, {
      action: 'followup_created',
      module: 'followups',
      details: { followupData }
    }),

  updateFollowup: (req: Request, followupId: string, changes: any) => 
    logAudit(req, {
      action: 'followup_updated',
      module: 'followups',
      details: { followupId, changes }
    }),

  deleteFollowup: (req: Request, followupId: string) => 
    logAudit(req, {
      action: 'followup_deleted',
      module: 'followups',
      details: { followupId }
    }),

  // Admission letters
  generateLetter: (req: Request, inquiryId: string, letterData: any) => 
    logAudit(req, {
      action: 'letter_generated',
      module: 'admission_letters',
      details: { inquiryId, letterData }
    }),

  updateLetter: (req: Request, inquiryId: string, changes: any) => 
    logAudit(req, {
      action: 'letter_updated',
      module: 'admission_letters',
      details: { inquiryId, changes }
    }),

  // Settings and branding
  updateBranding: (req: Request, changes: any) => 
    logAudit(req, {
      action: 'branding_updated',
      module: 'settings',
      details: { changes }
    }),

  uploadLogo: (req: Request, logoData: any) => 
    logAudit(req, {
      action: 'logo_uploaded',
      module: 'settings',
      details: { logoData }
    }),

  // System configuration
  updateSystemConfig: (req: Request, changes: any) => 
    logAudit(req, {
      action: 'system_config_updated',
      module: 'settings',
      details: { changes }
    }),

  // Delete requests and approvals
  createDeleteRequest: (req: Request, requestData: any) => 
    logAudit(req, {
      action: 'delete_request_created',
      module: 'delete_requests',
      details: { requestData }
    }),

  approveDeleteRequest: (req: Request, requestId: string, decision: string) => 
    logAudit(req, {
      action: `delete_request_${decision}`,
      module: 'delete_requests',
      details: { requestId, decision }
    }),

  // Generic CRUD operations
  create: (req: Request, module: string, data: any) => 
    logAudit(req, {
      action: `${module}_created`,
      module,
      details: { data }
    }),

  update: (req: Request, module: string, id: string, changes: any) => 
    logAudit(req, {
      action: `${module}_updated`,
      module,
      details: { id, changes }
    }),

  delete: (req: Request, module: string, id: string) => 
    logAudit(req, {
      action: `${module}_deleted`,
      module,
      details: { id }
    }),

  // Custom action
  custom: (req: Request, action: string, module: string, details?: any) => 
    logAudit(req, {
      action,
      module,
      details
    })
};
