import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { inquiryRoutes, getTenantId as getInquiryTenantId } from './routes/inquiryRoutes';
import followupRoutes from './routes/followup.routes';
import followupCommentRoutes from './routes/followupComment.routes';
import admissionLetterRoutes from './routes/admissionLetter.routes';
import { downloadAdmissionLetter, generateAdmissionLetter, bulkGenerateAdmissionLetters } from './controllers/admissionLetter.controller';
import { userRoutes } from './routes/userRoutes';
import approvalsRoutes from './routes/approvals.routes';
import deleteRequestsRoutes from './routes/deleteRequests.routes';
import notificationsRoutes from './routes/notifications.routes';
import auditLogsRoutes from './routes/auditLogs.routes';
import { listAuditLogs, createAuditLog, clearAuditLogs } from './controllers/auditLog.controller';
import chatRoutes from './routes/chat.routes';
import { calendarRoutes } from './routes/calendar.routes';
import esignRoutes from './routes/esign.routes';
import { resolveTenant } from './middleware/tenantMiddleware';
import tenantAdminRoutes from './routes/tenant.routes';
import prisma from './lib/prisma';
import path from 'path';
import permissionsRoutes from './routes/permissions.routes';
import cpanelRoutes from './routes/cpanel.routes';
import marketingSettingsRoutes from './routes/marketingSettings.routes';
import askAiRoutes from './routes/askAi.routes';
import accountabilityRoutes from './routes/accountability.routes';
import briefingRoutes from './routes/briefing.routes';
import emailMessagingRoutes from './routes/emailMessaging.routes';
import { startScheduler } from './services/schedulerService';
import { getInAppNotifications, clearInAppNotifications } from './services/notificationService';
import { ensureLetterCountersTable } from './utils/letterCounters';
import coursesRoutes from './routes/courses.routes';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { rbacGuard } from './middleware/rbac';
import { requireAuth } from './middleware/requireAuth';
import { auditLogger } from './utils/auditLogger';
import { recordFailedAttempt, clearAttempts, isLocked, getRemainingLockoutMs } from './utils/loginRateLimit';
import { createOtpChallenge, verifyOtpChallenge } from './utils/otpChallenge';
import { sendOtpCodeEmail, hasSmtpConfig } from './utils/email';
import {
  getFollowups,
  getFollowupById,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  getDeletedRecentFollowups,
  getPerformanceAnalytics,
  getNurturingRecommendationForInquiry,
  getFollowupOutcomePrediction,
} from './controllers/followup.controller';
import { getComments, createComment, editComment, deleteComment } from './controllers/followupComment.controller';

// Load environment variables
dotenv.config();

// Bypass OTP for CPANEL super admin login.
const DISABLE_C_PANEL_OTP = true;
// Bypass OTP for tenant login. Set DISABLE_TENANT_OTP=false to re-enable when SMTP is configured.
const DISABLE_TENANT_OTP =
  String(process.env.DISABLE_TENANT_OTP ?? 'true').toLowerCase() !== 'false';

// Prevent unhandled rejections/exceptions from crashing the server
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason?.message || reason);
});
process.on('uncaughtException', (err: Error) => {
  console.error('[uncaughtException]', err.message, err.stack);
});

const app = express();

function clientIp(req: any): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function deviceIdFromReq(req: any): string {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  const al = String(req.headers['accept-language'] || '').toLowerCase();
  const platform = String(req.headers['sec-ch-ua-platform'] || '').toLowerCase();
  return crypto.createHash('sha256').update(`${ua}|${al}|${platform}`).digest('hex').slice(0, 32);
}

async function hasKnownDevice(email: string, tenantId: number | null, deviceId: string): Promise<boolean> {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'login_success', user: email },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { details: true },
  });
  return logs.some((l: any) => {
    const d = l?.details || {};
    return d?.deviceId === deviceId && (d?.tenantId ?? null) === (tenantId ?? null);
  });
}

