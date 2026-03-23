import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Helper functions
const getRole = (req: Request) => String((req as any).user?.role || '').toLowerCase();
const getEmail = (req: Request) => String((req as any).user?.email || '');

function safeJson(res: Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}

// Create a delete request (officer action)
export const createDeleteRequest = async (req: Request, res: Response) => {
  try {
    const { module, itemId, reason } = req.body || {};
    const requestedBy = getEmail(req);
    
    if (!module || !itemId || !requestedBy) {
      return safeJson(res, { error: 'module, itemId, and user email are required' }, 400);
    }

    const deleteRequest = await prisma.deleteRequest.create({
      data: {
        module: String(module),
        itemId: String(itemId),
        reason: reason ? String(reason) : null,
        requestedBy: String(requestedBy).toLowerCase(),
        status: 'pending'
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'delete_permission_request',
        module: String(module),
        user: requestedBy,
        details: { itemId: String(itemId), reason: reason || null, requestId: deleteRequest.id }
      }
    });

    return safeJson(res, { success: true, request: deleteRequest });
  } catch (e) {
    console.error('Error creating delete request:', e);
    return safeJson(res, { error: 'Failed to create delete request' }, 500);
  }
};

// List pending delete requests (admin only)
export const listDeleteRequests = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    if (role !== 'admin' && role !== 'senior_staff') {
      // For non-admin roles, just return an empty list instead of 403 to avoid noisy errors
      return safeJson(res, { requests: [] });
    }

    const requests = await prisma.deleteRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });

    return safeJson(res, { requests });
  } catch (e) {
    console.error('Error listing delete requests:', e);
    return safeJson(res, { error: 'Failed to list delete requests' }, 500);
  }
};

// Update delete request status (admin action)
export const updateDeleteRequestStatus = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    const approvedBy = getEmail(req);
    const { id } = req.params;
    const { status, reason } = req.body || {};

    if (role !== 'admin' && role !== 'senior_staff') {
      return safeJson(res, { error: 'Forbidden' }, 403);
    }

    if (!['approved', 'rejected'].includes(String(status))) {
      return safeJson(res, { error: 'Invalid status' }, 400);
    }

    const request = await prisma.deleteRequest.findUnique({
      where: { id: Number(id) }
    });

    if (!request) {
      return safeJson(res, { error: 'Delete request not found' }, 404);
    }

    // Update the request status
    const updatedRequest = await prisma.deleteRequest.update({
      where: { id: Number(id) },
      data: { status: String(status) }
    });

    // Create approval record
    await prisma.deleteApproval.create({
      data: {
        officerEmail: String(request.requestedBy).toLowerCase(),
        module: request.module,
        itemId: request.itemId,
        status: String(status),
        itemName: null, // Will be populated by frontend
        reason: reason ? String(reason) : null,
        approvedBy: String(approvedBy).toLowerCase(),
        readBy: {}
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: `delete_permission_${status}`,
        module: request.module,
        user: approvedBy,
        details: { 
          requestId: Number(id), 
          itemId: request.itemId, 
          officerEmail: request.requestedBy,
          reason: reason || null 
        }
      }
    });

    return safeJson(res, { success: true, request: updatedRequest });
  } catch (e) {
    console.error('Error updating delete request:', e);
    return safeJson(res, { error: 'Failed to update delete request' }, 500);
  }
};

// Bulk approve by officer
export const bulkApproveByOfficer = async (req: Request, res: Response) => {
  try {
    const role = getRole(req);
    const approvedBy = getEmail(req);
    const { officerEmail } = req.body || {};

    if (role !== 'admin' && role !== 'senior_staff') {
      return safeJson(res, { error: 'Forbidden' }, 403);
    }

    if (!officerEmail) {
      return safeJson(res, { error: 'officerEmail is required' }, 400);
    }

    // Get all pending requests for this officer
    const pendingRequests = await prisma.deleteRequest.findMany({
      where: { 
        requestedBy: String(officerEmail).toLowerCase(),
        status: 'pending'
      }
    });

    if (pendingRequests.length === 0) {
      return safeJson(res, { success: true, message: 'No pending requests found for this officer' });
    }

    // Update all requests to approved
    await prisma.deleteRequest.updateMany({
      where: { 
        requestedBy: String(officerEmail).toLowerCase(),
        status: 'pending'
      },
      data: { status: 'approved' }
    });

    // Create approval records for all requests
    const approvalPromises = pendingRequests.map(request => 
      prisma.deleteApproval.create({
        data: {
          officerEmail: String(request.requestedBy).toLowerCase(),
          module: request.module,
          itemId: request.itemId,
          status: 'approved',
          itemName: null,
          reason: null,
          approvedBy: String(approvedBy).toLowerCase(),
          readBy: {}
        }
      })
    );

    await Promise.all(approvalPromises);

    // Create audit log for bulk action
    await prisma.auditLog.create({
      data: {
        action: 'delete_permission_bulk_approved',
        module: 'multiple',
        user: approvedBy,
        details: { 
          officerEmail: String(officerEmail).toLowerCase(),
          requestCount: pendingRequests.length,
          requestIds: pendingRequests.map(r => r.id)
        }
      }
    });

    return safeJson(res, { 
      success: true, 
      message: `Bulk approved ${pendingRequests.length} requests`,
      approvedCount: pendingRequests.length 
    });
  } catch (e) {
    console.error('Error bulk approving requests:', e);
    return safeJson(res, { error: 'Failed to bulk approve requests' }, 500);
  }
};

// Request restore by archive id (any authenticated user)
export const createRestoreRequest = async (req: Request, res: Response) => {
  try {
    const requestedBy = getEmail(req);
    const { archiveId, reason } = req.body || {};
    if (!requestedBy || !archiveId) {
      return safeJson(res, { error: 'archiveId and authenticated user are required' }, 400);
    }
    const request = await prisma.deleteRequest.create({
      data: {
        module: 'restore_request',
        itemId: String(archiveId),
        reason: reason ? String(reason) : null,
        requestedBy: String(requestedBy).toLowerCase(),
        status: 'pending',
      },
    });
    await prisma.auditLog.create({
      data: {
        action: 'restore_request_created',
        module: 'restore',
        user: requestedBy,
        details: { archiveId: String(archiveId), requestId: request.id, reason: reason || null },
      },
    });
    return safeJson(res, { success: true, request });
  } catch (e) {
    return safeJson(res, { error: 'Failed to create restore request' }, 500);
  }
};
