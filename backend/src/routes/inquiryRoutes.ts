import express from 'express';
import prisma from '../lib/prisma';
import { inquiryController } from '../controllers/inquiry.controller';
import { analyticsController } from '../controllers/analytics.controller';
import { auditLogger } from '../utils/auditLogger';
import { hasApprovedDeletion } from '../controllers/approval.controller';
import { archiveDeletedRecord, listArchivedRecords } from '../utils/deletionArchive';
import {
  fetchSmartConfigMerged,
  findSmartDuplicate,
  computeLeadScore,
  phoneMatchVariants,
  enrichInquiriesWithSmartMeta,
} from '../utils/marketingSmartFeatures';

const router = express.Router();

function getRole(req: any): string {
  return String((req as any).user?.role || '').toLowerCase();
}
function getEmail(req: any): string {
  return String((req as any).user?.email || '');
}

const PROFILE_REQUIRED_FIELDS = [
  'fullName',
  'phone',
  'programOfInterest',
  'intakePeriod',
  'studyMode',
  'source',
  'preferredContactMethod',
  'kcseGrade',
  'gender',
  'county',
  'town',
] as const;

function isBlank(v: any): boolean {
  return v === undefined || v === null || String(v).trim() === '';
}

function profileCompleteness(inquiry: any): { score: number; missingFields: string[] } {
  const missing: string[] = [];
  if (isBlank(inquiry?.fullName)) missing.push('fullName');
  if (isBlank(inquiry?.phone)) missing.push('phone');
  if (isBlank(inquiry?.programOfInterest)) missing.push('programOfInterest');
  if (isBlank(inquiry?.intakePeriod)) missing.push('intakePeriod');
  if (isBlank(inquiry?.studyMode)) missing.push('studyMode');
  if (isBlank(inquiry?.source)) missing.push('source');
  if (isBlank(inquiry?.preferredContactMethod)) missing.push('preferredContactMethod');
  if (isBlank(inquiry?.kcseGrade) || String(inquiry?.kcseGrade).toLowerCase() === 'unknown') missing.push('kcseGrade');
  if (isBlank(inquiry?.gender)) missing.push('gender');
  if (isBlank(inquiry?.detail?.county)) missing.push('county');
  if (isBlank(inquiry?.detail?.town)) missing.push('town');
  const score = Math.round(((PROFILE_REQUIRED_FIELDS.length - missing.length) / PROFILE_REQUIRED_FIELDS.length) * 100);
  return { score, missingFields: missing };
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        

function safeJson(res: express.Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}

export async function getTenantId(req: any): Promise<number | null> {
  const t = req?.tenant;
  if (t?.id) return Number(t.id);
  const hdr = String(req?.headers?.['x-tenant'] || '').trim();
  if (hdr) {
    const idNum = parseInt(hdr, 10);
    if (!isNaN(idNum)) {
      const exists = await prisma.tenant.findFirst({ where: { id: idNum, isActive: true }, select: { id: true } });
      if (exists?.id) return Number(exists.id);
    }
  }
  // Dev fallback: resolve first available tenant so local dev always works
  if (process.env.NODE_ENV === 'development') {
    const fallback = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' }, select: { id: true } });
    if (fallback?.id) return Number(fallback.id);
    const any = await prisma.tenant.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (any?.id) return Number(any.id);
  }
  return null;
}

// Get all inquiries (scoped by role and tenant)
router.get('/', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    // If officer but no email resolved, deny rather than returning cross-user data
    if (role === 'admissions_officer' && !email) {
      return safeJson(res, [], 200);
    }
    const owner = String(req.query.owner || '').trim();

    const where: any = { tenantId };
    if (role === 'admissions_officer') {
      const val = (email || '__none__');
      where.OR = [
        { createdBy: { equals: val, mode: 'insensitive' } },
        { assignedTo: { equals: val, mode: 'insensitive' } },
      ];
    } else if (role === 'admin' || role === 'senior_staff') {
      if (owner) {
        const val = owner;
        where.OR = [
          { createdBy: { equals: val, mode: 'insensitive' } },
          { assignedTo: { equals: val, mode: 'insensitive' } },
        ];
      }
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const skip = (page - 1) * limit;

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        include: { detail: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inquiry.count({ where }),
    ]);
    const smart = await fetchSmartConfigMerged();
    let programStats: Record<string, { enrolled: number; seats: number | null }> = {};
    if (smart.intakeCapacity.enabled) {
      const programs = await prisma.program.findMany({
        where: { tenantId, isActive: true },
        select: { name: true, seats: true },
      });
      const grouped = await prisma.inquiry.groupBy({
        by: ['programOfInterest'],
        where: { tenantId, status: { notIn: ['cold', 'graduate'] } },
        _count: { _all: true },
      });
      const enrolled: Record<string, number> = {};
      for (const g of grouped) {
        const k = String(g.programOfInterest || '');
        if (k) enrolled[k] = g._count._all;
      }
      for (const p of programs) {
        programStats[p.name] = { enrolled: enrolled[p.name] || 0, seats: p.seats ?? null };
      }
    }
    const enriched = enrichInquiriesWithSmartMeta(inquiries, smart, {
      now: Date.now(),
      programStats,
    });
    return safeJson(res, { data: enriched, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error fetching inquiries', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Completeness summary for intelligent profile-completion nudges
router.get('/completeness/summary', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    const owner = String(req.query.owner || '').trim();

    const where: any = { tenantId };
    if (role === 'admissions_officer') {
      const val = (email || '__none__');
      where.OR = [
        { createdBy: { equals: val, mode: 'insensitive' } },
        { assignedTo: { equals: val, mode: 'insensitive' } },
      ];
    } else if (role === 'admin' || role === 'senior_staff') {
      if (owner) {
        where.OR = [
          { createdBy: { equals: owner, mode: 'insensitive' } },
          { assignedTo: { equals: owner, mode: 'insensitive' } },
        ];
      }
    }

    const inquiries = await prisma.inquiry.findMany({
      where,
      include: { detail: true },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    const scored = inquiries.map((i: any) => ({
      id: i.id,
      fullName: i.fullName,
      phone: i.phone,
      createdAt: i.createdAt,
      ...profileCompleteness(i),
    }));
    const incomplete = scored.filter(i => i.score < 100);
    const highPriority = incomplete
      .filter(i => i.score < 70)
      .sort((a, b) => a.score - b.score)
      .slice(0, 15);

    return safeJson(res, {
      total: inquiries.length,
      incompleteCount: incomplete.length,
      completeCount: inquiries.length - incomplete.length,
      highPriorityCount: highPriority.length,
      highPriority,
    });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error generating completeness summary', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Check for duplicate phone number within tenant
router.get('/check-phone', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { exists: false }, 200);
    const phone = String(req.query.phone || '').trim();
    if (!phone) return safeJson(res, { exists: false }, 200);
    // Normalize to all format variants so 0712345678 == 254712345678 == +254712345678
    const digits = phone.replace(/\D/g, '');
    let core = digits;
    if (digits.startsWith('254') && digits.length >= 12) core = digits.slice(3);
    else if (digits.startsWith('0') && digits.length >= 10) core = digits.slice(1);
    const variants = Array.from(new Set([phone, `0${core}`, `254${core}`, `+254${core}`, core]));
    const existing = await prisma.inquiry.findFirst({
      where: {
        tenantId,
        OR: variants.map(v => ({ phone: { equals: v, mode: 'insensitive' as const } })),
      },
      select: { id: true, fullName: true, programOfInterest: true, createdAt: true, createdBy: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return safeJson(res, { exists: true, inquiry: existing });
    return safeJson(res, { exists: false });
  } catch {
    return safeJson(res, { exists: false }, 200);
  }
});

// Recently deleted inquiries (archived records)
router.get('/deleted-recent', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req).toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const items = listArchivedRecords(200)
      .filter((e) => e.type === 'inquiry' && e.tenantId === tenantId)
      .filter((e) => {
        if (role === 'admin' || role === 'senior_staff') return true;
        const createdBy = String(e.payload?.createdBy || '').toLowerCase();
        const assignedTo = String(e.payload?.assignedTo || '').toLowerCase();
        return createdBy === email || assignedTo === email || String(e.deletedBy || '').toLowerCase() === email;
      })
      .slice(0, limit)
      .map((e) => ({
        archiveId: e.archiveId,
        deletedAt: e.deletedAt,
        deletedBy: e.deletedBy,
        id: e.payload?.id,
        fullName: e.payload?.fullName || '',
        phone: e.payload?.phone || '',
        programOfInterest: e.payload?.programOfInterest || '',
      }));
    return safeJson(res, { items });
  } catch (error) {
    return safeJson(res, { message: 'Failed to fetch deleted inquiries', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Get single inquiry (scoped by tenant)
router.get('/:id', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    const inquiry = await prisma.inquiry.findFirst({
      where: { 
        id: parseInt(req.params.id),
        tenantId
      },
      include: { detail: true }
    });
    if (!inquiry) return safeJson(res, { message: 'Inquiry not found' }, 404);
    if (role === 'admissions_officer' && inquiry.createdBy !== email) {
      return safeJson(res, { message: 'Forbidden' }, 403);
    }
    return safeJson(res, inquiry);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error fetching inquiry', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Create new inquiry (createdBy from header/session, tenant from middleware)
router.post('/', async (req, res) => {
  try {
    const email = getEmail(req);
    const { detail, kcseGrade, assignedTo, ...rest } = req.body;
    const tenantId = await getTenantId(req as any);
    if (!tenantId) {
      return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    }
    const data: any = { 
      ...rest, 
      createdBy: email || undefined,
      assignedTo: assignedTo || email || undefined,
      tenantId
    };
    // Prisma schema expects email; allow empty string if not provided
    if (data.email === undefined || data.email === null) data.email = '';
    if (kcseGrade) data.kcseGrade = kcseGrade;
    if (detail && (detail.county && detail.town)) {
      data.detail = { create: { county: detail.county, town: detail.town, idOrPassport: detail.idOrPassport || null } };
    }

    const smart = await fetchSmartConfigMerged();
    const fullName = String(data.fullName || '').trim();
    const phone = String(data.phone || '').trim();
    const inquiryEmail = String(data.email || '').trim();
    const dup = await findSmartDuplicate(prisma, tenantId, { fullName, phone, email: inquiryEmail }, smart.duplicateDetection);
    if (dup.blocked && dup.record) {
      return safeJson(
        res,
        { message: 'Duplicate inquiry blocked by smart settings', duplicate: dup.record },
        409,
      );
    }

    if (smart.leadScoring.enabled) {
      const variants = phone ? phoneMatchVariants(phone) : [];
      const repeatPhoneCount = variants.length
        ? await prisma.inquiry.count({
            where: {
              tenantId,
              OR: variants.map((v) => ({ phone: { equals: v, mode: 'insensitive' as const } })),
            },
          })
        : 0;
      data.score = computeLeadScore(
        {
          email: inquiryEmail,
          phone,
          kcseGrade: data.kcseGrade,
          preferredContactMethod: data.preferredContactMethod,
          source: data.source,
          status: data.status,
          firstResponseAt: null,
        },
        smart.leadScoring.weights,
        { followupCount: 0, repeatPhoneCount },
      );
    }

    const inquiry = await prisma.inquiry.create({ data });
    
    // Log inquiry creation
    try {
      await auditLogger.createInquiry(req, {
        inquiryId: inquiry.id,
        inquiryData: { ...rest, kcseGrade },
        tenantId
      });
    } catch (e) {
      console.warn('Audit log createInquiry failed:', e);
    }

    try {
      const { runInquiryCreatedAutomations } = await import('../utils/inquiryAutomation');
      await runInquiryCreatedAutomations(
        {
          id: inquiry.id,
          fullName: inquiry.fullName,
          status: inquiry.status,
          source: inquiry.source,
          assignedTo: inquiry.assignedTo,
          createdBy: inquiry.createdBy,
        },
        tenantId,
      );
    } catch (e) {
      console.warn('[automation] inquiry_created:', e);
    }

    return safeJson(res, inquiry, 201);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error creating inquiry', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Bulk create inquiries from CSV import (sparse rows supported).
// Hard requirement per row: fullName + phone.
router.post('/bulk', async (req, res) => {
  try {
    const email = getEmail(req);
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const rows = Array.isArray(req.body?.inquiries) ? req.body.inquiries : [];
    if (rows.length === 0) return safeJson(res, { message: 'No inquiries provided' }, 400);

    let successCount = 0;
    let skippedCount = 0;
    const errors: Array<{ row: number; reason: string }> = [];
    const smartBulk = await fetchSmartConfigMerged();

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx] || {};
      const fullName = String(r.fullName || '').trim();
      const phone = String(r.phone || '').trim();
      const programOfInterest = String(r.programOfInterest || '').trim();
      if (!fullName || !phone || !programOfInterest) {
        skippedCount++;
        errors.push({ row: idx + 1, reason: 'Missing fullName, phone, or programOfInterest' });
        continue;
      }

      try {
        const data: any = {
          fullName,
          phone,
          email: String(r.email || '').trim(),
          gender: String(r.gender || '').trim() || undefined,
          programOfInterest,
          intakePeriod: String(r.intakePeriod || '').trim() || undefined,
          studyMode: String(r.studyMode || '').trim() || undefined,
          source: String(r.source || '').trim() || undefined,
          agentOrReferralName: String(r.agentOrReferralName || '').trim() || undefined,
          preferredContactMethod: String(r.preferredContactMethod || '').trim() || undefined,
          bestTimeToContact: String(r.bestTimeToContact || '').trim() || undefined,
          leadTags: Array.isArray(r.leadTags)
            ? r.leadTags
            : String(r.leadTags || '').split(',').map((x: string) => x.trim()).filter(Boolean),
          notes: String(r.notes || '').trim() || undefined,
          status: String(r.status || '').trim() || 'hot',
          kcseGrade: String(r.kcseGrade || '').trim() || 'Unknown',
          createdBy: email || undefined,
          assignedTo: email || undefined,
          tenantId,
        };
        if (!data.email) data.email = '';

        const county = String(r.county || '').trim();
        const town = String(r.town || '').trim();
        const idOrPassport = String(r.idOrPassport || '').trim();
        if (county && town) {
          data.detail = { create: { county, town, idOrPassport: idOrPassport || null } };
        }

        const dupB = await findSmartDuplicate(
          prisma,
          tenantId,
          { fullName, phone, email: data.email || '' },
          smartBulk.duplicateDetection,
        );
        if (dupB.blocked) {
          skippedCount++;
          errors.push({ row: idx + 1, reason: 'Duplicate inquiry blocked by smart settings' });
          continue;
        }

        if (smartBulk.leadScoring.enabled) {
          const variants = phoneMatchVariants(phone);
          const repeatPhoneCount = variants.length
            ? await prisma.inquiry.count({
                where: {
                  tenantId,
                  OR: variants.map((v) => ({ phone: { equals: v, mode: 'insensitive' as const } })),
                },
              })
            : 0;
          data.score = computeLeadScore(
            {
              email: data.email,
              phone: data.phone,
              kcseGrade: data.kcseGrade,
              preferredContactMethod: data.preferredContactMethod,
              source: data.source,
              status: data.status,
              firstResponseAt: null,
            },
            smartBulk.leadScoring.weights,
            { followupCount: 0, repeatPhoneCount },
          );
        }

        const created = await prisma.inquiry.create({ data });
        successCount++;
        try {
          const { runInquiryCreatedAutomations } = await import('../utils/inquiryAutomation');
          await runInquiryCreatedAutomations(
            {
              id: created.id,
              fullName: created.fullName,
              status: created.status,
              source: created.source,
              assignedTo: created.assignedTo,
              createdBy: created.createdBy,
            },
            tenantId,
          );
        } catch {}
      } catch (e: any) {
        skippedCount++;
        errors.push({ row: idx + 1, reason: e?.message || 'Create failed' });
      }
    }

    try {
      await auditLogger.custom(req, 'bulk_import_inquiries', 'inquiries', { totalRows: rows.length, successCount, skippedCount });
    } catch {}

    return safeJson(res, { successCount, skippedCount, errors });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Bulk import failed', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Bulk delete inquiries (admin/senior staff only, scoped by tenant)
router.post('/bulk-delete', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    if (!(role === 'admin' || role === 'senior_staff')) {
      return safeJson(res, { message: 'Only admins and senior staff can bulk delete inquiries' }, 403);
    }

    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const parsedIds = rawIds
      .map((x: any) => Number.parseInt(String(x), 10))
      .filter((n: number) => Number.isFinite(n));
    const ids: number[] = Array.from(new Set<number>(parsedIds));
    if (ids.length === 0) return safeJson(res, { message: 'No valid inquiry ids provided' }, 400);

    const toDelete = await prisma.inquiry.findMany({
      where: {
        tenantId,
        id: { in: ids },
      },
      include: {
        detail: true,
        followups: {
          include: { comments: true },
        },
      },
    });
    for (const row of toDelete) {
      archiveDeletedRecord({
        type: 'inquiry',
        tenantId,
        deletedBy: email,
        payload: row,
      });
    }

    // Remove dependent follow-up records first to avoid FK restriction failures.
    await prisma.followupComment.deleteMany({
      where: {
        followup: {
          inquiryId: { in: ids },
          tenantId,
        },
      },
    });
    await prisma.followup.deleteMany({
      where: {
        inquiryId: { in: ids },
        tenantId,
      },
    });
    const result = await prisma.inquiry.deleteMany({
      where: {
        tenantId,
        id: { in: ids },
      },
    });

    try {
      await auditLogger.custom(req, 'bulk_delete_inquiries', 'inquiries', {
        tenantId,
        requestedCount: ids.length,
        deletedCount: result.count,
        ids,
      });
    } catch {}

    return safeJson(res, { success: true, deletedCount: result.count, requestedCount: ids.length });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Bulk delete failed', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Update inquiry (enforce ownership for admissions_officer, scope by tenant)
router.put('/:id', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    const id = parseInt(req.params.id);
    if (role === 'admissions_officer') {
      const existing = await prisma.inquiry.findFirst({ 
        where: { 
          id,
          tenantId,
          OR: [
            { createdBy: { equals: email, mode: 'insensitive' } },
            { assignedTo: { equals: email, mode: 'insensitive' } }
          ]
        } 
      });
      if (!existing) return safeJson(res, { message: 'Forbidden' }, 403);
    }

    const existingFull = await prisma.inquiry.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { followups: true } } },
    });
    let updatePayload: any = { ...req.body };
    if (existingFull) {
      const smart = await fetchSmartConfigMerged();
      if (smart.leadScoring.enabled) {
        const merged = { ...existingFull, ...req.body };
        const phoneStr = String(merged.phone || '').trim();
        const variants = phoneStr ? phoneMatchVariants(phoneStr) : [];
        const repeatPhoneCount = variants.length
          ? await prisma.inquiry.count({
              where: {
                tenantId,
                id: { not: id },
                OR: variants.map((v) => ({ phone: { equals: v, mode: 'insensitive' as const } })),
              },
            })
          : 0;
        updatePayload.score = computeLeadScore(
          {
            email: merged.email,
            phone: merged.phone,
            kcseGrade: merged.kcseGrade,
            preferredContactMethod: merged.preferredContactMethod,
            source: merged.source,
            status: merged.status,
            firstResponseAt: merged.firstResponseAt,
          },
          smart.leadScoring.weights,
          { followupCount: existingFull._count.followups, repeatPhoneCount },
        );
      }
    }

    const inquiry = await prisma.inquiry.update({ 
      where: { 
        id,
        tenantId
      }, 
      data: updatePayload 
    });
    
    // Log inquiry update
    await auditLogger.updateInquiry(req, id.toString(), {
      changes: req.body,
      tenantId: (req as any).tenant?.id
    });
    
    return safeJson(res, inquiry);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error updating inquiry', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Delete inquiry (enforce ownership for admissions_officer, scope by tenant)
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = await getTenantId(req as any);
    if (!tenantId) return safeJson(res, { message: 'Tenant not found or inactive' }, 400);
    const role = getRole(req);
    const email = getEmail(req);
    const id = parseInt(req.params.id);
    if (role === 'admissions_officer') {
      const canOwnOrAssigned = await prisma.inquiry.findFirst({
        where: {
          id,
          tenantId,
          OR: [
            { createdBy: { equals: email, mode: 'insensitive' } },
            { assignedTo: { equals: email, mode: 'insensitive' } },
          ],
        },
      });
      if (!canOwnOrAssigned) {
        const approved = await hasApprovedDeletion(email, 'inquiries', id);
        if (!approved) return safeJson(res, { message: 'Forbidden' }, 403);
      }
    }
    const existing = await prisma.inquiry.findFirst({
      where: { id, tenantId },
      include: {
        detail: true,
        followups: { include: { comments: true } },
      },
    });
    if (!existing) return safeJson(res, { message: 'Inquiry not found' }, 404);
    archiveDeletedRecord({
      type: 'inquiry',
      tenantId,
      deletedBy: email,
      payload: existing,
    });
    await prisma.followupComment.deleteMany({ where: { followup: { inquiryId: id, tenantId } } });
    await prisma.followup.deleteMany({ where: { inquiryId: id, tenantId } });
    await prisma.inquiry.delete({ where: { id, tenantId } as any });
    
    // Log inquiry deletion
    try {
      await auditLogger.deleteInquiry(req, id.toString());
    } catch (e) {
      console.warn('Audit log deleteInquiry failed:', e);
    }
    
    return safeJson(res, { message: 'Inquiry deleted successfully' });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error deleting inquiry', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// --- SMART ANALYTICS ENDPOINTS ---
router.get('/analytics/overview', analyticsController.getOverview);
router.get('/analytics/overdue-followups', inquiryController.getOverdueFollowups);
router.get('/analytics/source-effectiveness', inquiryController.getSourceEffectiveness);
router.get('/analytics/funnel', inquiryController.getFunnel);
router.get('/analytics/dropoff', inquiryController.getDropoff);

// Reminder fields (scoped by tenant)
router.get('/:id/reminder', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inquiry = await prisma.inquiry.findFirst({ 
      where: { 
        id,
        tenantId: (req as any).tenant?.id
      } 
    });
    if (!inquiry) return safeJson(res, { message: 'Inquiry not found' }, 404);
    return safeJson(res, {
      lastReminderSent: inquiry.lastReminderSent,
      reminderStatus: inquiry.reminderStatus,
      lastReminderResponse: inquiry.lastReminderResponse,
      engagementSentiment: inquiry.engagementSentiment,
    });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error fetching inquiry reminder', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

router.post('/:id/reminder', async (req, res) => {
  const { lastReminderSent, reminderStatus } = req.body;
  try {
    const id = parseInt(req.params.id);
    const inquiry = await prisma.inquiry.update({ 
      where: { 
        id,
        tenantId: (req as any).tenant?.id
      } as any, 
      data: { lastReminderSent, reminderStatus } 
    });
    return safeJson(res, inquiry);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error updating inquiry reminder', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

router.post('/:id/reminder/response', async (req, res) => {
  const { responseText } = req.body;
  if (!responseText) return safeJson(res, { message: 'Missing responseText' }, 400);
  const text = responseText.toLowerCase();
  // Word-boundary based regexes
  const positiveRe = /\b(yes|confirmed|coming|will report|sure|okay|ok|ready|see you|attend|definitely|absolutely|of course|looking forward)\b/;
  const negativeRe = /\b(no|not coming|postpone|cancel|cannot|won't|can't|not able|defer|drop|withdraw|not attending|not available|not possible|can't come|not ok)\b/;
  const hasNegative = negativeRe.test(text);
  const hasPositive = positiveRe.test(text);
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  // Negative overrides positive if both appear
  if (hasNegative) sentiment = 'negative';
  else if (hasPositive) sentiment = 'positive';
  try {
    const id = parseInt(req.params.id);
    const inquiry = await prisma.inquiry.update({ 
      where: { 
        id,
        tenantId: (req as any).tenant?.id
      } as any, 
      data: { lastReminderResponse: responseText, engagementSentiment: sentiment } 
    });
    return safeJson(res, { inquiry, sentiment });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error logging response', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

export { router as inquiryRoutes }; 