// Middleware
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-tenant', 'x-user-role', 'x-user-email'],
}));
// PDF bulk generation needs up to ~10mb; all other endpoints stay at 2mb.
app.use('/api/admission-letters/bulk', express.json({ limit: '10mb' }));
app.use('/api/admission-letters/generate', express.json({ limit: '10mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
// serve static assets directory for uploaded logos
app.use('/assets', (req, res, next) => {
  const p = path.join(__dirname, '..', 'assets');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('express').static(p, { fallthrough: true })(req, res, next);
});

// ---------------------------------------------------------------------------
// Global API rate limiter — 2000 requests per 60 s per IP (safety net only).
// Increased from 600 to accommodate Render free-tier cold starts and multi-user
// scenarios where all traffic shares the same proxy IP. Login/public/cpanel paths
// are already exempt. Frontend polling intervals have been increased to reduce
// overall request volume. This is still a reasonable safeguard against runaway requests.
// NOTE: On Render free-tier, all users may share the same egress IP.
// ---------------------------------------------------------------------------
const _globalRateStore = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_RATE_LIMIT = 2000;
const GLOBAL_RATE_WINDOW_MS = 60_000;
const GLOBAL_RATE_EXEMPT = [
  '/api/users/login',
  '/api/cpanel/login',
  '/api/cpanel',          // All cpanel routes are already auth-protected; exempt to avoid false 429s for admins
  '/api/users/forgot-password',
  '/api/users/reset-password',
  '/api/users/register',
  '/api/tenants',
];
app.use((req: any, res: any, next: any) => {
  if (!req.path.startsWith('/api')) return next();
  if (GLOBAL_RATE_EXEMPT.some((p) => req.path.startsWith(p))) return next();
  const ip: string =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  let entry = _globalRateStore.get(ip);
  if (!entry || now > entry.resetAt) {
    _globalRateStore.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > GLOBAL_RATE_LIMIT) {
    res.setHeader('Retry-After', '60');
    res.setHeader('X-RateLimit-Source', 'global-api-limiter');
    if (!res.headersSent) {
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
    return;
  }
  return next();
});
// Periodic cleanup — prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _globalRateStore.entries()) {
    if (now > entry.resetAt) _globalRateStore.delete(ip);
  }
}, 5 * 60 * 1000).unref();


// Memory monitoring — logs every 5 minutes; visible in Render log stream
setInterval(() => {
  const m = process.memoryUsage();
  const mb = (v: number) => (v / 1024 / 1024).toFixed(1);
  if (parseFloat(mb(m.rss)) > 400) {
    console.warn(`[MEM] rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB ext=${mb(m.external)}MB`);
  }
}, 5 * 60 * 1000).unref();

// In-process session cache — 60 second TTL.
// Eliminates a DB roundtrip on EVERY /api request; critical on Render free-tier
// cold starts where 5+ concurrent requests each hit the DB for session auth.
const SESSION_CACHE_TTL_MS = 60_000;
const _sessionCache = new Map<string, { user: any; session: any; expiresAt: number }>();
function getCachedSession(token: string) {
  const e = _sessionCache.get(token);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { _sessionCache.delete(token); return null; }
  return e;
}
function setCachedSession(token: string, user: any, session: any) {
  if (_sessionCache.size > 2000) {
    // Evict oldest 500 to cap memory when many concurrent users are active
    const oldest = Array.from(_sessionCache.keys()).slice(0, 500);
    oldest.forEach(k => _sessionCache.delete(k));
  }
  _sessionCache.set(token, { user, session, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
}
export function invalidateSessionCache(token: string) { _sessionCache.delete(token); }

// Session middleware: attach req.user if session cookie is valid (API routes only)
app.use('/api', async (req, _res, next) => {
  try {
    const cookie = req.headers['cookie'] || '';
    const match = /(?:^|; )session=([^;]+)/.exec(cookie);
    const token = match ? decodeURIComponent(match[1]) : '';
    if (token) {
      const cached = getCachedSession(token);
      if (cached) {
        (req as any).session = cached.session;
        (req as any).user = cached.user;
      } else {
        const rows: any[] = await prisma.$queryRaw`
          SELECT s.*, u.id as u_id, u.email as u_email, u.role as u_role, u.name as u_name, u."tenantId" as u_tenant_id
          FROM sessions s
          JOIN users u ON u.id = s."userId"
          WHERE s.token = ${token} AND s."expiresAt" > NOW()
        `;
        if (rows && rows.length > 0) {
          const r = rows[0];
          const sessionObj = { id: r.id, token: r.token, userId: r.userId, tenantId: r.tenantId };
          const userObj = { id: r.u_id, email: r.u_email, role: r.u_role, name: r.u_name, tenantId: r.u_tenant_id };
          (req as any).session = sessionObj;
          (req as any).user = userObj;
          setCachedSession(token, userObj, sessionObj);
        }
      }
    }
  } catch (_e) {
    // ignore
  }
  next();
});

// Tenant resolution must come before routes
app.use(resolveTenant);

// Strict auth: 401 for protected /api/* when no valid session
app.use(requireAuth);

// Shim: ensure /api/users/login exists (some environments were returning 404)
app.post('/api/users/login', async (req, res) => {
  try {
    const { tenant_code, email, password } = req.body || {};
    const tenantCode = String(tenant_code || '').trim();
    const normalizedEmail = String(email || '').trim();
    // Trim in case the client accidentally includes whitespace around the password.
    // Also strip zero-width characters which can get copied into password fields.
    const normalizedPassword = String(password || '')
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (!tenantCode || !normalizedEmail || !normalizedPassword) {
      console.warn('[login] missing fields:', { tenantCode: !!tenantCode, email: !!normalizedEmail, password: !!normalizedPassword });
      if (res.headersSent) return;
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const ip = clientIp(req);
    const identifier = `${tenantCode}:${normalizedEmail}`;

    if (isLocked('tenant', ip, identifier)) {
      if (res.headersSent) return;
      const lockRemainingSec = Math.ceil(getRemainingLockoutMs('tenant', ip, identifier) / 1000)
      res.set('Retry-After', String(lockRemainingSec))
      res.set('X-RateLimit-Source', 'in-process-login-limiter')
      return res.status(429).json({ error: 'Too many failed attempts. Please wait 15 minutes before trying again.' });
    }

    const asId = Number.parseInt(tenantCode, 10);
    let tenant: any = null;
    // Treat any digits-only tenant_code (including leading zeros like "03") as an ID.
    // Do NOT filter by isActive here — check it separately so a suspended tenant gives
    // a clear error instead of silently matching nothing.
    if (!Number.isNaN(asId) && /^\d+$/.test(tenantCode)) {
      tenant = await prisma.tenant.findFirst({ where: { id: asId } });
    }
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { subdomain: { equals: tenantCode, mode: 'insensitive' } },
            { name: { equals: tenantCode, mode: 'insensitive' } },
            { domain: { equals: tenantCode, mode: 'insensitive' } },
          ],
        },
      });
    }
    if (!tenant) {
      console.warn('[login] tenant not found for code:', tenantCode);
      if (res.headersSent) return;
      return res.status(401).json({ error: 'Invalid login credentials' });
    }
    if (tenant.isActive === false) {
      console.warn('[login] tenant suspended:', tenant.id);
      if (res.headersSent) return;
      return res.status(403).json({ error: 'Institution account is suspended. Please contact support.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        tenantId: tenant.id,
      }
    });

    const passwordOk = user
      ? ((!user.password.startsWith('$2') && user.password === normalizedPassword) ||
         await bcrypt.compare(normalizedPassword, user.password))
      : false;

    if (!user || !passwordOk) {
      console.warn('[login] failed:', { tenantId: tenant.id, email: normalizedEmail, userFound: !!user, passwordOk });
      recordFailedAttempt('tenant', ip, identifier);
      if (!res.headersSent) {
        return res.status(401).json({ error: 'Invalid login credentials' });
      }
      return;
    }

    if (user.approved === false) {
      if (!res.headersSent) return res.status(403).json({ error: 'Account pending approval. Please contact your administrator.' });
      return;
    }

    // Re-hash plain-text passwords on successful login
    if (!user.password.startsWith('$2') && user.password === normalizedPassword) {
      const hashed = bcrypt.hashSync(normalizedPassword, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } }).catch(() => {});
    }

    clearAttempts('tenant', ip, identifier);
    const deviceId = deviceIdFromReq(req);

    const skipOtp = DISABLE_TENANT_OTP || !hasSmtpConfig();
    if (!skipOtp) {
      const knownDevice = await hasKnownDevice(user.email, tenant.id, deviceId);
      if (!knownDevice) {
        const { id, code } = createOtpChallenge({
          email: user.email,
          tenantId: tenant.id,
          role: 'tenant',
          deviceId,
          ip,
        });
        await sendOtpCodeEmail(user.email, code);
        await auditLogger.custom(req, 'login_otp_challenge_sent', 'auth', { email: user.email, tenantId: tenant.id, deviceId });
        return res.status(200).json({ requiresOtp: true, challengeId: id, message: 'Verification code sent to your email.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await prisma.$executeRaw`
      INSERT INTO sessions (token, "userId", "tenantId", "expiresAt", "lastUsedAt")
      VALUES (${token}, ${user.id}, ${tenant.id}, ${expiresAt}, NOW())
    `;
    await auditLogger.login(req, user.email, true, { role: user.role, tenantId: tenant.id, tenantCode, deviceId, ip });
    if (!res.headersSent) {
      res.cookie('session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        path: '/',
      });
      const appRole = String(user.role).toLowerCase() === 'admin'
        ? 'admin'
        : (String(user.role).toLowerCase() === 'senior_staff' ? 'manager' : 'staff');
      return res.json({
        token,
        user: { id: user.id, email: user.email, role: appRole, tenant_id: tenant.id },
        dbRole: user.role,
        name: user.name || user.email,
      });
    }
    return;
  } catch (e) {
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Login error' });
    }
    return;
  }
});

// Shim: ensure /api/cpanel/login exists for super admin login
app.post('/api/cpanel/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      if (!res.headersSent) {
        return res.status(400).json({ error: 'email and password required' });
      }
      return;
    }

    const ip = clientIp(req);
    const normalizedEmail = String(email || '').trim();

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        role: 'admin',
        tenantId: null
      }
    });

    const cpanelPasswordOk = user
      ? ((!user.password.startsWith('$2') && user.password === password) ||
         await bcrypt.compare(password, user.password))
      : false;

    if (!user || !cpanelPasswordOk) {
      recordFailedAttempt('cpanel', ip, normalizedEmail);
      if (!res.headersSent) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      return;
    }

    if (user.approved === false) {
      if (!res.headersSent) return res.status(403).json({ error: 'Account not approved' });
      return;
    }

    // Re-hash plain-text passwords on first successful login
    if (!user.password.startsWith('$2') && user.password === password) {
      const hashed = bcrypt.hashSync(password, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } }).catch(() => {});
    }

    clearAttempts('cpanel', ip, normalizedEmail);
    const deviceId = deviceIdFromReq(req);
    const knownDevice = await hasKnownDevice(user.email, null, deviceId);
    if (!knownDevice) {
      if (!DISABLE_C_PANEL_OTP) {
      const { id, code } = createOtpChallenge({
        email: user.email,
        tenantId: null,
        role: 'super_admin',
        deviceId,
        ip,
      });
      const sent = await sendOtpCodeEmail(user.email, code);
      if (!sent && process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] CPANEL OTP for ${user.email}: ${code}`);
      }
      await auditLogger.custom(req, 'cpanel_login_otp_challenge_sent', 'auth', { email: user.email, deviceId, ip });
      return res.status(200).json({ requiresOtp: true, challengeId: id, message: 'Verification code sent to your email.' });
      }
      // OTP disabled temporarily: treat device as known.
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await prisma.$executeRaw`
      INSERT INTO sessions (token, "userId", "tenantId", "expiresAt", "lastUsedAt")
      VALUES (${token}, ${user.id}, ${null}, ${expiresAt}, NOW())
    `;
    await auditLogger.login(req, user.email, true, { role: user.role, tenantId: null, deviceId, ip });
    if (!res.headersSent) {
      res.cookie('session', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        path: '/',
      });
      return res.json({ success: true, role: 'super_admin', name: user.name || email });
    }
    return;
  } catch (e) {
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Login failed' });
    }
    return;
  }
});

