import { Request, Response } from 'express';
import prisma from '../lib/prisma';

async function getTenantId(req: any): Promise<number | null> {
  const t = req?.tenant;
  if (t?.id) return Number(t.id);
  const hdr = String(req?.headers?.['x-tenant'] || '').trim();
  if (hdr) {
    const idNum = parseInt(hdr, 10);
    if (!isNaN(idNum)) return idNum;
  }
  return null;
}

function getRole(req: any): string {
  return String((req as any).user?.role || '').toLowerCase();
}

function getEmail(req: any): string {
  return String((req as any).user?.email || '');
}

async function ensureFollowupAccess(req: Request, followupId: number) {
  const tenantId = await getTenantId(req as any);
  if (!tenantId) return { ok: false as const, status: 400, error: 'Missing tenant' };
  const role = getRole(req as any);
  const email = getEmail(req as any);

  const followup = await prisma.followup.findFirst({
    where: { id: followupId, tenantId },
    include: { inquiry: true },
  });
  if (!followup) return { ok: false as const, status: 404, error: 'Follow-up not found' };

  if (role === 'admissions_officer') {
    const isOwner =
      followup.createdBy === email ||
      followup.assignedTo === email ||
      followup.inquiry?.createdBy === email ||
      followup.inquiry?.assignedTo === email;
    if (!isOwner) return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, tenantId, followup };
}

// Get all comments for a followup
export const getComments = async (req: Request, res: Response) => {
  try {
    const { followupId } = req.params as any;
    const fid = parseInt(String(followupId));
    if (Number.isNaN(fid)) return res.status(400).json({ error: 'Invalid followupId' });
    const access = await ensureFollowupAccess(req, fid);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const comments = await prisma.followupComment.findMany({
      where: { followupId: fid },
      orderBy: { createdAt: 'asc' }
    });
    // Map into frontend-friendly shape
    return res.json(
      comments.map(c => ({
        _id: String(c.id),
        author: c.createdBy || 'Unknown',
        message: c.comment,
        createdAt: c.createdAt,
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

// Create a new comment
export const createComment = async (req: Request, res: Response) => {
  try {
    const { followupId } = req.params as any;
    const fid = parseInt(String(followupId));
    if (Number.isNaN(fid)) return res.status(400).json({ error: 'Invalid followupId' });
    const access = await ensureFollowupAccess(req, fid);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const { author, message } = req.body || {};
    const createdBy = String(author || getEmail(req as any) || '').trim() || null;
    const comment = String(message || '').trim();
    if (!comment) return res.status(400).json({ error: 'Message is required' });

    const saved = await prisma.followupComment.create({
      data: {
        followupId: fid,
        createdBy,
        comment: comment,
      }
    });
    
    return res.status(201).json({
      _id: String(saved.id),
      author: saved.createdBy || 'Unknown',
      message: saved.comment,
      createdAt: saved.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create comment' });
  }
};

// Edit a comment
export const editComment = async (req: Request, res: Response) => {
  try {
    const { followupId, commentId } = req.params as any;
    const fid = parseInt(String(followupId));
    const cid = parseInt(String(commentId));
    if (Number.isNaN(fid)) return res.status(400).json({ error: 'Invalid followupId' });
    if (Number.isNaN(cid)) return res.status(400).json({ error: 'Invalid commentId' });

    const access = await ensureFollowupAccess(req, fid);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const { message } = req.body || {};
    const comment = String(message || '').trim();
    if (!comment) return res.status(400).json({ error: 'Message is required' });

    const updated = await prisma.followupComment.update({
      where: { id: cid },
      data: { comment }
    });
    
    return res.json({
      _id: String(updated.id),
      author: updated.createdBy || 'Unknown',
      message: updated.comment,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update comment' });
  }
};

// Delete a comment
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { followupId, commentId } = req.params as any;
    const fid = parseInt(String(followupId));
    const cid = parseInt(String(commentId));
    if (Number.isNaN(fid)) return res.status(400).json({ error: 'Invalid followupId' });
    if (Number.isNaN(cid)) return res.status(400).json({ error: 'Invalid commentId' });

    const access = await ensureFollowupAccess(req, fid);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    await prisma.followupComment.delete({ where: { id: cid } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
}; 