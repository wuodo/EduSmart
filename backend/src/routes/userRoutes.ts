import express from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';
import { auditLogger } from '../utils/auditLogger';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail } from '../utils/email';

const router = express.Router();
function safeJson(res: express.Response, body: any, status?: number) {
  if (res.headersSent) return;
  if (status) res.status(status);
  res.json(body);
}


const ALLOWED_ROLES = ['admin', 'senior_staff', 'admissions_officer'];

function normalizeTenantCode(value: unknown): string {
  return String(value || '').trim();
}

async function resolveTenantByCode(tenantCode: string) {
  const code = normalizeTenantCode(tenantCode);
  if (!code) return null;
  const asId = Number.parseInt(code, 10);
  if (!Number.isNaN(asId) && /^\d+$/.test(code)) {
    const byId = await prisma.tenant.findFirst({ where: { id: asId } });
    if (byId) return byId;
  }
  return prisma.tenant.findFirst({
    where: {
      OR: [
        { subdomain: { equals: code, mode: 'insensitive' } },
        { name: { equals: code, mode: 'insensitive' } },
        { domain: { equals: code, mode: 'insensitive' } },
      ],
    },
  });
}

// Current user profile (scoped by tenant)
router.get('/me', async (req, res) => {
  try {
    const sessionUser: any = (req as any).user;
    const email = sessionUser?.email || '';
    if (!email) return safeJson(res, { error: 'Not authenticated' }, 401);
    const user = await prisma.user.findFirst({
      where: { 
        email: { equals: email, mode: 'insensitive' },
        tenantId: (req as any).tenant?.id
      },
      select: { id: true, email: true, role: true, approved: true, name: true, gender: true, phone: true, createdAt: true, updatedAt: true }
    });
    if (!user) return safeJson(res, { error: 'User not found' }, 404);
    return safeJson(res, user);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { error: 'Error fetching profile' }, 500);
  }
});

router.put('/me', async (req, res) => {
  try {
    const sessionUser: any = (req as any).user;
    const email = sessionUser?.email || '';
    if (!email) return safeJson(res, { error: 'Not authenticated' }, 401);
    const { name, gender, phone, password } = req.body || {};
    const tenantId = (req as any).tenant?.id;

    const updateData: any = { name: name ?? undefined, gender: gender ?? undefined, phone: phone ?? undefined };
    if (password) {
      updateData.password = bcrypt.hashSync(password, 10);
    }

    const result = await prisma.user.updateMany({
      where: { 
        tenantId,
        email: { equals: email, mode: 'insensitive' }
      },
      data: updateData
    });

    if (result.count === 0) return safeJson(res, { error: 'User not found' }, 404);

    const updated = await prisma.user.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, role: true, approved: true, name: true, gender: true, phone: true, createdAt: true, updatedAt: true }
    });
    return safeJson(res, updated);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { error: 'Error updating profile' }, 400);
  }
});

