import express from 'express';
import { listQaItems, getQaItem, createQaItem, updateQaItem, deleteQaItem, getQaStats } from '../utils/qaStore';
import prisma from '../lib/prisma';
import { notifyStaff } from '../services/notificationService';

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

router.post('/:id/assign', async (req, res) => {
  const { assignedTo } = req.body || {};
  if (!assignedTo) { res.status(400).json({ error: 'assignedTo required' }); return; }
  const item = getQaItem(req.params.id);
  if (!item) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = updateQaItem(req.params.id, { assignedTo });
  if (!updated) { res.status(404).json({ error: 'Not found' }); return; }

  // Notify the reviewer
  const user = await prisma.user.findFirst({ where: { email: { equals: assignedTo, mode: 'insensitive' }, tenantId: item.tenantId ?? undefined } });
  if (user) {
    notifyStaff({
      userId: user.id, email: user.email, name: user.name || user.email,
      title: 'QA Item Assigned',
      body: `"${item.refName}" (#${item.refId}) — ${item.flags.join(', ')}. Please review.`,
      priority: 'info', link: `/qa-review`, tenantId: item.tenantId,
    }, ['in_app', 'email']);
  }

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

// Data quality stats
router.get('/data-quality', async (req, res) => {
  try {
    const tenant = (req as any).tenant as { id: number } | undefined;
    const tenantId = tenant?.id;
    if (!tenantId) { res.status(400).json({ error: 'Tenant required' }); return; }

    const total = await prisma.inquiry.count({ where: { tenantId } });

    // Count missing fields using raw SQL
    const missing: Record<string, number> = {};
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) FILTER (WHERE "fullName" IS NULL) AS "fullName",
        COUNT(*) FILTER (WHERE "phone" IS NULL) AS "phone",
        COUNT(*) FILTER (WHERE "email" IS NULL OR "email" = '') AS "email",
        COUNT(*) FILTER (WHERE "programOfInterest" IS NULL) AS "programOfInterest",
        COUNT(*) FILTER (WHERE "intakePeriod" IS NULL) AS "intakePeriod",
        COUNT(*) FILTER (WHERE "studyMode" IS NULL) AS "studyMode",
        COUNT(*) FILTER (WHERE "source" IS NULL) AS "source",
        COUNT(*) FILTER (WHERE "preferredContactMethod" IS NULL) AS "preferredContactMethod",
        COUNT(*) FILTER (WHERE "kcseGrade" IS NULL OR "kcseGrade" = 'Unknown') AS "kcseGrade",
        COUNT(*) FILTER (WHERE "gender" IS NULL) AS "gender"
      FROM inquiries WHERE "tenantId" = $1
    `, tenantId);
    const row = rows[0];
    for (const key of Object.keys(row || {})) {
      const val = Number(row[key]);
      if (val > 0) missing[key] = val;
    }

    // Per-staff data quality using raw SQL
    const staffRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT u.email, COALESCE(u.name, u.email) AS name,
        COALESCE((SELECT COUNT(*) FROM inquiries WHERE "tenantId" = $1 AND "createdBy" = u.email), 0) AS created,
        COALESCE((SELECT ROUND(AVG(score)::numeric, 0) FROM (
          SELECT i.id,
            (CASE WHEN i.email IS NOT NULL AND i.email != '' THEN 10 ELSE 0 END +
             CASE WHEN i.phone IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i."kcseGrade" IS NOT NULL AND i."kcseGrade" != 'Unknown' THEN 10 ELSE 0 END +
             CASE WHEN i."programOfInterest" IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i.gender IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i."fullName" IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i."intakePeriod" IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i."studyMode" IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i.source IS NOT NULL THEN 10 ELSE 0 END +
             CASE WHEN i."preferredContactMethod" IS NOT NULL THEN 10 ELSE 0 END) AS score
          FROM inquiries i WHERE i."tenantId" = $1 AND i."createdBy" = u.email
        ) sub), 100) AS "avgScore"
      FROM users u WHERE u."tenantId" = $1 ORDER BY "avgScore" ASC LIMIT 20
    `, tenantId, tenantId, tenantId);
    const staffQuality = staffRows.map((r: any) => ({ email: r.email, name: r.name, created: Number(r.created), avgScore: Number(r.avgScore) || 100 }));

    res.json({
      success: true, total, fields: Object.entries(missing).map(([field, count]) => ({ field, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 })),
      staffQuality: staffQuality.sort((a, b) => a.avgScore - b.avgScore),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Debug: return raw store data count
router.get('/debug', (req, res) => {
  const tenant = (req as any).tenant as { id: number } | undefined;
  const items = listQaItems(tenant?.id);
  const { getQaStats: stats } = require('../utils/qaStore');
  res.json({ success: true, count: items.length, items: items.slice(0, 5), stats: stats(tenant?.id) });
});

export default router;