app.post('/api/users/login/verify-otp', async (req, res) => {
  try {
    const { challengeId, code, tenant_code } = req.body || {};
    if (!challengeId || !code || !tenant_code) return res.status(400).json({ error: 'Missing verification fields' });
    const verify = verifyOtpChallenge(String(challengeId), String(code));
    if (!verify.ok || !verify.challenge) return res.status(401).json({ error: 'Invalid or expired verification code' });
    const c = verify.challenge;
    if (c.role !== 'tenant') return res.status(401).json({ error: 'Invalid verification context' });
    const tenantCode = String(tenant_code).trim();
    const tenant = await prisma.tenant.findFirst({
      where: {
        isActive: true,
        OR: [
          { subdomain: { equals: tenantCode, mode: 'insensitive' } },
          { name: { equals: tenantCode, mode: 'insensitive' } },
          { domain: { equals: tenantCode, mode: 'insensitive' } },
          ...(Number.isFinite(Number(tenantCode)) ? [{ id: Number(tenantCode) }] : []),
        ],
      },
    });
    if (!tenant || tenant.id !== c.tenantId) return res.status(401).json({ error: 'Invalid verification context' });
    const user = await prisma.user.findFirst({
      where: { email: { equals: c.email, mode: 'insensitive' }, tenantId: tenant.id },
    });
    if (!user) return res.status(401).json({ error: 'Invalid verification context' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await prisma.$executeRaw`
      INSERT INTO sessions (token, "userId", "tenantId", "expiresAt", "lastUsedAt")
      VALUES (${token}, ${user.id}, ${tenant.id}, ${expiresAt}, NOW())
    `;
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });
    const appRole = String(user.role).toLowerCase() === 'admin'
      ? 'admin'
      : (String(user.role).toLowerCase() === 'senior_staff' ? 'manager' : 'staff');
    await auditLogger.login(req, user.email, true, { role: user.role, tenantId: tenant.id, tenantCode, deviceId: c.deviceId, ip: c.ip, otpVerified: true });
    return res.json({ token, user: { id: user.id, email: user.email, role: appRole, tenant_id: tenant.id }, dbRole: user.role, name: user.name || user.email });
  } catch {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

app.post('/api/cpanel/login/verify-otp', async (req, res) => {
  try {
    const { challengeId, code, email } = req.body || {};
    if (!challengeId || !code || !email) return res.status(400).json({ error: 'Missing verification fields' });
    const verify = verifyOtpChallenge(String(challengeId), String(code));
    if (!verify.ok || !verify.challenge) return res.status(401).json({ error: 'Invalid or expired verification code' });
    const c = verify.challenge;
    if (c.role !== 'super_admin') return res.status(401).json({ error: 'Invalid verification context' });
    if (String(email).trim().toLowerCase() !== c.email.toLowerCase()) return res.status(401).json({ error: 'Invalid verification context' });
    const user = await prisma.user.findFirst({
      where: { email: { equals: c.email, mode: 'insensitive' }, role: 'admin', tenantId: null },
    });
    if (!user) return res.status(401).json({ error: 'Invalid verification context' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await prisma.$executeRaw`
      INSERT INTO sessions (token, "userId", "tenantId", "expiresAt", "lastUsedAt")
      VALUES (${token}, ${user.id}, ${null}, ${expiresAt}, NOW())
    `;
    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });
    await auditLogger.login(req, user.email, true, { role: user.role, tenantId: null, deviceId: c.deviceId, ip: c.ip, otpVerified: true });
    return res.json({ success: true, role: 'super_admin', name: user.name || user.email });
  } catch {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Test database connection
async function testConnection() {
  try {
    await prisma.$connect();
    if (process.env.NODE_ENV === 'development') {
      console.log('Connected to PostgreSQL successfully');
    }
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
    process.exit(1);
  }
}

testConnection();

// Routes
// Use the tenant-scoped router as the single source of truth.
// Mounting multiple routers on the same path can cause duplicate handlers and ERR_HTTP_HEADERS_SENT.
// Shim: provide stable GET /api/inquiries endpoints for UI + reports (paginated)
app.get('/api/inquiries', async (req, res) => {
  try {
    const tenantId = await getInquiryTenantId(req as any);
    if (!tenantId) return res.status(400).json({ message: 'Tenant not found or inactive' });
    const role = String((req as any).user?.role || '').toLowerCase();
    const email = String((req as any).user?.email || '').toLowerCase();
    const owner = String(req.query.owner || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (role === 'admissions_officer') {
      if (!email) return res.json({ data: [], total: 0, page, limit, pages: 0 });
      where.OR = [
        { createdBy: { equals: email, mode: 'insensitive' } },
        { assignedTo: { equals: email, mode: 'insensitive' } },
      ];
    } else if (role === 'admin' || role === 'senior_staff') {
      if (owner) {
        where.OR = [
          { createdBy: { equals: owner, mode: 'insensitive' } },
          { assignedTo: { equals: owner, mode: 'insensitive' } },
        ];
      }
    }

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
    return res.json({ data: inquiries, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e: any) {
    if (!res.headersSent) return res.status(500).json({ message: e?.message || 'Error fetching inquiries' });
    return;
  }
});

// Shim: provide stable POST /api/inquiries endpoint for UI
app.post('/api/inquiries', async (req, res) => {
  try {
    const tenantId = await getInquiryTenantId(req as any);
    if (!tenantId) return res.status(400).json({ message: 'Tenant not found or inactive' });
    const role = String((req as any).user?.role || '').toLowerCase();
    const email = String((req as any).user?.email || '').toLowerCase();
    // Enforce basic auth for creation: must have a role
    if (!role) return res.status(401).json({ message: 'Not authenticated' });

    const { detail, kcseGrade, assignedTo, ...rest } = req.body || {};
    const data: any = {
      ...rest,
      createdBy: email || undefined,
      assignedTo: assignedTo || email || undefined,
      tenantId,
    };
    if (data.email === undefined || data.email === null) data.email = '';
    if (kcseGrade) data.kcseGrade = kcseGrade;
    if (detail && (detail.county && detail.town)) {
      data.detail = { create: { county: detail.county, town: detail.town, idOrPassport: detail.idOrPassport || null } };
    }
    const inquiry = await prisma.inquiry.create({ data, include: { detail: true } });
    try {
      await auditLogger.createInquiry(req, { inquiryId: inquiry.id, inquiryData: rest, tenantId });
    } catch {}
    return res.status(201).json(inquiry);
  } catch (e: any) {
    if (!res.headersSent) return res.status(400).json({ message: e?.message || 'Error creating inquiry' });
    return;
  }
});
app.get('/api/inquiries/:id(\\d+)', async (req, res) => {
  try {
    const tenantId = await getInquiryTenantId(req as any);
    if (!tenantId) return res.status(400).json({ message: 'Tenant not found or inactive' });
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid inquiry id' });
    const role = String((req as any).user?.role || '').toLowerCase();
    const email = String((req as any).user?.email || '').toLowerCase();
    const inquiry = await prisma.inquiry.findFirst({ where: { id, tenantId }, include: { detail: true } });
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found' });
    if (role === 'admissions_officer' && email) {
      const createdBy = String((inquiry as any).createdBy || '').toLowerCase();
      const assignedTo = String((inquiry as any).assignedTo || '').toLowerCase();
      if (createdBy !== email && assignedTo !== email) return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json(inquiry);
  } catch (e: any) {
    if (!res.headersSent) return res.status(500).json({ message: e?.message || 'Error fetching inquiry' });
    return;
  }
});
app.use('/api/inquiries', inquiryRoutes);
// Shim: ensure letter status PATCH exists (used by admission letters)
app.patch('/api/inquiries/:id/letter-status', rbacGuard('inquiries'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (Number.isNaN(id)) {
      if (!res.headersSent) res.status(400).json({ error: 'Invalid inquiry id' });
      return;
    }
    const tenantId = (req as any).tenant?.id;
    const { letterStatus } = req.body || {};
    const nextStatus = String(letterStatus || '').trim();
    if (!nextStatus) {
      if (!res.headersSent) res.status(400).json({ error: 'Missing letterStatus' });
      return;
    }
    const inquiry = await prisma.inquiry.update({
      where: { id, tenantId } as any,
      data: { letterStatus: nextStatus },
    });
    if (!res.headersSent) res.json(inquiry);
  } catch (e: any) {
    if (!res.headersSent) res.status(400).json({ error: e?.message || 'Failed to update letter status' });
  }
});

// Shims: reminder endpoints used by Registrations module
app.get('/api/inquiries/:id/reminder', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (Number.isNaN(id)) {
      if (!res.headersSent) res.status(400).json({ error: 'Invalid inquiry id' });
      return;
    }
    const tenantId = (req as any).tenant?.id;
    const inquiry = await prisma.inquiry.findFirst({ where: { id, tenantId } });
    if (!inquiry) {
      if (!res.headersSent) res.status(404).json({ error: 'Inquiry not found' });
      return;
    }
    if (!res.headersSent) {
      res.json({
        lastReminderSent: inquiry.lastReminderSent,
        reminderStatus: inquiry.reminderStatus,
        lastReminderResponse: inquiry.lastReminderResponse,
        engagementSentiment: inquiry.engagementSentiment,
      });
    }
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e?.message || 'Failed to fetch reminder' });
  }
});

app.post('/api/inquiries/:id/reminder', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (Number.isNaN(id)) {
      if (!res.headersSent) res.status(400).json({ error: 'Invalid inquiry id' });
      return;
    }
    const tenantId = (req as any).tenant?.id;
    const { lastReminderSent, reminderStatus } = req.body || {};
    const inquiry = await prisma.inquiry.update({
      where: { id, tenantId } as any,
      data: { lastReminderSent, reminderStatus },
    });
    if (!res.headersSent) res.json(inquiry);
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e?.message || 'Failed to update reminder' });
  }
});

app.post('/api/inquiries/:id/reminder/response', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (Number.isNaN(id)) {
      if (!res.headersSent) res.status(400).json({ error: 'Invalid inquiry id' });
      return;
    }
    const { responseText } = req.body || {};
    const text = String(responseText || '').trim();
    if (!text) {
      if (!res.headersSent) res.status(400).json({ error: 'Missing responseText' });
      return;
    }
    const lower = text.toLowerCase();
    const positiveRe = /\b(yes|confirmed|coming|will report|sure|okay|ok|ready|see you|attend|definitely|absolutely|of course|looking forward)\b/;
    const negativeRe = /\b(no|not coming|postpone|cancel|cannot|won't|can't|not able|defer|drop|withdraw|not attending|not available|not possible|can't come|not ok)\b/;
    const hasNegative = negativeRe.test(lower);
    const hasPositive = positiveRe.test(lower);
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (hasNegative) sentiment = 'negative';
    else if (hasPositive) sentiment = 'positive';

    const tenantId = (req as any).tenant?.id;
    const inquiry = await prisma.inquiry.update({
      where: { id, tenantId } as any,
      data: { lastReminderResponse: text, engagementSentiment: sentiment },
    });
    if (!res.headersSent) res.json({ inquiry, sentiment });
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e?.message || 'Failed to log response' });
  }
});
app.use('/api/followups', followupRoutes);
// Shim: ensure /api/followups POST exists (some environments were returning 404)
app.get('/api/followups', getFollowups);
// Shim: must be defined before "/:id" or it will match as an id
app.get('/api/followups/performance-analytics', getPerformanceAnalytics);
app.get('/api/followups/deleted-recent', getDeletedRecentFollowups);
// Shims: keep these above "/:id" too
app.get('/api/followups/:inquiryId/recommendation', getNurturingRecommendationForInquiry);
app.get('/api/followups/:inquiryId/prediction', getFollowupOutcomePrediction);
app.get('/api/followups/:id(\\d+)', getFollowupById);
app.post('/api/followups', rbacGuard('followups'), createFollowup);
app.put('/api/followups/:id', rbacGuard('followups'), updateFollowup);
app.delete('/api/followups/:id', rbacGuard('followups'), deleteFollowup);
app.use('/api/followup-comments', followupCommentRoutes);
// Shims: ensure followup comments endpoints exist (some environments were returning 404)
app.get('/api/followup-comments/:followupId/comments', getComments);
app.post('/api/followup-comments/:followupId/comments', createComment);
app.put('/api/followup-comments/:followupId/comments/:commentId', editComment);
app.delete('/api/followup-comments/:followupId/comments/:commentId', deleteComment);