// Get all users (scoped by tenant)
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: (req as any).tenant?.id },
      select: {
        id: true,
        email: true,
        role: true,
        approved: true,
        name: true,
        gender: true,
        phone: true,
        createdAt: true
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    return safeJson(res, users);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error fetching users', error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Create new user (scoped by tenant)
router.post('/', async (req, res) => {
  try {
    let { email, password, role, name, gender, phone } = req.body;
    if (!email || !password) return safeJson(res, { message: 'Email and password are required' }, 400);
    if (!role || !ALLOWED_ROLES.includes(role)) role = 'admissions_officer';
    const tenantId = (req as any).tenant?.id;

    // Ensure unique per tenant
    const exists = await prisma.user.findFirst({ where: { tenantId, email: { equals: email, mode: 'insensitive' } } });
    if (exists) return safeJson(res, { message: 'User already exists in this tenant' }, 409);

    const user = await prisma.user.create({
      data: {
        email,
        password: bcrypt.hashSync(password, 10), // Hash the password
        role,
        approved: true,
        name: name || null,
        gender: gender || null,
        phone: phone || null,
        tenantId
      }
    });
    
    // Log user creation
    try {
      await auditLogger.createUser(req, { email, role, name, gender, phone, tenantId });
    } catch (e) {
      // Do not fail user creation if audit logging fails
    }
    
    return safeJson(res, user, 201);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error creating user', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Update user (scoped by tenant)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, name, gender, phone } = req.body || {};
    const tenantId = (req as any).tenant?.id;
    
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    if (!existingUser || existingUser.tenantId !== tenantId) {
      return safeJson(res, { message: 'User not found or access denied' }, 403);
    }

    const updateData: any = {
      name: name ?? undefined,
      gender: gender ?? undefined,
      phone: phone ?? undefined,
    };
    if (password) {
      updateData.password = bcrypt.hashSync(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    await auditLogger.updateUser(req, id, { 
      previousData: existingUser, 
      newData: { name, gender, phone, password: password ? '[REDACTED]' : undefined },
      tenantId 
    });
    
    return safeJson(res, user);
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error updating user', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Delete user (scoped by tenant)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenant?.id;
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    if (!user || user.tenantId !== tenantId) {
      return safeJson(res, { message: 'User not found or access denied' }, 403);
    }
    
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    
    await auditLogger.deleteUser(req, id);
    
    return safeJson(res, { message: 'User deleted successfully' });
  } catch (error) {
    if (res.headersSent) return;
    return safeJson(res, { message: 'Error deleting user', error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

// Register a new user (admin, staff)
router.post('/register', async (req, res) => {
  try {
    let { email, password, role, name, gender, phone } = req.body;
    const tenantId = (req as any).tenant?.id;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!role || !ALLOWED_ROLES.includes(role)) role = 'admissions_officer';
    // Check if user already exists in this tenant
    const existing = await prisma.user.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
        role: role
      }
    });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const user = await prisma.user.create({
      data: {
        email,
        password: bcrypt.hashSync(password, 10), // Hash the password
        role,
        approved: true,
        name: name || null,
        gender: gender || null,
        phone: phone || null,
        tenantId
      }
    });
    return res.status(201).json({ success: true, user: { email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Registration error', details: error instanceof Error ? error.message : String(error) });
  }
});

// Logout endpoint: delete session
router.post('/logout', async (req, res) => {
  try {
    const cookie = req.headers['cookie'] || '';
    const match = /(?:^|; )session=([^;]+)/.exec(cookie);
    const token = match ? decodeURIComponent(match[1]) : '';
    
    // Get user email before deleting session
    let userEmail = null;
    if (token) {
      const session = await prisma.$queryRaw`
        SELECT u.email as user_email
        FROM sessions s
        LEFT JOIN users u ON s."userId" = u.id
        WHERE s.token = ${token}
      ` as any[];
      if (session.length > 0) {
        userEmail = session[0].user_email;
      }
      await prisma.$executeRaw`DELETE FROM sessions WHERE token = ${token}`;
    }
    
    res.clearCookie('session', { path: '/' });
    res.clearCookie('tenantOk', { path: '/' });
    
    // Log logout
    if (userEmail) {
      await auditLogger.logout(req, userEmail);
    }
    
    return safeJson(res, { success: true });
  } catch (e) {
    return safeJson(res, { error: 'Logout error' }, 500);
  }
});

// List active sessions for current user
router.get('/sessions', async (req, res) => {
  try {
    const me: any = (req as any).user;
    if (!me?.id) return safeJson(res, { error: 'Not authenticated' }, 401);
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, token, "expiresAt", "lastUsedAt", "createdAt"
      FROM sessions
      WHERE "userId" = ${me.id} AND "expiresAt" > NOW()
      ORDER BY "lastUsedAt" DESC NULLS LAST, "createdAt" DESC
    `;
    const currentToken = ((): string => {
      const cookie = String(req.headers['cookie'] || '');
      const m = /(?:^|; )session=([^;]+)/.exec(cookie);
      return m ? decodeURIComponent(m[1] || '') : '';
    })();
    return safeJson(res, {
      sessions: rows.map((s: any) => ({
        id: s.id,
        current: s.token === currentToken,
        expiresAt: s.expiresAt,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
      })),
    });
  } catch {
    return safeJson(res, { error: 'Failed to list sessions' }, 500);
  }
});

// Revoke one session or all other sessions for current user
router.delete('/sessions/:id', async (req, res) => {
  try {
    const me: any = (req as any).user;
    if (!me?.id) return safeJson(res, { error: 'Not authenticated' }, 401);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return safeJson(res, { error: 'Invalid session id' }, 400);
    await prisma.$executeRaw`DELETE FROM sessions WHERE id = ${id} AND "userId" = ${me.id}`;
    return safeJson(res, { success: true });
  } catch {
    return safeJson(res, { error: 'Failed to revoke session' }, 500);
  }
});

// --- Password reset helpers ---
function createResetToken(email: string): string {
  const secret = process.env.RESET_SECRET;
  if (!secret) throw new Error('RESET_SECRET is not configured');
  const expires = Date.now() + 1000 * 60 * 30; // 30 minutes
  const payload = `${email}.${expires}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${hmac}`).toString('base64url');
}

function verifyResetToken(token: string): { email: string } | null {
  try {
    const secret = process.env.RESET_SECRET;
    if (!secret) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [email, expStr, sig] = decoded.split('.');
    const payload = `${email}.${expStr}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expected !== sig) return null;
    const expires = parseInt(expStr, 10);
    if (Date.now() > expires) return null;
    return { email };
  } catch {
    return null;
  }
}

// Request password reset - token is never returned in response.
// Accepts tenant_code for pre-login users; otherwise uses req.tenant.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, tenant_code } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email is required' });
    let tenantId = (req as any).tenant?.id;
    if (!tenantId && tenant_code) {
      const tenant = await resolveTenantByCode(String(tenant_code).trim());
      tenantId = tenant?.id ?? undefined;
    }
    const user = await prisma.user.findFirst({ where: { email: { equals: String(email).trim(), mode: 'insensitive' }, tenantId: tenantId ?? null } });
    if (!user) return res.status(200).json({ success: true }); // do not reveal user existence
    const token = createResetToken(user.email);
    const tenantCode = tenant_code || (req as any).tenant?.subdomain || (req as any).tenant?.name || String(tenantId ?? '');
    const baseUrl = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenantCode)}`;
    const sent = await sendPasswordResetEmail(user.email, resetUrl);
    if (!sent && process.env.NODE_ENV === 'development') {
      console.log('[DEV] Password reset link:', resetUrl);
    }
    return res.json({ success: true });
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Error creating reset token' });
  }
});

// Reset password (requires tenant: x-tenant header or tenant_code in body)
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, tenant_code } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Missing token or password' });
    const verified = verifyResetToken(token);
    if (!verified) return res.status(400).json({ error: 'Invalid or expired token' });
    let tenantId = (req as any).tenant?.id;
    if (!tenantId && tenant_code) {
      const tenant = await resolveTenantByCode(String(tenant_code).trim());
      tenantId = tenant?.id;
    }
    if (!tenantId) return res.status(400).json({ error: 'Tenant context required. Include Institution ID.' });

    const hashedPw = bcrypt.hashSync(password, 10);
    const result = await prisma.user.updateMany({ where: { tenantId, email: { equals: verified.email, mode: 'insensitive' } }, data: { password: hashedPw } });
    if (result.count === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, email: verified.email });
  } catch (error) {
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Error resetting password' });
  }
});

export { router as userRoutes }; 