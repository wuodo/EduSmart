import { Router } from 'express';
import * as programController from '../controllers/program.controller';
import { rbacGuard } from '../middleware/rbac';

const router = Router();

router.get('/', programController.getAllPrograms);
router.get('/:id', (_req, res) => res.status(404).json({ message: 'Not implemented' }));
router.post('/', rbacGuard('settings'), programController.createProgram);
router.put('/:id', rbacGuard('settings'), programController.updateProgram);
router.delete('/:id', rbacGuard('settings'), programController.deleteProgram);

export default router; 