// Shims: ensure admission letter POST endpoints exist (some environments were returning 404)
app.post('/api/admission-letters/generate', rbacGuard('admission_letters'), downloadAdmissionLetter);
app.post('/api/admission-letters/bulk', rbacGuard('admission_letters'), bulkGenerateAdmissionLetters);
app.post('/api/admission-letters', rbacGuard('admission_letters'), generateAdmissionLetter);

app.use('/api/admission-letters', admissionLetterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/delete-requests', deleteRequestsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/marketing-settings', marketingSettingsRoutes);
// Shim: directly expose audit logs endpoints to avoid 404s in environments
// where the router mounting might be misconfigured. Controllers enforce role checks.
app.get('/api/audit-logs', listAuditLogs);
app.post('/api/audit-logs', createAuditLog);
app.delete('/api/audit-logs', clearAuditLogs);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/accountability', accountabilityRoutes);
app.use('/api/briefing', briefingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ask-ai', askAiRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/tenants', tenantAdminRoutes);
app.use('/api/esign', esignRoutes);
app.use('/api/email', emailMessagingRoutes);
app.use('/api', permissionsRoutes);

// Mount cpanel router BEFORE shims so it takes precedence.
app.use('/api/cpanel', cpanelRoutes);

// CPanel tenant action shims (kept as dead-code fallbacks; cpanel router above handles all these routes).
// These ensure suspend/unsuspend/delete always exist even when the mounted router
// is partially misconfigured in some environments.
const safeJson = (res: any, body: any, status?: number): void => {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
};

