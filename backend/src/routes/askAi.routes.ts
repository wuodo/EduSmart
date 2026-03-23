import { Router } from 'express';
import { askAiController } from '../controllers/askAi.controller';

const router = Router();

// Main Ask endpoint (deterministic, code-grounded answers + real computed values)
router.post('/ask', askAiController.ask);

// Rebuild knowledge index from the codebase
router.post('/reindex', askAiController.reindex);

// Get index status (cached endpoints + generation timestamp)
router.get('/status', askAiController.status);

export default router;

