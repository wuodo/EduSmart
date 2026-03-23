import { Router } from 'express';
import { inquiryController } from '../controllers/inquiry.controller';
import { rbacGuard } from '../middleware/rbac';

const router = Router();

// Get all inquiries
router.get('/', inquiryController.getAllInquiries);

// Search inquiries
router.get('/search', inquiryController.searchInquiries);

// Create / Update / Delete inquiries
router.post('/', rbacGuard('inquiries'), inquiryController.createInquiry);
router.put('/:id', rbacGuard('inquiries'), inquiryController.updateInquiry);
router.delete('/:id', rbacGuard('inquiries'), inquiryController.deleteInquiry);

// Bulk create inquiries (for CSV/Excel/API imports)
router.post('/bulk', rbacGuard('inquiries'), inquiryController.bulkCreateInquiries);

// Letter status update (used by Admission Letters module)
router.patch('/:id/letter-status', rbacGuard('inquiries'), inquiryController.updateLetterStatus);

export default router;