const requireSuperAdmin = (req: any, res: any, next: any) => {
  const role = String(req?.user?.role || '').toLowerCase();
  const tenantId = req?.user?.tenantId;
  if (role !== 'admin' || !(tenantId === null || tenantId === undefined)) {
    return safeJson(res, { error: 'Forbidden: super_admin only' }, 403);
  }
  return next();
};

const verifySuperAdminPassword = async (req: any, confirmPassword: any): Promise<boolean> => {
  const pwd = typeof confirmPassword === 'string' ? confirmPassword : '';
  if (!pwd) return false;

  try {
    const sessionUser = req.user;
    // Super admin account is represented as `role=admin` with `tenantId=null`.
    const admin = sessionUser?.email
      ? await prisma.user.findFirst({
          where: {
            email: { equals: String(sessionUser.email), mode: 'insensitive' },
            role: 'admin',
            tenantId: null,
          },
        })
      : await prisma.user.findFirst({ where: { role: 'admin', tenantId: null } });

    if (!admin) return false;
    return bcrypt.compareSync(pwd, admin.password) ||
      (!admin.password.startsWith('$2') && admin.password === pwd);
  } catch (e) {
    console.error('verifySuperAdminPassword error:', e);
    return false;
  }
};

app.post('/api/cpanel/tenants/:id/suspend', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const t = await prisma.tenant.update({ where: { id }, data: { isActive: false } });

    // Best-effort session invalidation (must not break the main operation).
    try {
      await prisma.$executeRaw`DELETE FROM sessions WHERE "tenantId" = ${id}`;
    } catch (e) {
      console.error('Suspend session invalidation failed:', e);
    }

    // Audit logging must never break the main operation.
    try {
      await auditLogger.custom(req, 'suspend_tenant', 'cpanel', { tenantId: id });
    } catch (e) {
      console.error('Audit suspend_tenant failed:', e);
    }
    return safeJson(res, t);
  } catch (e) {
    // If tenant is already suspended, treat as success.
    try {
      const t = await prisma.tenant.findUnique({ where: { id } });
      if (t && t.isActive === false) return safeJson(res, t);
    } catch (_) {
      // ignore re-check failures
    }
    return safeJson(res, { error: 'Failed to suspend tenant' }, 400);
  }
});

