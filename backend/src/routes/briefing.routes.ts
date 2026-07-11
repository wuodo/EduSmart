import express from 'express';
import { getDailyBriefing } from '../controllers/briefing.controller';

const router = express.Router();
router.get('/', getDailyBriefing);
export default router;
