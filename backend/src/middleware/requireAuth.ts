import { Request, Response, NextFunction } from 'express';

/** Paths that do not require a valid session. All other /api/* routes return 401 when unauthenticated. */
const PUBLIC_PATHS: Array<{ method: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/users\/login$/ },
  { method: 'POST', pattern: /^\/api\/users\/login\/verify-otp$/ },
  { method: 'POST', pattern: /^\/api\/cpanel\/login$/ },
  { method: 'POST', pattern: /^\/api\/cpanel\/login\/verify-otp$/ },
  { method: 'POST', pattern: /^\/api\/users\/forgot-password$/ },
  { method: 'POST', pattern: /^\/api\/users\/reset-password$/ },
  { method: 'POST', pattern: /^\/api\/users\/register$/ },
  { method: 'POST', pattern: /^\/api\/users\/logout$/ },
  { method: 'GET', pattern: /^\/api\/tenants\/?$/ },
  { method: 'GET', pattern: /^\/api\/tenants\/by-code$/ },
  { method: 'GET', pattern: /^\/api\/tenants\/me$/ },
  { method: 'GET', pattern: /^\/api\/tenants\/me\/branding$/ },
  { method: 'ALL', pattern: /^\/api\/public\// },
];

function isPublicPath(method: string, path: string): boolean {
  const normalized = path.replace(/\?.*$/, '');
  return PUBLIC_PATHS.some(({ method: m, pattern }) => (m === 'ALL' || m === method) && pattern.test(normalized));
}

/**
 * Returns 401 for all protected /api/* routes when no valid session (req.user) exists.
 * Public paths (login, forgot-password, tenant list, branding) are excluded.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  const path = req.path || req.url?.split('?')[0] || '';
  if (!path.startsWith('/api')) {
    next();
    return;
  }
  if (isPublicPath(req.method, path)) {
    next();
    return;
  }
  const user = (req as any).user;
  if (!user?.email) {
    res.status(401).json({ error: 'Not authenticated', message: 'Valid session required' });
    return;
  }
  next();
}