// CPanel create tenant shim (avoids client receiving 404 even when DB write succeeds).
app.post('/api/cpanel/tenants', requireSuperAdmin, async (req, res) => {
  const tenantName = typeof req.body?.name === 'string' ? req.body.name : undefined;
  try {
    const { name, subdomain, domain } = req.body || {};
    if (!name || typeof name !== 'string') return safeJson(res, { error: 'name is required' }, 400);

    const t = await prisma.tenant.create({
      data: {
        name: name,
        subdomain: typeof subdomain === 'string' ? subdomain : null,
        domain: typeof domain === 'string' ? domain : null,
        isActive: true,
      },
    });

    try {
      await auditLogger.custom(req, 'create_tenant', 'cpanel', { tenantId: t.id, name: t.name });
    } catch (e) {
      console.error('Audit create_tenant failed:', e);
    }

    return safeJson(res, { success: true, tenant: t }, 201);
  } catch (e) {
    console.error('Create tenant shim failed:', e);
    // If tenant got created but response is failing, we still want the client to get a usable result.
    // (This happens in some environments where downstream middleware misbehaves.)
    try {
      if (tenantName) {
        // Retry briefly in case the write committed but the follow-up read races.
        for (let attempt = 0; attempt < 20; attempt++) {
          const existing = await prisma.tenant.findUnique({ where: { name: tenantName } });
          if (existing) return safeJson(res, { success: true, tenant: existing }, 201);
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    } catch (_) {
      // ignore
    }

    return safeJson(res, { error: 'Failed to create tenant' }, 400);
  }
});

app.put('/api/cpanel/tenants/:id', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { name, subdomain, domain, isActive } = req.body || {};
    const t = await prisma.tenant.update({
      where: { id },
      data: {
        name: typeof name === 'string' ? name : undefined,
        subdomain: typeof subdomain === 'string' ? subdomain : undefined,
        domain: typeof domain === 'string' ? domain : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
    });

    try {
      await auditLogger.custom(req, 'update_tenant', 'cpanel', { tenantId: id, changes: { name, subdomain, domain, isActive } });
    } catch (e) {
      console.error('Audit update_tenant failed:', e);
    }
    return safeJson(res, t);
  } catch (e) {
    // If tenant already matches the requested isActive, treat as success.
    try {
      const requestedActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
      const t = await prisma.tenant.findUnique({ where: { id } });
      if (t && typeof requestedActive === 'boolean' && t.isActive === requestedActive) {
        return safeJson(res, t);
      }
    } catch (_) {
      // ignore re-check failures
    }
    return safeJson(res, { error: 'Failed to update tenant' }, 400);
  }
});

app.delete('/api/cpanel/tenants/:id', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const requestedHard = String(req.query.hard || '').toLowerCase() === 'true';
  try {
    const hard = requestedHard;

    if (!hard) {
      const t = await prisma.tenant.update({ where: { id }, data: { isActive: false } });
      try {
        await prisma.$executeRaw`DELETE FROM sessions WHERE "tenantId" = ${id}`;
      } catch (e) {
        console.error('Soft-delete session invalidation failed:', e);
      }
      try {
        await auditLogger.custom(req, 'delete_tenant_soft', 'cpanel', { tenantId: id });
      } catch (e) {
        console.error('Audit delete_tenant_soft failed:', e);
      }
      return safeJson(res, { success: true, tenant: t, mode: 'soft' });
    }

    // Hard delete: remove tenant and scoped data.
    await prisma.$transaction(async (tx) => {
      await tx.followupComment.deleteMany({ where: { followup: { tenantId: id } } });
      await tx.followup.deleteMany({ where: { tenantId: id } });
      await tx.inquiryDetail.deleteMany({ where: { inquiry: { tenantId: id } } });
      await tx.inquiry.deleteMany({ where: { tenantId: id } });
      await tx.task.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });

    try {
      await prisma.$executeRaw`DELETE FROM sessions WHERE "tenantId" = ${id}`;
    } catch (e) {
      console.error('Hard-delete session invalidation failed:', e);
    }

    try {
      await auditLogger.custom(req, 'delete_tenant_hard', 'cpanel', { tenantId: id });
    } catch (e) {
      console.error('Audit delete_tenant_hard failed:', e);
    }
    return safeJson(res, { success: true, mode: 'hard' });
  } catch (e) {
    // If deletion already happened, do not fail the request.
    // (Some environments throw after DB writes, which makes the UI show errors even though the DB is correct.)
    try {
      const stillThere = await prisma.tenant.findUnique({ where: { id } });
      if (!stillThere) {
        return safeJson(res, { success: true, mode: 'hard' });
      }

      if (!requestedHard && stillThere.isActive === false) {
        return safeJson(res, { success: true, tenant: stillThere, mode: 'soft' });
      }
    } catch (_) {
      // ignore re-check failures
    }

    return safeJson(res, { error: 'Failed to delete tenant' }, 400);
  }
});

