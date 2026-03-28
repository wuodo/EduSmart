import express from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { auditLogger } from '../utils/auditLogger';
import { rbacGuard } from '../middleware/rbac';

const router = express.Router();

function getRole(req: any): string {
  const sessionRole = (req as any).user?.role as string | undefined;
  return sessionRole ? String(sessionRole).toLowerCase() : '';
}

function safeJson(res: express.Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}

async function resolveTenantForRequest(req: any) {
  // 1) already resolved by middleware
  if (req.tenant?.id) return req.tenant;
  // 2) session user tenant
  if (req.user?.tenantId) {
    const t = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
    if (t) return t;
  }
  // 3) x-tenant header - supports tenant ID or subdomain/name
  const hdr = String(req.header('x-tenant') || '').trim();
  if (hdr) {
    const idNum = parseInt(hdr, 10);
    if (!isNaN(idNum) && String(idNum) === hdr) {
      const t = await prisma.tenant.findFirst({ where: { id: idNum, isActive: true } });
      if (t) return t;
    }
    const t = await prisma.tenant.findFirst({ where: { OR: [{ subdomain: hdr }, { name: hdr }], isActive: true } });
    if (t) return t;
  }
  // 4) cookie
  try {
    const cookie = String(req.headers['cookie'] || '');
    const m = /(?:^|; )tenant=([^;]+)/.exec(cookie);
    const c = m && m[1] ? decodeURIComponent(m[1]) : '';
    if (c) {
      const t = await prisma.tenant.findFirst({ where: { OR: [{ subdomain: c }, { name: c }], isActive: true } });
      if (t) return t;
    }
  } catch {}
  return undefined;
}

// Public: get tenant by code (id, subdomain, or name) - for login UX personalization
router.get('/by-code', async (req, res) => {
  try {
    const code = String(req.query?.code || '').trim();
    if (!code) return safeJson(res, { name: null }, 200);
    const asId = parseInt(code, 10);
    let tenant: any = null;
    if (!isNaN(asId) && String(asId) === code) {
      tenant = await prisma.tenant.findFirst({ where: { id: asId, isActive: true }, select: { name: true } });
    }
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: {
          isActive: true,
          OR: [
            { subdomain: { equals: code, mode: 'insensitive' } },
            { name: { equals: code, mode: 'insensitive' } },
            { domain: { equals: code, mode: 'insensitive' } },
          ],
        },
        select: { name: true },
      });
    }
    return safeJson(res, { name: tenant?.name ?? null });
  } catch {
    return safeJson(res, { name: null }, 200);
  }
});

// Public: list active tenants (for institution selection on login)
router.get('/', async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, subdomain: true, logo: true }
    });
    return safeJson(res, { success: true, tenants });
  } catch (error) {
    console.error('List tenants error:', error);
    return safeJson(res, { success: false, message: 'Failed to list tenants' }, 500);
  }
});

// Get current tenant basic info including branding
router.get('/me', async (req, res) => {
  try {
    const tenant = (await resolveTenantForRequest(req as any)) as any;
    if (!tenant) return safeJson(res, { success: false, message: 'Tenant not found' }, 404);

    const full = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        domain: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return safeJson(res, { success: true, tenant: full });
  } catch (error) {
    console.error('Get tenant error:', error);
    return safeJson(res, { success: false, message: 'Failed to load tenant' }, 500);
  }
});

// Get current tenant branding colors (returns defaults when no tenant - e.g. pre-login)
router.get('/me/branding', async (req, res) => {
  try {
    const tenant = (await resolveTenantForRequest(req as any)) as any;
    if (!tenant) {
      // No tenant context (e.g. login page) - return default branding to avoid 404
      const firstTenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
      const branding = firstTenant ? {
        primaryColor: firstTenant.primaryColor || '#ea3c3d',
        secondaryColor: firstTenant.secondaryColor || '#afd657',
        accentColor: firstTenant.accentColor || '#39b1ed',
        logo: firstTenant.logo,
        name: firstTenant.name,
        subdomain: firstTenant.subdomain,
      } : { primaryColor: '#ea3c3d', secondaryColor: '#afd657', accentColor: '#39b1ed' };
      return safeJson(res, { success: true, branding });
    }

    const branding = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logo: true,
        name: true,
        subdomain: true,
        brandingConfig: true,
      }
    });

    return safeJson(res, { success: true, branding });
  } catch (error) {
    console.error('Get branding error:', error);
    return safeJson(res, { success: false, message: 'Failed to load branding' }, 500);
  }
});

