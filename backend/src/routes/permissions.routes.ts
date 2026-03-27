import { Router } from 'express';
import { savePermissionsToDb, loadPermissionsFromDb, PermissionsModel } from '../utils/permissions';

const router = Router();

// Allow settings editors to save permissions (guard checked at frontend level)
router.post('/import/permissions', async (req, res) => {
	try {
		const p = req.body as PermissionsModel;
		await savePermissionsToDb(p);
		return res.json({ success: true });
	} catch (e: any) {
		console.error('[permissions] Save error:', e?.message || e);
		return res.status(500).json({ error: e?.message || 'Failed to save permissions' });
	}
});

router.get('/permissions', async (_req, res) => {
	try {
		const p = await loadPermissionsFromDb();
		return res.json(p);
	} catch (e) {
		return res.status(500).json({ error: 'Failed to load permissions' });
	}
});

export default router;