// Bulk delete tenants shim.
// Body: { ids: number[], hard: boolean }
app.post('/api/cpanel/tenants/bulk-delete', requireSuperAdmin, async (req, res) => {
  try {
    const { ids, hard } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return safeJson(res, { error: 'ids[] is required' }, 400);
    }

    const tenantIds = Array.from(new Set(ids.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n))))
      .filter((n: number) => n > 0);

    if (tenantIds.length === 0) {
      return safeJson(res, { error: 'No valid tenant ids provided' }, 400);
    }

    const hardDelete = !!hard;

    if (!hardDelete) {
      await prisma.tenant.updateMany({ where: { id: { in: tenantIds } }, data: { isActive: false } });
      try {
        await prisma.session.deleteMany({ where: { tenantId: { in: tenantIds } } });
      } catch (e) {
        console.error('Bulk soft-delete session invalidation failed:', e);
      }
      try {
        await auditLogger.custom(req, 'delete_tenant_soft_bulk', 'cpanel', { tenantIds });
      } catch (e) {
        console.error('Audit delete_tenant_soft_bulk failed:', e);
      }
      return safeJson(res, { success: true, mode: 'soft', deletedCount: tenantIds.length });
    }

    await prisma.$transaction(async (tx) => {
      await tx.followupComment.deleteMany({
        where: { followup: { tenantId: { in: tenantIds } } },
      });
      await tx.followup.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.inquiryDetail.deleteMany({ where: { inquiry: { tenantId: { in: tenantIds } } } });
      await tx.inquiry.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.task.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.session.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    });

    try {
      await auditLogger.custom(req, 'delete_tenant_hard_bulk', 'cpanel', { tenantIds });
    } catch (e) {
      console.error('Audit delete_tenant_hard_bulk failed:', e);
    }

    return safeJson(res, { success: true, mode: 'hard', deletedCount: tenantIds.length });
  } catch (e) {
    console.error('Bulk delete tenants shim failed:', e);
    return safeJson(res, { error: 'Failed to delete tenants' }, 400);
  }
});

// CPanel user action shims.
// These ensure invite/approve/deactivate/reset endpoints always exist.
app.post('/api/cpanel/users/invite', requireSuperAdmin, async (req, res) => {
  const { email, role = 'admissions_officer', tenantId } = req.body || {};
  try {
    if (!email) return safeJson(res, { error: 'email required' }, 400);
    const tenant = tenantId ? await prisma.tenant.findUnique({ where: { id: Number(tenantId) } }) : null;
    if (tenantId && !tenant) return safeJson(res, { error: 'Tenant not found' }, 400);

    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: String(email), mode: 'insensitive' },
        tenantId: tenantId ? Number(tenantId) : null,
      },
    });
    if (existing) return safeJson(res, { error: 'User already exists for this tenant' }, 400);

    const allowedRoles = new Set(['admin', 'senior_staff', 'admissions_officer']);
    const safeRole = allowedRoles.has(String(role)) ? String(role) : 'admissions_officer';

    const tempPassword = crypto.randomBytes(6).toString('hex');
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    const u = await prisma.user.create({
      data: {
        email: String(email),
        role: safeRole as any,
        approved: true,
        tenantId: tenantId ? Number(tenantId) : null,
        password: hashedPassword,
      },
    });

    try {
      await auditLogger.custom(req, 'invite_user', 'cpanel', { userId: u.id, tenantId: u.tenantId, role: u.role });
    } catch (e) {
      console.error('Audit invite_user failed:', e);
    }

    return safeJson(res, {
      success: true,
      user: {
        id: u.id,
        email: u.email,
        role: u.role,
        tenantId: u.tenantId,
        approved: u.approved,
        createdAt: u.createdAt,
      },
      initialPassword: tempPassword,
    }, 201);
  } catch (e) {
    console.error('Invite user shim error:', e);
    return safeJson(res, { error: 'Failed to invite user' }, 400);
  }
});

app.put('/api/cpanel/users/:id/role', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body || {};
  try {
    if (!role) return safeJson(res, { error: 'role is required' }, 400);
    const u = await prisma.user.update({ where: { id }, data: { role: role as any } });
    try {
      await auditLogger.custom(req, 'update_user_role', 'cpanel', { userId: id, role });
    } catch (e) {}
    return safeJson(res, u);
  } catch (e) {
    return safeJson(res, { error: 'Failed to update user role' }, 400);
  }
});

app.put('/api/cpanel/users/:id/approve', requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const u = await prisma.user.update({ where: { id }, data: { approved: true } });
    try {
      await auditLogger.custom(req, 'approve_user', 'cpanel', { userId: id });
    } catch (e) {}
    return safeJson(res, u);
  } catch (e) {
    return safeJson(res, { error: 'Failed to approve user' }, 400);
  }
});

app.put('/api/cpanel/users/:id/deactivate', requireSuperAdmin, async (req, res, next) => {
  const rawId = req.params.id;
  const id = Number(rawId);
  // Allow later bulk routes like /users/bulk/deactivate to match.
  if (!Number.isFinite(id)) return next();

  const { confirmPassword } = req.body || {};
  if (!confirmPassword) return safeJson(res, { error: 'Super admin password required' }, 403);
  const ok = await verifySuperAdminPassword(req, confirmPassword);
  if (!ok) return safeJson(res, { error: 'Invalid super admin password' }, 403);

  try {
    // Never allow deleting any super admin account (role=admin).
    const protectedUser = await prisma.user.findFirst({ where: { id, role: 'admin', tenantId: null } });
    if (protectedUser) return safeJson(res, { error: 'Cannot delete super admin user' }, 403);

    const u = await prisma.user.update({ where: { id }, data: { approved: false } });
    try {
      await auditLogger.custom(req, 'deactivate_user', 'cpanel', { userId: id });
    } catch (e) {}
    return safeJson(res, { success: true, user: u });
  } catch (e) {
    return safeJson(res, { error: 'Failed to deactivate user' }, 400);
  }
});

