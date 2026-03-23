import express from 'express';
import { createDeleteRequest, listDeleteRequests, updateDeleteRequestStatus, bulkApproveByOfficer, createRestoreRequest } from '../controllers/deleteRequest.controller';

const router = express.Router();

// GET /api/delete-requests -> list pending delete requests (admin only)
router.get('/', listDeleteRequests);

// POST /api/delete-requests -> create delete request (officer action)
router.post('/', createDeleteRequest);

// PUT /api/delete-requests/:id -> update request status (admin action)
router.put('/:id', updateDeleteRequestStatus);

// POST /api/delete-requests/bulk-approve -> bulk approve by officer
router.post('/bulk-approve', bulkApproveByOfficer);
// POST /api/delete-requests/restore -> request superadmin restore
router.post('/restore', createRestoreRequest);

export default router;
