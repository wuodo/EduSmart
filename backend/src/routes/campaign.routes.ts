import express from 'express';
import { listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign } from '../utils/campaignStore';
import prisma from '../lib/prisma';

const router = express.Router();

router.get('/', (req, res) => {
  const tenant = (req as any).tenant as { id: number } | undefined;
  res.json({ success: true, campaigns: listCampaigns(tenant?.id) });
});

router.get('/:id', (req, res) => {
  const c = getCampaign(req.params.id);
  if (!c) { res.status(404).json({ error: 'Campaign not found' }); return; }
  res.json({ success: true, campaign: c });
});

router.post('/', async (req, res) => {
  try {
    const tenant = (req as any).tenant as { id: number } | undefined;
    const userEmail = ((req as any).user?.email || '') as string;
    const { name, description, type, audience, content, scheduleAt, steps } = req.body || {};
    if (!name || !type) { res.status(400).json({ error: 'name and type required' }); return; }
    const campaign = createCampaign({
      tenantId: tenant?.id ?? null, name, description, type, status: scheduleAt ? 'scheduled' : 'draft',
      audience: audience || {}, content: content || {}, scheduleAt, createdBy: userEmail || undefined,
      steps,
    });
    res.status(201).json({ success: true, campaign });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', (req, res) => {
  const updated = updateCampaign(req.params.id, req.body);
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true, campaign: updated });
});

router.delete('/:id', (req, res) => {
  if (deleteCampaign(req.params.id)) res.json({ success: true });
  else res.status(404).json({ error: 'Not found' });
});

router.post('/:id/send', async (req, res) => {
  try {
    const campaign = getCampaign(req.params.id);
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
    const tenant = (req as any).tenant as { id: number } | undefined;
    const f = campaign.audience;

    const where: any = { tenantId: tenant?.id };
    if (f.statusIn?.length) where.status = { in: f.statusIn };
    if (f.sourceEquals) where.source = f.sourceEquals;
    if (f.programEquals) where.programOfInterest = f.programEquals;
    if (f.scoreMin) where.score = { gte: f.scoreMin };

    const recipients = await prisma.inquiry.findMany({ where, select: { id: true, fullName: true, email: true, phone: true } });
    if (recipients.length === 0) { res.status(400).json({ error: 'No recipients match audience' }); return; }

    updateCampaign(campaign.id, { status: 'sending', sentCount: recipients.length });

    let sent = 0;
    for (const r of recipients) {
      if (campaign.type === 'email' && r.email && tenant?.id) {
        try {
          const { sendTenantEmail } = await import('../utils/tenantEmailService');
          const body = String(campaign.content?.body || '');
          await sendTenantEmail(r.email, String(campaign.content?.subject || ''), body.replace(/\{\{name\}\}/g, r.fullName), body.includes('<') ? body.replace(/\{\{name\}\}/g, r.fullName) : undefined, tenant.id);
          sent++;
        } catch { /* skip */ }
      }
    }

    updateCampaign(campaign.id, { status: 'sent', completedAt: new Date().toISOString(), sentCount: sent });
    res.json({ success: true, sent });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
