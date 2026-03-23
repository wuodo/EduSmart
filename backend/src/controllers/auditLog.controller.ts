
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

function safeJson(res: Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}

// Helper functions
const getRole = (req: Request) => {
  const sessionRole = (req as any).user?.role as string | undefined;
  return sessionRole ? String(sessionRole).toLowerCase() : '';
};

const getEmail = (req: Request) => {
  const sessionEmail = (req as any).user?.email as string | undefined;
  return sessionEmail || '';
};

// List audit logs (admin only)
export const listAuditLogs = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    if (role !== 'admin' && role !== 'senior_staff' && role !== 'super_admin') {
      return safeJson(res, { error: 'Forbidden' }, 403);
    }

    const { page = '1', limit = '50', module, action } = req.query;
    const pageNum = parseInt(String(page));
    const limitNum = parseInt(String(limit));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (module) where.module = String(module);
    if (action) where.action = String(action);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.auditLog.count({ where })
    ]);

    return safeJson(res, { 
      logs, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (e) {
    console.error('Error listing audit logs:', e);
    return safeJson(res, { error: 'Failed to list audit logs' }, 500);
  }
};

// Create audit log entry
export const createAuditLog = async (req: Request, res: Response) => {
  try {
    const { action, module, details } = req.body || {};
    const user = getEmail(req);
    
    if (!action || !module) {
      return safeJson(res, { error: 'action and module are required' }, 400);
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        action: String(action),
        module: String(module),
        user: user || null,
        details: details || {}
      }
    });

    return safeJson(res, { success: true, log: auditLog });
  } catch (e) {
    console.error('Error creating audit log:', e);
    return safeJson(res, { error: 'Failed to create audit log' }, 500);
  }
};

// Clear all audit logs (admin only)
export const clearAuditLogs = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    if (role !== 'admin' && role !== 'senior_staff' && role !== 'super_admin') {
      return safeJson(res, { error: 'Forbidden' }, 403);
    }

    await prisma.auditLog.deleteMany({});

    return safeJson(res, { success: true, message: 'All audit logs cleared' });
  } catch (e) {
    console.error('Error clearing audit logs:', e);
    return safeJson(res, { error: 'Failed to clear audit logs' }, 500);
  }
};
