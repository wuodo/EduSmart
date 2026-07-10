import express from 'express';
import { getStaffPerformance, getSlaSummary, getEscalationSummary, updateInquiryFirstResponse } from '../controllers/accountability.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = express.Router();

router.get('/staff-performance', requireAuth, getStaffPerformance);
router.get('/sla-summary', requireAuth, getSlaSummary);
router.get('/escalations', requireAuth, getEscalationSummary);
router.put('/inquiries/:id/first-response', requireAuth, updateInquiryFirstResponse);

export default router;
