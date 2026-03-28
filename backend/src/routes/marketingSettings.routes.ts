import { Router } from 'express';
import { loadCpanelFromDb, saveCpanelToDb } from '../utils/cpanelStore';
import { loadAutomationConfig, mergeAutomationConfig } from '../utils/inquiryAutomation';

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

router.get('/smart', async (_req, res) => {
  try {
    const cfg = await loadCpanelFromDb();
    return res.json({ smartConfig: (cfg as any).smartConfig || null });
  } catch {
    return res.status(500).json({ error: 'Failed to load smart config' });
  }
});

router.put('/smart', async (req, res) => {
  try {
    const { smartConfig } = req.body;
    if (!smartConfig || typeof smartConfig !== 'object') {
      return res.status(400).json({ error: 'Invalid smartConfig' });
    }
    const cfg = await loadCpanelFromDb();
    await saveCpanelToDb({ ...cfg, smartConfig } as any);
    return res.json({ success: true, smartConfig });
  } catch {
    return res.status(500).json({ error: 'Failed to save smart config' });
  }
});

router.get('/automation', async (_req, res) => {
  try {
    const automation = await loadAutomationConfig();
    return res.json({ automation });
  } catch {
    return res.status(500).json({ error: 'Failed to load automation config' });
  }
});

router.put('/automation', async (req, res) => {
  try {
    const { automation } = req.body;
    if (!automation || typeof automation !== 'object') {
      return res.status(400).json({ error: 'Invalid automation' });
    }
    const merged = mergeAutomationConfig(automation);
    const cfg = await loadCpanelFromDb();
    await saveCpanelToDb({ ...cfg, automationConfig: merged } as any);
    return res.json({ success: true, automation: merged });
  } catch {
    return res.status(500).json({ error: 'Failed to save automation config' });
  }
});

export default router;
