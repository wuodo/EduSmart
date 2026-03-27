import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// ---------------------------------------------------------------------------
// In-process tenant cache — 30 second TTL.
// Eliminates the 3-5 sequential DB queries that previously ran on every
// request just to resolve which tenant owns the request.
// ---------------------------------------------------------------------------
const TENANT_CACHE_TTL_MS = 30_000;
interface CacheEntry { tenant: any; expiresAt: number }
const _tenantCache = new Map<string, CacheEntry>();

function getCached(key: string): any | null {
  const entry = _tenantCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _tenantCache.delete(key); return null; }
  return entry.tenant;
}

function setCached(key: string, tenant: any): void {
  if (_tenantCache.size > 500) {
    // Evict oldest quarter to cap memory usage
    const keys = Array.from(_tenantCache.keys()).slice(0, 125);
    keys.forEach(k => _tenantCache.delete(k));
  }
  _tenantCache.set(key, { tenant, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
}

async function lookupTenant(identifier: string): Promise<any | null> {
  const cached = getCached(identifier);
  if (cached !== null) return cached;

  const idNum = parseInt(identifier, 10);
  const byId = !isNaN(idNum) && String(idNum) === identifier;

  const tenant = await prisma.tenant.findFirst({
    where: {
      isActive: true,
      OR: [
        ...(byId ? [{ id: idNum }] : []),
        { subdomain: { equals: identifier, mode: 'insensitive' as const } },
        { name: { equals: identifier, mode: 'insensitive' as const } },
        { domain: { equals: identifier, mode: 'insensitive' as const } },
      ],
    },
  });
  setCached(identifier, tenant ?? null);
  return tenant ?? null;
}

async function lookupTenantById(id: number): Promise<any | null> {
  const key = String(id);
  const cached = getCached(key);
  if (cached !== null) return cached;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (tenant) setCached(key, tenant);
  return tenant ?? null;
}

/**
 * Middleware to resolve tenant from subdomain or path
 * Supports subdomain, path prefix, custom header, and ?tenant= query param
 */
export const resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let tenant: any = null;
    let tenantIdentifier: string | null = null;

    // --- Priority 1: x-tenant header (set by every proxy request in production) ---
    const hdr = String(req.headers['x-tenant'] || '').trim();
    if (hdr) {
      tenant = await lookupTenant(hdr);
      if (tenant) tenantIdentifier = hdr;
    }

    // --- Priority 2: Host subdomain ---
    if (!tenant) {
      const host = req.get('host') || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && subdomain !== '127') {
        tenant = await lookupTenant(subdomain);
        if (tenant) tenantIdentifier = subdomain;
      }
    }

    // --- Priority 3: ?tenant= query param ---
    if (!tenant) {
      const qp = String(req.query?.tenant || '').trim();
      if (qp) {
        tenant = await lookupTenant(qp);
        if (tenant) tenantIdentifier = qp;
      }
    }

    // --- Priority 4: Path prefix /:tenant/api/... ---
    if (!tenant && req.path) {
      const pathParts = req.path.split('/').filter(Boolean);
      if (pathParts.length > 1 && pathParts[1] === 'api') {
        const pathTenant = pathParts[0];
        tenant = await lookupTenant(pathTenant);
        if (tenant) {
          tenantIdentifier = pathTenant;
          (req as any).path = '/' + pathParts.slice(1).join('/');
          (req as any).url = '/' + pathParts.slice(1).join('/');
        }
      }
    }

    // --- Priority 5: Fall back to session user's tenantId ---
    const sessionUser: any = (req as any).user;
    if (!tenant && sessionUser?.tenantId) {
      tenant = await lookupTenantById(sessionUser.tenantId);
      if (tenant) tenantIdentifier = tenant.subdomain || tenant.name || String(tenant.id);
    }

    // Attach tenant to request
    (req as any).tenant = tenant || undefined;
    (req as any).tenantIdentifier = tenantIdentifier || undefined;

    // Session user / resolved tenant mismatch — prefer session user's tenant (cached lookup)
    try {
      const user: any = (req as any).user;
      if (user && tenant && user.tenantId && tenant.id && user.tenantId !== tenant.id) {
        const t = await lookupTenantById(user.tenantId);
        if (t) {
          (req as any).tenant = t;
          (req as any).tenantIdentifier = t.subdomain || 'default';
        }
      }
    } catch (_) {}

    // Auth endpoints resolve tenant from request body — never block them here.
    const SELF_RESOLVING_PATHS = [
      /^\/api\/users\/login/,
      /^\/api\/cpanel/,
      /^\/api\/users\/forgot-password/,
      /^\/api\/users\/reset-password/,
      /^\/api\/users\/register/,
      /^\/api\/users\/logout/,
    ];
    const isSelfResolvingPath = SELF_RESOLVING_PATHS.some(p => p.test(req.path));

    if (!tenant) {
      const isLocalhost = (req.get('host') || '').toLowerCase().includes('localhost');
      if (process.env.NODE_ENV !== 'production' || isLocalhost) {
        let fallback = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
        if (!fallback) fallback = await prisma.tenant.findFirst({ orderBy: { id: 'asc' } });
        (req as any).tenant = fallback || undefined;
        (req as any).tenantIdentifier = 'default';
      } else if (isSelfResolvingPath) {
        (req as any).tenant = undefined;
        (req as any).tenantIdentifier = undefined;
      } else {
        res.status(400).json({ success: false, message: 'Tenant not found or inactive' });
        return;
      }
    }

    next();
    return;
  } catch (error) {
    console.error('Error resolving tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving tenant',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
};

export const requireTenant = (req: Request, res: Response, next: NextFunction): void => {
  if (!(req as any).tenant) {
    res.status(400).json({
      success: false,
      message: 'Tenant not found or inactive'
    });
    return;
  }
  next();
};

export const withTenant = (query: any, tenantId?: number) => {
  if (tenantId) {
    return {
      ...query,
      where: {
        ...query.where,
        tenantId: tenantId
      }
    };
  }
  return query;
};
