import { Router } from 'express';
import { generateAdmissionLetter, downloadAdmissionLetter, bulkGenerateAdmissionLetters, getAdmissionLetterStats } from '../controllers/admissionLetter.controller';
import { rbacGuard } from '../middleware/rbac';

const router = Router();

router.get('/stats', getAdmissionLetterStats);
router.post('/bulk', rbacGuard('admission_letters'), bulkGenerateAdmissionLetters);
router.post('/generate', rbacGuard('admission_letters'), downloadAdmissionLetter);
router.post('/', rbacGuard('admission_letters'), generateAdmissionLetter);

export default router; 