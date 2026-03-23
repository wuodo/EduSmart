import { Router } from 'express';
import { savePermissions, loadPermissions, PermissionsModel } from '../utils/permissions';
import { rbacGuard } from '../middleware/rbac';

const router = Router();

// Allow only settings module editors to save permissions
router.post('/import/permissions', rbacGuard('settings'), (req, res) => {
	try {
		const p = req.body as PermissionsModel;
		savePermissions(p);
		return res.json({ success: true });
	} catch (e) {
		return res.status(500).json({ error: 'Failed to save permissions' });
	}
});

router.get('/permissions', (_req, res) => {
	return res.json(loadPermissions());
});

export default router;
