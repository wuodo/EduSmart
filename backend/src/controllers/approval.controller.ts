import { Request, Response } from 'express';
import prisma from '../lib/prisma';

function safeJson(res: Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}

// Create an approval (admin action)
export const createApproval = async (req: Request, res: Response) => {
  try {
    const { officerEmail, module, itemId, status, itemName, reason, approvedBy } = req.body || {};
    if (!officerEmail || !module || !itemId || !status) {
      return safeJson(res, { error: 'officerEmail, module, itemId, status are required' }, 400);
    }
    const approval = await prisma.deleteApproval.create({
      data: {
        officerEmail: String(officerEmail).toLowerCase(),
        module: String(module),
        itemId: String(itemId),
        status: String(status) === 'rejected' ? 'rejected' : 'approved',
        itemName: itemName ? String(itemName) : null,
        reason: reason ? String(reason) : null,
        approvedBy: approvedBy ? String(approvedBy) : null,
        readBy: {},
      }
    });
    return safeJson(res, { approval });
  } catch (e) {
    return safeJson(res, { error: 'Failed to create approval' }, 500);
  }
};

// List approvals for an officer (officer bell)
export const listApprovalsForOfficer = async (req: Request, res: Response) => {
  try {
    const email = String(req.query.officerEmail || '').toLowerCase();
    if (!email) return safeJson(res, { error: 'officerEmail required' }, 400);
    const approvals = await prisma.deleteApproval.findMany({
      where: { officerEmail: email },
      orderBy: { approvedAt: 'desc' }
    });
    return safeJson(res, { approvals });
  } catch (e) {
    return safeJson(res, { error: 'Failed to fetch approvals' }, 500);
  }
};

// Mark approval read by an officer
export const markApprovalRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { officerEmail } = req.body || {};
    if (!officerEmail) return safeJson(res, { error: 'officerEmail required' }, 400);
    const approval = await prisma.deleteApproval.findUnique({ where: { id: Number(id) } });
    if (!approval) return safeJson(res, { error: 'Not found' }, 404);
    const readBy = (approval.readBy as Record<string, number> | null) || {};
    readBy[String(officerEmail).toLowerCase()] = Date.now();
    const updated = await prisma.deleteApproval.update({ where: { id: Number(id) }, data: { readBy } });
    return safeJson(res, { approval: updated });
  } catch (e) {
    return safeJson(res, { error: 'Failed to update approval' }, 500);
  }
};

// Helper used by follow-up delete: check if officer has approved deletion for item
export const hasApprovedDeletion = async (officerEmail: string, module: string, itemId: string | number) => {
  const found = await prisma.deleteApproval.findFirst({
    where: {
      officerEmail: String(officerEmail).toLowerCase(),
      module: String(module),
      itemId: String(itemId),
      status: 'approved'
    }
  });
  return Boolean(found);
};




