import express from 'express';
import { getStaffPerformance, getSlaSummary, getEscalationSummary, updateInquiryFirstResponse } from '../controllers/accountability.controller';
import { requireAuth } from '../middleware/requireAuth';
import { rbacGuard } from '../middleware/rbac';

const router = express.Router();

router.get('/staff-performance', requireAuth, rbacGuard(['admin', 'senior_staff']), getStaffPerformance);
router.get('/sla-summary', requireAuth, rbacGuard(['admin', 'senior_staff']), getSlaSummary);
router.get('/escalations', requireAuth, rbacGuard(['admin', 'senior_staff']), getEscalationSummary);
router.put('/inquiries/:id/first-response', requireAuth, updateInquiryFirstResponse);

export default router;
