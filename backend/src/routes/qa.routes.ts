import express from 'express';
import { listQaItems, getQaItem, createQaItem, updateQaItem, deleteQaItem, getQaStats } from '../utils/qaStore';
import prisma from '../lib/prisma';

const router = express.Router();

router.get('/', (req, res) => {
  const tenant = (req as any).tenant as { id: number } | undefined;
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  res.json({ success: true, items: listQaItems(tenant?.id, type, status) });
});

router.get('/stats', (req, res) => {
  const tenant = (req as any).tenant as { id: number } | undefined;
  res.json({ success: true, stats: getQaStats(tenant?.id) });
});

router.post('/auto-flag', async (req, res) => {
  try {
    const tenant = (req as any).tenant as { id: number } | undefined;
    const tenantId = tenant?.id;
    if (!tenantId) { res.status(400).json({ error: 'Tenant required' }); return; }

    const userEmail = ((req as any).user?.email || '') as string;
    const existing = listQaItems(tenantId);
    const existingKeys = new Set(existing.map(i => `${i.type}-${i.refId}`));
    let created = 0;

    const incomplete = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "fullName" FROM inquiries WHERE "tenantId" = $1 AND ("email" IS NULL OR "email" = '' OR "kcseGrade" = 'Unknown' OR "programOfInterest" IS NULL) LIMIT 100`,
      tenantId
    );
    for (const i of incomplete) {
      if (existingKeys.has(`inquiry-${i.id}`)) continue;
      const flags: string[] = [];
      if (!i.email) flags.push('Missing email');
      if (i.kcseGrade === 'Unknown' || !i.kcseGrade) flags.push('Missing KCSE grade');
      if (!i.programOfInterest) flags.push('Missing program');
      createQaItem({ tenantId, type: 'inquiry', refId: i.id, refName: i.fullName, score: Math.max(0, 100 - flags.length * 25), flags, status: 'pending', createdBy: userEmail });
      created++;
    }

    const noFollowup = await prisma.$queryRawUnsafe<any[]>(
      `SELECT i.id, i."fullName" FROM inquiries i LEFT JOIN followups f ON f."inquiryId" = i.id WHERE i."tenantId" = $1 AND i.status NOT IN ('won','lost') AND f.id IS NULL LIMIT 100`,
      tenantId
    );
    for (const i of noFollowup) {
      if (existingKeys.has(`inquiry-${i.id}`)) continue;
      if (incomplete.find(x => x.id === i.id)) continue;
      createQaItem({ tenantId, type: 'inquiry', refId: i.id, refName: i.fullName, score: 50, flags: ['No follow-up scheduled'], status: 'pending', createdBy: userEmail });
      created++;
    }

    res.json({ success: true, created, total: listQaItems(tenantId).length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id/review', (req, res) => {
  const { status, comment } = req.body || {};
  if (!status || !['approved', 'rejected'].includes(status)) { res.status(400).json({ error: 'Valid status required' }); return; }
  const updated = updateQaItem(req.params.id, { status, reviewComment: comment, reviewedBy: (req as any).user?.email || 'unknown', reviewedAt: new Date().toISOString() });
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true, item: updated });
});

router.post('/:id/assign', (req, res) => {
  const { assignedTo } = req.body || {};
  const updated = updateQaItem(req.params.id, { assignedTo });
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true, item: updated });
});

router.get('/:id', (req, res) => {
  const item = getQaItem(req.params.id);
  if (!item) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true, item });
});

router.delete('/:id', (req, res) => {
  if (deleteQaItem(req.params.id)) res.json({ success: true });
  else res.status(404).json({ error: 'Not found' });
});

export default router;