// Update current tenant branding colors (admin only)
router.put('/me/branding', async (req, res) => {
  try {
    const role = getRole(req);
    if (role !== 'admin') {
      return safeJson(res, { success: false, message: 'Admin role required' }, 403);
    }

    const tenant = (await resolveTenantForRequest(req as any)) as any;
    if (!tenant) return safeJson(res, { success: false, message: 'Tenant not found' }, 404);

    const { primaryColor, secondaryColor, accentColor, logo, brandingConfig } = req.body || {};

    // Merge incoming brandingConfig with existing to allow partial updates
    let mergedConfig: Record<string, unknown> | undefined;
    if (brandingConfig && typeof brandingConfig === 'object') {
      const existing = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { brandingConfig: true } });
      const prev = (existing?.brandingConfig && typeof existing.brandingConfig === 'object' ? existing.brandingConfig : {}) as Record<string, unknown>;
      mergedConfig = { ...prev, ...brandingConfig };
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        primaryColor: typeof primaryColor === 'string' ? primaryColor : undefined,
        secondaryColor: typeof secondaryColor === 'string' ? secondaryColor : undefined,
        accentColor: typeof accentColor === 'string' ? accentColor : undefined,
        logo: typeof logo === 'string' ? logo : undefined,
        ...(mergedConfig !== undefined ? { brandingConfig: mergedConfig as any } : {}),
      },
      select: {
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logo: true,
        name: true,
        brandingConfig: true,
      }
    });

    // Log branding update
    await auditLogger.updateBranding(req, {
      tenantId: tenant.id,
      changes: { primaryColor, secondaryColor, accentColor, logo, brandingConfig }
    });

    return safeJson(res, { success: true, branding: updated });
  } catch (error) {
    console.error('Update branding error:', error);
    return safeJson(res, { success: false, message: 'Failed to update branding' }, 500);
  }
});

// Simple base64 logo upload (PNG/JPG). In production, use S3 or a CDN.
router.post('/me/logo', async (req, res) => {
  try {
    const role = getRole(req);
    if (role !== 'admin') return safeJson(res, { success: false, message: 'Admin role required' }, 403);
    const tenant = (await resolveTenantForRequest(req as any)) as any;
    if (!tenant) return safeJson(res, { success: false, message: 'Tenant not found' }, 404);
    const { dataUrl } = req.body || {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return safeJson(res, { success: false, message: 'Invalid image data' }, 400);
    }
    const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl);
    if (!match) return safeJson(res, { success: false, message: 'Unsupported image format' }, 400);
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buf = Buffer.from(match[2], 'base64');
    // Enforce max size (2MB)
    const MAX_BYTES = 2 * 1024 * 1024;
    if (buf.length > MAX_BYTES) {
      return safeJson(res, { success: false, message: 'Image too large. Max 2MB and 512x512.' }, 413);
    }
    // Save under backend/assets/logos regardless of cwd
    const dir = path.join(__dirname, '..', 'assets', 'logos');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const filename = `tenant-${tenant.id}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buf);
    // Basic dimension check using sharp if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require('sharp');
      const meta = await sharp(filePath).metadata();
      if ((meta.width && meta.width > 512) || (meta.height && meta.height > 512)) {
        await sharp(filePath).resize({ width: 512, height: 512, fit: 'inside' }).toFile(filePath + '.tmp');
        fs.renameSync(filePath + '.tmp', filePath);
      }
    } catch {}
    // Serve via Next proxy to avoid CORS: frontend will request /api/proxy/assets/... which forwards to backend
    const publicUrl = `/api/proxy/assets/logos/${filename}`;
    const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: { logo: publicUrl } });
    
    // Log logo upload
    await auditLogger.uploadLogo(req, {
      tenantId: tenant.id,
      filename,
      fileSize: buf.length,
      dimensions: { width: 512, height: 512 }
    });
    
    return safeJson(res, { success: true, logo: publicUrl, tenant: { id: tenant.id, name: updated.name } });
  } catch (e) {
    console.error('Upload logo error:', e);
    return safeJson(res, { success: false, message: 'Failed to upload logo' }, 500);
  }
});

// Backward-compatible: alternate logo upload path
router.post('/logo', async (req, res) => {
  try {
    const role = getRole(req);
    if (role !== 'admin') return safeJson(res, { success: false, message: 'Admin role required' }, 403);
    const tenant = (await resolveTenantForRequest(req as any)) as any;
    if (!tenant) return safeJson(res, { success: false, message: 'Tenant not found' }, 404);
    const { dataUrl } = req.body || {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return safeJson(res, { success: false, message: 'Invalid image data' }, 400);
    }
    const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl);
    if (!match) return safeJson(res, { success: false, message: 'Unsupported image format' }, 400);
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buf = Buffer.from(match[2], 'base64');
    const MAX_BYTES = 2 * 1024 * 1024;
    if (buf.length > MAX_BYTES) return safeJson(res, { success: false, message: 'Image too large. Max 2MB and 512x512.' }, 413);
    const dir = path.join(__dirname, '..', 'assets', 'logos');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const filename = `tenant-${tenant.id}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buf);
    try {
      const sharp = require('sharp');
      const meta = await sharp(filePath).metadata();
      if ((meta.width && meta.width > 512) || (meta.height && meta.height > 512)) {
        await sharp(filePath).resize({ width: 512, height: 512, fit: 'inside' }).toFile(filePath + '.tmp');
        fs.renameSync(filePath + '.tmp', filePath);
      }
    } catch {}
    const publicUrl = `/api/proxy/assets/logos/${filename}`;
    const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: { logo: publicUrl } });
    return safeJson(res, { success: true, logo: publicUrl, tenant: { id: tenant.id, name: updated.name } });
  } catch (e) {
    console.error('Upload logo error (alt):', e);
    return safeJson(res, { success: false, message: 'Failed to upload logo' }, 500);
  }
});