app.put('/api/cpanel/users/:id/password', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body || {};
  try {
    const userId = Number(id);
    if (!password) return safeJson(res, { error: 'Password is required' }, 400);
    if (String(password).length < 6) return safeJson(res, { error: 'Password must be at least 6 characters' }, 400);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return safeJson(res, { error: 'User not found' }, 404);
    const hashedPassword = bcrypt.hashSync(String(password), 10);
    const updated = await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    try {
      await auditLogger.custom(req, 'reset_user_password', 'cpanel', { userId: userId, tenantId: updated.tenantId, userEmail: updated.email });
    } catch (e) {}
    return safeJson(res, {
      success: true,
      message: 'Password updated successfully',
      user: { id: updated.id, email: updated.email, role: updated.role },
    });
  } catch (e) {
    return safeJson(res, { error: 'Failed to reset password' }, 400);
  }
});

// Direct handlers for GET users/tenants (ensure consistent behavior with invite)
app.get('/api/cpanel/users', requireSuperAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, approved: true, tenantId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return safeJson(res, { users });
  } catch (e) {
    console.error('GET /api/cpanel/users error:', e);
    return safeJson(res, { error: 'Failed to list users' }, 500);
  }
});

app.get('/api/cpanel/tenants', requireSuperAdmin, async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, subdomain: true, domain: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return safeJson(res, { tenants });
  } catch (e) {
    console.error('GET /api/cpanel/tenants error:', e);
    return safeJson(res, { error: 'Failed to list tenants' }, 500);
  }
});

// Bulk deactivate users (acts like "bulk delete" in cPanel)
// Body: { ids: number[] }
app.put('/api/cpanel/users/bulk/deactivate', requireSuperAdmin, async (req, res) => {
  const { ids } = req.body || {};
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return safeJson(res, { error: 'ids[] is required' }, 400);
    }

    const userIds = Array.from(new Set(ids.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)));
    if (userIds.length === 0) {
      return safeJson(res, { error: 'No valid user ids provided' }, 400);
    }

    const { confirmPassword } = req.body || {};
    if (!confirmPassword) return safeJson(res, { error: 'Super admin password required' }, 403);
    const ok = await verifySuperAdminPassword(req, confirmPassword);
    if (!ok) return safeJson(res, { error: 'Invalid super admin password' }, 403);

    const protectedCount = await prisma.user.count({
      where: { id: { in: userIds }, role: 'admin', tenantId: null },
    });
    if (protectedCount > 0) return safeJson(res, { error: 'Cannot delete super admin user(s)' }, 403);

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { approved: false },
    });

    try {
      await auditLogger.custom(req, 'bulk_deactivate_users', 'cpanel', { userIds });
    } catch (e) {}

    return safeJson(res, { success: true, deactivatedCount: userIds.length });
  } catch (e) {
    console.error('Bulk deactivate users failed:', e);
    return safeJson(res, { error: 'Failed to bulk deactivate users' }, 400);
  }
});

// cpanel router already mounted above at line ~714.

// Shim: /api/tenants/me for sidebar/branding (when tenant router is not wired in some builds)
app.get('/api/tenants/me', async (req, res): Promise<void> => {
  try {
    // Prefer explicit tenant identifier (cookie/header) so we can detect suspended tenants.
    const cookie = String(req.headers['cookie'] || '');
    const cookieMatch = /(?:^|; )tenant=([^;]+)/.exec(cookie);
    const cookieTenant = cookieMatch ? decodeURIComponent(cookieMatch[1] as string) : '';
    const hdrTenant = String(req.headers['x-tenant'] || '').trim();

    const tenantIdRaw = hdrTenant || cookieTenant;
    if (tenantIdRaw) {
      const tenantIdNum = Number.parseInt(tenantIdRaw, 10);
      const fullById = Number.isFinite(tenantIdNum) && !Number.isNaN(tenantIdNum)
        ? await prisma.tenant.findUnique({ where: { id: tenantIdNum } })
        : null;
      if (fullById) {
        res.json({ success: true, tenant: fullById });
        return;
      }

      // Slug-like identifiers (subdomain/name). We do NOT require isActive here.
      const fullBySlug = await prisma.tenant.findFirst({
        where: { OR: [{ subdomain: tenantIdRaw }, { name: tenantIdRaw }] },
      });
      if (fullBySlug) {
        res.json({ success: true, tenant: fullBySlug });
        return;
      }
    }

    // Next, use resolved tenant from tenantMiddleware (if present).
    const tenant: any = (req as any).tenant;
    if (tenant && tenant.id) {
      const full = await prisma.tenant.findUnique({ where: { id: tenant.id } });
      if (full) {
        res.json({ success: true, tenant: full });
        return;
      }
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }

    // Final fallback: any active tenant (pre-login / no cookie context).
    const t = await prisma.tenant.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    if (!t) {
      res.status(404).json({ success: false, message: 'Tenant not found' });
      return;
    }
    res.json({ success: true, tenant: t });
    return;
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to load tenant' });
    }
    return;
  }
});

// In-app notification feed (no auth for simplicity — reads per email via query)
app.get('/api/notifications/feed', async (req, res) => {
  const all = getInAppNotifications();
  const email = (req.query.email as string || '').toLowerCase();
  const filtered = email ? all.filter(n => n.email.toLowerCase() === email) : all;
  res.json({ success: true, notifications: filtered });
});
app.delete('/api/notifications/feed', (_req, res) => {
  clearInAppNotifications();
  res.json({ success: true });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`EduSmart CRM Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`CORS enabled for: ${corsOrigins.join(', ')}`);
  }
  await ensureLetterCountersTable().catch(e => console.warn('[startup] letter counters table:', e.message));
  startScheduler();
});
