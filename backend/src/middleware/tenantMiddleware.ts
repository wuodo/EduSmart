import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

/**
 * Middleware to resolve tenant from subdomain or path
 * Supports subdomain, path prefix, custom header, and ?tenant= query param
 */
export const resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let tenant: any = null;
    let tenantIdentifier: string | null = null;

    // Method 1: Resolve from subdomain
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && subdomain !== '127') {
      tenant = await prisma.tenant.findFirst({
        where: {
          subdomain: subdomain,
          isActive: true
        }
      });
      if (tenant) tenantIdentifier = subdomain;
    }

    // Method 2: Resolve from path ONLY when shaped like /:tenant/api/... to avoid treating '/api' as a tenant
    if (!tenant && req.path) {
      const pathParts = req.path.split('/').filter(Boolean);
      // Require '/:tenant/api/...'
      if (pathParts.length > 1 && pathParts[1] === 'api') {
        const pathTenant = pathParts[0];
        const maybe = await prisma.tenant.findFirst({
          where: { subdomain: pathTenant, isActive: true }
        });
        if (maybe) {
          tenant = maybe;
          tenantIdentifier = pathTenant;
          // Rewrite path to drop the tenant prefix
          (req as any).path = '/' + pathParts.slice(1).join('/');
          (req as any).url = '/' + pathParts.slice(1).join('/');
        }
      }
    }

    // Method 3: Query param ?tenant=
    if (!tenant) {
      const qp = (req.query?.tenant as string) || '';
      if (qp) {
        const maybe = await prisma.tenant.findFirst({ where: { OR: [ { subdomain: qp }, { name: { equals: qp, mode: 'insensitive' } } ], isActive: true } });
        if (maybe) {
          tenant = maybe;
          tenantIdentifier = qp;
        }
      }
    }

    // Method 4: Custom header (for dev/testing/proxy) - supports tenant ID or subdomain/name
    if (!tenant && req.headers['x-tenant']) {
      const hdr = String(req.headers['x-tenant']).trim();
      const idNum = parseInt(hdr, 10);
      let maybe = null;
      if (!isNaN(idNum) && String(idNum) === hdr) {
        maybe = await prisma.tenant.findFirst({ where: { id: idNum, isActive: true } });
        // Non-prod convenience: accept inactive tenant IDs for local/dev DBs
        if (!maybe && process.env.NODE_ENV !== 'production') {
          maybe = await prisma.tenant.findFirst({ where: { id: idNum } });
        }
      }
      if (!maybe) {
        maybe = await prisma.tenant.findFirst({ where: { OR: [ { subdomain: hdr }, { name: { equals: hdr, mode: 'insensitive' } } ], isActive: true } });
      }
      if (maybe) {
        tenant = maybe;
        tenantIdentifier = maybe.subdomain || maybe.name || String(maybe.id);
      }
    }

    // If no tenant found yet, but session user has tenantId, use that
    const sessionUser: any = (req as any).user;
    if (!tenant && sessionUser?.tenantId) {
      const t = await prisma.tenant.findUnique({ where: { id: sessionUser.tenantId } });
      if (t) {
        tenant = t;
        tenantIdentifier = t.subdomain || t.name || String(t.id);
      }
    }

    // Attach tenant to request (cast for runtime)
    (req as any).tenant = tenant || undefined;
    (req as any).tenantIdentifier = tenantIdentifier || undefined;

    // Auth endpoints resolve their own tenant from tenant_code in the body —
    // they must never be blocked here regardless of environment.
    const SELF_RESOLVING_PATHS = [
      /^\/api\/users\/login/,
      /^\/api\/cpanel\/login/,
      /^\/api\/users\/forgot-password/,
      /^\/api\/users\/reset-password/,
      /^\/api\/users\/register/,
      /^\/api\/users\/logout/,
    ];
    const isSelfResolvingPath = SELF_RESOLVING_PATHS.some(p => p.test(req.path));

    // In non-production you may want a convenient fallback; in production we require an explicit tenant.
    // Local dev safety: if running on localhost, allow a fallback tenant even if NODE_ENV is mis-set.
    if (!tenant) {
      const isLocalhost = (() => {
        const h = (req.get('host') || '').toLowerCase()
        return h.includes('localhost') || h.includes('127.0.0.1')
      })()
      if (process.env.NODE_ENV !== 'production' || isLocalhost) {
        // Dev fallback: pick any active tenant to keep local dev usable
        let fallback = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
        // Last resort: any tenant at all (covers cases where isActive is unset in the DB)
        if (!fallback) fallback = await prisma.tenant.findFirst({ orderBy: { id: 'asc' } });
        (req as any).tenant = fallback || undefined;
        (req as any).tenantIdentifier = 'default';
      } else if (isSelfResolvingPath) {
        // Auth paths handle tenant resolution from request body — allow through without a pre-resolved tenant.
        (req as any).tenant = undefined;
        (req as any).tenantIdentifier = undefined;
      } else {
        res.status(400).json({
          success: false,
          message: 'Tenant not found or inactive'
        });
        return;
      }
    }

    // If session user exists, ensure req.user.tenantId aligns; otherwise leave as-is
    try {
      const user: any = (req as any).user;
      if (user && tenant && user.tenantId && tenant.id && user.tenantId !== tenant.id) {
        // Mismatch: prefer session user tenant
        const t = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (t) {
          (req as any).tenant = t;
          (req as any).tenantIdentifier = t.subdomain || 'default';
        }
      }
    } catch(_) {}

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
