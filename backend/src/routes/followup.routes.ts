import { Router } from 'express';
import {
  getFollowups,
  getFollowupById,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  getDeletedRecentFollowups,
  getPerformanceAnalytics,
  getNurturingRecommendationForInquiry,
  getFollowupOutcomePrediction,
} from '../controllers/followup.controller';
import { rbacGuard } from '../middleware/rbac';

const router = Router();

// NOTE: keep specific routes above "/:id" to avoid accidental matching
router.get('/performance-analytics', getPerformanceAnalytics);
router.get('/deleted-recent', getDeletedRecentFollowups);
router.get('/:inquiryId/recommendation', getNurturingRecommendationForInquiry);
router.get('/:inquiryId/prediction', getFollowupOutcomePrediction);
router.get('/', getFollowups);
router.get('/:id', getFollowupById);
router.post('/', rbacGuard('followups'), createFollowup);
router.put('/:id', rbacGuard('followups'), updateFollowup);
router.delete('/:id', rbacGuard('followups'), deleteFollowup);

export default router; 