// Purge a tenant's data (inquiries, followups(+comments), tasks, users except caller)
// Path param can be tenant subdomain or name
router.post('/:tenantIdOrSlug/reset', async (req, res) => {
  try {
    const role = getRole(req);
    const callerEmail = String((req as any).user?.email || '');
    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin role required' });
    }

    const idOrSlug = req.params.tenantIdOrSlug.trim();
    // Resolve tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: isNaN(Number(idOrSlug)) ? -1 : Number(idOrSlug) },
          { subdomain: idOrSlug },
          { name: idOrSlug }
        ]
      }
    });
    if (!tenant) return safeJson(res, { success: false, message: 'Tenant not found' }, 404);

    // Ensure caller belongs to this tenant (basic safety)
    const caller = await prisma.user.findFirst({ where: { email: { equals: callerEmail, mode: 'insensitive' }, tenantId: tenant.id } });
    if (!caller) return safeJson(res, { success: false, message: 'Caller not in this tenant' }, 403);

    // Collect followup ids to delete comments
    const followups = await prisma.followup.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
    const followupIds = followups.map(f => f.id);

    const results = await prisma.$transaction(async (tx) => {
      let delComments = { count: 0 } as { count: number };
      if (followupIds.length > 0) {
        delComments = await tx.followupComment.deleteMany({ where: { followupId: { in: followupIds } } });
      }
      const delFollowups = await tx.followup.deleteMany({ where: { tenantId: tenant.id } });
      const delInquiries = await tx.inquiry.deleteMany({ where: { tenantId: tenant.id } });
      const delTasks = await tx.task.deleteMany({ where: { tenantId: tenant.id } });
      const delUsers = await tx.user.deleteMany({ where: { tenantId: tenant.id, email: { not: callerEmail } } });
      return { delComments, delFollowups, delInquiries, delTasks, delUsers };
    });

    return safeJson(res, { success: true, tenantId: tenant.id, deleted: {
      followupComments: results.delComments.count,
      followups: results.delFollowups.count,
      inquiries: results.delInquiries.count,
      tasks: results.delTasks.count,
      users: results.delUsers.count,
    }});
  } catch (error) {
    console.error('Tenant reset error:', error);
    if (res.headersSent) return;
    return safeJson(res, { success: false, message: 'Failed to reset tenant', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Example protected endpoints (branding)
router.post('/branding', rbacGuard('settings'), async (req, res) => {
  try {
    const role = getRole(req);
    if (role !== 'admin') {
      return safeJson(res, { success: false, message: 'Admin role required' }, 403);
    }

    const tenant = (await resolveTenantForRequest(req as any)) as any;
    if (!tenant) return safeJson(res, { success: false, message: 'Tenant not found' }, 404);

  const { primaryColor, secondaryColor, accentColor, logo } = req.body || {};

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        primaryColor: typeof primaryColor === 'string' ? primaryColor : undefined,
        secondaryColor: typeof secondaryColor === 'string' ? secondaryColor : undefined,
        accentColor: typeof accentColor === 'string' ? accentColor : undefined,
        logo: typeof logo === 'string' ? logo : undefined,
      },
      select: {
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logo: true,
        name: true,
      }
    });

    // Log branding update
    await auditLogger.updateBranding(req, {
      tenantId: tenant.id,
      changes: { primaryColor, secondaryColor, accentColor, logo }
    });

    return safeJson(res, { success: true, branding: updated });
  } catch (error) {
    console.error('Update branding error:', error);
    return safeJson(res, { success: false, message: 'Failed to update branding' }, 500);
  }
});

export default router;
