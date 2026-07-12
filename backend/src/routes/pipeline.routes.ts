import express from 'express';
import prisma from '../lib/prisma';
import { mergeTenantCrmSettings } from '../utils/tenantCrmSettings';

const router = express.Router();

// Move inquiry to a new stage/status
router.put('/inquiries/:id/stage', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body || {};
    const tenant = (req as any).tenant as { id: number } | undefined;
    const tenantId = tenant?.id;
    if (!tenantId) { res.status(400).json({ error: 'Tenant required' }); return; }
    if (!status) { res.status(400).json({ error: 'status required' }); return; }

    const inquiry = await prisma.inquiry.update({
      where: { id, tenantId },
      data: { status },
    });
    res.json({ success: true, inquiry });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get pipeline config (stages + conversion data)
router.get('/config', async (req, res) => {
  try {
    const tenant = (req as any).tenant as { id: number } | undefined;
    const tenantId = tenant?.id;
    if (!tenantId) { res.status(400).json({ error: 'Tenant required' }); return; }

    const tenantRow = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { crmSettings: true } });
    const settings = mergeTenantCrmSettings(tenantRow?.crmSettings);
    const stages = settings.pipelineStages || ['hot', 'warm', 'cold', 'Pending', 'scholarship-seeker', 'graduate'];

    const stats = await Promise.all(stages.map(async (stage) => {
      const total = await prisma.inquiry.count({ where: { tenantId, status: stage } });
      const converted = await prisma.inquiry.count({ where: { tenantId, status: stage, paymentStatus: 'Paid' } });
      return { stage, total, converted, conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0 };
    }));

    const totalAll = await prisma.inquiry.count({ where: { tenantId } });
    const totalConverted = await prisma.inquiry.count({ where: { tenantId, paymentStatus: 'Paid' } });
    const overallRate = totalAll > 0 ? Math.round((totalConverted / totalAll) * 100) : 0;

    res.json({ success: true, stages, stats, overallRate });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
