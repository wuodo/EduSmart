import { Router } from 'express';
import { loadCpanelFromDb, saveCpanelToDb } from '../utils/cpanelStore';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const cfg = await loadCpanelFromDb();
    const settings = (cfg as any).marketingSettings || {
      institution: { name: '', logo: '', email: '', phone: '', address: '' },
      passwordPolicy: { minLength: 8, requireSpecial: true, expiryDays: 90 },
    };
    return res.json(settings);
  } catch {
    return res.status(500).json({ error: 'Failed to load marketing settings' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const cfg = await loadCpanelFromDb();
    const current = (cfg as any).marketingSettings || {
      institution: { name: '', logo: '', email: '', phone: '', address: '' },
      passwordPolicy: { minLength: 8, requireSpecial: true, expiryDays: 90 },
    };

    const updated = {
      institution: { ...current.institution, ...(data.institution || {}) },
      passwordPolicy: { ...current.passwordPolicy, ...(data.passwordPolicy || {}) },
    };

    if (updated.institution.email && !/^\S+@\S+\.\S+$/.test(updated.institution.email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (updated.institution.phone && !/^\+?\d{7,15}$/.test(updated.institution.phone.trim())) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    await saveCpanelToDb({ ...cfg, marketingSettings: updated } as any);

    return res.json({ success: true, message: 'Settings updated successfully', settings: updated });
  } catch (e: any) {
    console.error('[marketingSettings] Save error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to save marketing settings' });
  }
});

export default router;
