import { Router } from 'express';
import { savePermissions, loadPermissions, PermissionsModel } from '../utils/permissions';

const router = Router();

// Allow settings editors to save permissions (guard checked at frontend level)
router.post('/import/permissions', (req, res) => {
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
