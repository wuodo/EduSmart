import express from 'express';
import { createApproval, listApprovalsForOfficer, markApprovalRead } from '../controllers/approval.controller';

const router = express.Router();

// GET /api/approvals?officerEmail=... -> list approvals for officer
router.get('/', listApprovalsForOfficer);

// POST /api/approvals -> create approval (admin action)
router.post('/', createApproval);

// PUT /api/approvals/:id/read -> mark read by officer
router.put('/:id/read', markApprovalRead);

export default router;




