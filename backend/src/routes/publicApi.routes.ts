import express from 'express';
import prisma from '../lib/prisma';
import { mergeTenantCrmSettings } from '../utils/tenantCrmSettings';

const router = express.Router();
router.use(express.json());

// Debug: get or generate API key for a tenant
router.get('/key', async (req, res) => {
  try {
    const { tenant: tenantSlug } = req.query as { tenant?: string };
    let tenant;
    if (tenantSlug) {
      tenant = await prisma.tenant.findFirst({ where: { OR: [{ subdomain: tenantSlug }, { name: tenantSlug }], isActive: true } });
    } else {
      tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    }
    if (!tenant) { res.status(404).json({ error: 'No active tenant' }); return; }

    const settings = mergeTenantCrmSettings(tenant.crmSettings);
    let apiKey = settings.publicApiKey;

    if (!apiKey) {
      apiKey = `edusmart-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      const merged = mergeTenantCrmSettings({ ...(tenant.crmSettings as any), publicApiKey: apiKey });
      await prisma.tenant.update({ where: { id: tenant.id }, data: { crmSettings: merged as any } });
    }

    res.json({ success: true, apiKey, tenant: tenant.name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/inquiry', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const { tenant: tenantSlug } = req.query as { tenant?: string };

    // Resolve tenant from query param or use first active tenant
    let tenant;
    if (tenantSlug) {
      tenant = await prisma.tenant.findFirst({ where: { OR: [{ subdomain: tenantSlug }, { name: tenantSlug }], isActive: true } });
    } else {
      tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    }
    if (!tenant) { res.status(500).json({ success: false, error: 'No active tenant' }); return; }

    const crm = mergeTenantCrmSettings(tenant.crmSettings);
    const expectedKey = crm.publicApiKey || process.env.PUBLIC_API_KEY || 'test-key-123';
    if (apiKey !== expectedKey) { res.status(401).json({ success: false, error: 'Invalid API key' }); return; }

    const tenantId = tenant.id;
    const { fullName, phone, email, programOfInterest, intakePeriod, studyMode, source, kcseGrade, gender, county, town, message } = req.body || {};

    if (!fullName) { res.status(400).json({ success: false, error: 'Full name is required' }); return; }
    if (!phone) { res.status(400).json({ success: false, error: 'Phone is required' }); return; }

    const data: any = {
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      email: email ? String(email).trim().toLowerCase() : '',
      programOfInterest: programOfInterest ? String(programOfInterest).trim() : null,
      intakePeriod: intakePeriod ? String(intakePeriod).trim() : null,
      studyMode: studyMode ? String(studyMode).trim() : null,
      source: source ? String(source).trim() : 'Website',
      kcseGrade: kcseGrade ? String(kcseGrade).trim() : 'Unknown',
      gender: gender ? String(gender).trim() : null,
      message: message ? String(message).trim() : null,
      status: 'new',
      tenantId,
    };

    if (county && town) {
      data.detail = { create: { county: String(county).trim(), town: String(town).trim() } };
    }

    // Round-robin assignment
    if (crm.roundRobinEmails && crm.roundRobinEmails.length > 0) {
      const nextCursor = await prisma.$queryRawUnsafe<Array<{ cursor: number }>>(
        `UPDATE tenants SET "crmSettings" = jsonb_set(COALESCE("crmSettings", '{}'), '{roundRobinCursor}', to_jsonb(COALESCE(("crmSettings"->>'roundRobinCursor')::int, 0) + 1)) WHERE id = $1 RETURNING COALESCE(("crmSettings"->>'roundRobinCursor')::int, 0) AS cursor`,
        tenantId
      );
      const cursor = nextCursor[0]?.cursor ?? 0;
      const idx = (cursor - 1) % crm.roundRobinEmails.length;
      data.assignedTo = crm.roundRobinEmails[idx];
    }

    // Lead score
    let score = 30;
    if (data.email) score += 20;
    if (data.kcseGrade && data.kcseGrade !== 'Unknown') score += 15;
    if (data.programOfInterest) score += 15;
    if (data.intakePeriod) score += 10;
    if (data.studyMode) score += 10;
    data.score = Math.min(100, score);

    const inquiry = await prisma.inquiry.create({ data });

    // QA auto-flag if incomplete
    try {
      const { createQaItem } = await import('../utils/qaStore');
      const flags: string[] = [];
      if (!inquiry.email) flags.push('Missing email');
      if (!inquiry.kcseGrade || inquiry.kcseGrade === 'Unknown') flags.push('Missing KCSE grade');
      if (!inquiry.programOfInterest) flags.push('Missing program');
      if (flags.length > 0) {
        createQaItem({ tenantId, type: 'inquiry', refId: inquiry.id, refName: inquiry.fullName, score: Math.max(0, 100 - flags.length * 25), flags, status: 'pending', createdBy: 'website' });
      }
    } catch {}

    // Notify assigned staff
    if (inquiry.assignedTo) {
      try {
        const { notifyStaff } = await import('../services/notificationService');
        const assignedUser = await prisma.user.findFirst({ where: { email: { equals: inquiry.assignedTo, mode: 'insensitive' }, tenantId } });
        if (assignedUser) {
          notifyStaff({
            userId: assignedUser.id, email: assignedUser.email, name: assignedUser.name || assignedUser.email,
            title: 'New Inquiry Assigned',
            body: `"${inquiry.fullName}" (#${inquiry.id}) from website has been assigned to you. Score: ${inquiry.score}/100.`,
            priority: 'info', link: `/inquiries?openInquiry=${inquiry.id}`, tenantId,
          }, ['in_app', 'email']);
        }
      } catch (e) { console.warn('[notify] website assignment failed:', e); }
    }

    res.status(201).json({
      success: true,
      inquiry: {
        id: inquiry.id,
        fullName: inquiry.fullName,
        status: inquiry.status,
        score: inquiry.score,
        createdAt: inquiry.createdAt,
      },
    });
  } catch (e: any) {
    console.error('[public-api] inquiry create error:', e);
    res.status(500).json({ success: false, error: e.message, stack: e.stack?.slice(0, 500) });
  }
});

export default router;
