import express from 'express';
import prisma from '../lib/prisma';
import { auditLogger } from '../utils/auditLogger';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { loadCpanelFromDb as loadCfg, saveCpanelToDb as saveCfg } from '../utils/cpanelStore';
import fs from 'fs';
import path from 'path';
import { getArchivedRecord } from '../utils/deletionArchive';

const router = express.Router();

async function getRole(req: any): Promise<string> {
	const role = String(req?.user?.role || '').toLowerCase();
	const tenantId = req?.user?.tenantId;
	if (role === 'super_admin') return 'super_admin';
	if (role === 'admin' && (tenantId === null || tenantId === undefined)) return 'super_admin';
	// Fallback: resolve from session cookie when req.user was not populated.
	try {
		const cookie = String(req?.headers?.cookie || '');
		const m = /(?:^|;\s*)session=([^;]+)/.exec(cookie);
		const token = m ? decodeURIComponent(m[1]) : '';
		if (token) {
			const rows: Array<{ role: string; tenantId: number | null }> = await prisma.$queryRaw`
				SELECT u.role as role, u."tenantId" as "tenantId"
				FROM sessions s
				JOIN users u ON u.id = s."userId"
				WHERE s.token = ${token} AND s."expiresAt" > NOW()
				LIMIT 1
			`;
			const r = rows?.[0];
			const dbRole = String(r?.role || '').toLowerCase();
			const dbTenantId = (r as any)?.tenantId;
			if (dbRole === 'admin' && (dbTenantId === null || dbTenantId === undefined)) return 'super_admin';
		}
	} catch {}
	return '';
}

function safeJson(res: express.Response, body: any, status?: number) {
	if (res.headersSent) return;
	if (status) res.status(status);
	res.json(body);
}

// Super admin login (exempt from guard)
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body || {};
		if (!email || !password) return safeJson(res, { error: 'email and password required' }, 400);
		
		// Find super admin user
		const user = await prisma.user.findFirst({
			where: {
				email: { equals: email, mode: 'insensitive' },
				role: 'admin',
				tenantId: null
			}
		});
		
		const passwordOk = user
			? (bcrypt.compareSync(password, user.password) ||
			   (!user.password.startsWith('$2') && user.password === password))
			: false;

		if (!user || !passwordOk) {
			await auditLogger.login(req, email, false, { role: 'admin', tenantId: null });
			return safeJson(res, { error: 'Invalid credentials' }, 401);
		}

		// Re-hash plain-text passwords on first successful login
		if (!user.password.startsWith('$2') && user.password === password) {
			const hashed = bcrypt.hashSync(password, 10);
			await prisma.user.update({ where: { id: user.id }, data: { password: hashed } }).catch(() => {});
		}
		
		// Create session
		const token = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
		// Use parameterized Prisma raw execution (avoids $1 placeholder issues)
		await prisma.$executeRaw`
			INSERT INTO sessions (token, "userId", "tenantId", "expiresAt", "lastUsedAt")
			VALUES (${token}, ${user.id}, ${null}, ${expiresAt}, NOW())
		`;
		
		// Set cookie before audit log (audit log must not trigger any response)
		if (!res.headersSent) {
			res.cookie('session', token, {
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				expires: expiresAt,
				path: '/',
			});
		}
		
		await auditLogger.login(req, email, true, { role: user.role, tenantId: null });
		
		return safeJson(res, { success: true, role: 'super_admin', name: user.name || email });
	} catch (e) {
		console.error('Super admin login error:', e);
		return safeJson(res, { error: 'Login failed' }, 500);
	}
});

// Guard: super_admin only (excludes login endpoint)
router.use(async (req, res, next) => {
	// Skip guard for login endpoint
	if (req.path === '/login' && req.method === 'POST') {
		console.log('Skipping guard for login endpoint');
		return next();
	}
	
	console.log('Checking role for path:', req.path, 'method:', req.method);
	const role = await getRole(req);
	console.log('User role:', role);
	if (role !== 'super_admin') {
		return safeJson(res, { error: 'Forbidden: super_admin only' }, 403);
	}
	next();
});

// --- Tenants ---
router.get('/tenants', async (_req, res) => {
	try {
		const tenants = await prisma.tenant.findMany({
			select: { id: true, name: true, subdomain: true, domain: true, isActive: true, createdAt: true, updatedAt: true },
			orderBy: { createdAt: 'desc' },
			take: 200,
		});
		return safeJson(res, { tenants });
	} catch (e) {
		return safeJson(res, { error: 'Failed to list tenants' }, 500);
	}
});

router.post('/tenants', async (req, res) => {
	try {
		const { name, subdomain, domain } = req.body || {};
		if (!name) return safeJson(res, { error: 'name is required' }, 400);
		const t = await prisma.tenant.create({ data: { name, subdomain: subdomain || null, domain: domain || null } });
			// Audit logging must not break the actual creation request.
			try {
				await auditLogger.custom(req, 'create_tenant', 'cpanel', { tenantId: t.id, name: t.name });
			} catch (e) {
				console.error('Audit create_tenant failed:', e);
			}
		return safeJson(res, { success: true, tenant: t }, 201);
	} catch (e: any) {
		console.error('[create_tenant] error:', e?.message || e);
		// Unique constraint violation
		if (e?.code === 'P2002') {
			const field = e?.meta?.target?.[0] || 'field';
			return safeJson(res, { error: `A tenant with that ${field} already exists` }, 409);
		}
		return safeJson(res, { error: 'Failed to create tenant', detail: e?.message }, 400);
	}
});

router.put('/tenants/:id', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { name, subdomain, domain, isActive } = req.body || {};
		const t = await prisma.tenant.update({ where: { id }, data: {
			name: typeof name === 'string' ? name : undefined,
			subdomain: typeof subdomain === 'string' ? subdomain : undefined,
			domain: typeof domain === 'string' ? domain : undefined,
			isActive: typeof isActive === 'boolean' ? isActive : undefined,
		}});
		await auditLogger.custom(req, 'update_tenant', 'cpanel', { tenantId: id, changes: { name, subdomain, domain, isActive } });
		return safeJson(res, t);
	} catch (e) {
		return safeJson(res, { error: 'Failed to update tenant' }, 400);
	}
});

router.post('/tenants/:id/suspend', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const t = await prisma.tenant.update({ where: { id }, data: { isActive: false } });
		// Immediately invalidate all active sessions for this tenant
		await prisma.$executeRaw`DELETE FROM sessions WHERE "tenantId" = ${id}`;
		await auditLogger.custom(req, 'suspend_tenant', 'cpanel', { tenantId: id });
		return safeJson(res, t);
	} catch (e) {
		return safeJson(res, { error: 'Failed to suspend tenant' }, 400);
	}
});

// Delete tenant (soft by default; hard delete with ?hard=true)
router.delete('/tenants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    if (!hard) {
      const t = await prisma.tenant.update({ where: { id }, data: { isActive: false } });
      await auditLogger.custom(req, 'delete_tenant_soft', 'cpanel', { tenantId: id });
      return safeJson(res, { success: true, tenant: t, mode: 'soft' });
    }

    // Hard delete: remove tenant and scoped data
    await prisma.$transaction(async (tx) => {
      await tx.followupComment.deleteMany({ where: { followup: { tenantId: id } } });
      await tx.followup.deleteMany({ where: { tenantId: id } });
      await tx.inquiryDetail.deleteMany({ where: { inquiry: { tenantId: id } } });
      await tx.inquiry.deleteMany({ where: { tenantId: id } });
      await tx.task.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });
      // deleteRequest likely not tenant-scoped here; skip
      await tx.tenant.delete({ where: { id } });
    });
    await auditLogger.custom(req, 'delete_tenant_hard', 'cpanel', { tenantId: id });
    return safeJson(res, { success: true, mode: 'hard' });
  } catch (e) {
    return safeJson(res, { error: 'Failed to delete tenant' }, 400);
  }
});

// Bulk delete tenants (soft or hard)
// Body: { ids: number[], hard: boolean }
router.post('/tenants/bulk-delete', async (req, res) => {
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
      // Invalidate sessions (best-effort; must not break tenant deletion)
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
      // Delete scoped tenant data (hard delete)
      await tx.followupComment.deleteMany({
        where: { followup: { tenantId: { in: tenantIds } } },
      });
      await tx.followup.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.inquiryDetail.deleteMany({
        where: { inquiry: { tenantId: { in: tenantIds } } },
      });
      await tx.inquiry.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.task.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
      // Sessions invalidation
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
    console.error('Bulk delete tenants failed:', e);
    return safeJson(res, { error: 'Failed to delete tenants' }, 400);
  }
});

// --- Restore Requests (super admin) ---
router.get('/restore-requests', async (_req, res) => {
  try {
    const requests = await prisma.deleteRequest.findMany({
      where: { module: 'restore_request', status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return safeJson(res, { requests });
  } catch (e) {
    return safeJson(res, { error: 'Failed to list restore requests' }, 500);
  }
});

router.post('/restore-requests/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!request || request.module !== 'restore_request' || request.status !== 'pending') {
      return safeJson(res, { error: 'Restore request not found or already processed' }, 404);
    }
    const archive = getArchivedRecord(String(request.itemId));
    if (!archive) return safeJson(res, { error: 'Archived data not found' }, 404);

    if (archive.type === 'inquiry') {
      const payload = archive.payload || {};
      const { detail, followups, ...base } = payload;
      const createdInquiry = await prisma.inquiry.create({
        data: {
          fullName: String(base.fullName || ''),
          email: String(base.email || ''),
          phone: String(base.phone || ''),
          message: base.message || null,
          gender: base.gender || null,
          programOfInterest: base.programOfInterest || null,
          intakePeriod: base.intakePeriod || null,
          studyMode: base.studyMode || null,
          source: base.source || null,
          agentOrReferralName: base.agentOrReferralName || null,
          preferredContactMethod: base.preferredContactMethod || null,
          bestTimeToContact: base.bestTimeToContact || null,
          leadTags: base.leadTags ?? null,
          notes: base.notes || null,
          status: base.status || 'Pending',
          assignedTo: base.assignedTo || null,
          documents: base.documents ?? null,
          createdBy: base.createdBy || null,
          letterStatus: base.letterStatus || null,
          letterReferenceNumber: base.letterReferenceNumber || null,
          letterSerialNumber: base.letterSerialNumber || null,
          paymentStatus: base.paymentStatus || null,
          paymentCode: base.paymentCode || null,
          paymentDate: base.paymentDate ? new Date(base.paymentDate) : null,
          tenantId: archive.tenantId,
          score: typeof base.score === 'number' ? base.score : 0,
          firstResponseAt: base.firstResponseAt ? new Date(base.firstResponseAt) : null,
          nextFollowupAt: base.nextFollowupAt ? new Date(base.nextFollowupAt) : null,
          sentiment: base.sentiment || null,
          dropoffStage: base.dropoffStage || null,
          recommendation: base.recommendation || null,
          lastReminderSent: base.lastReminderSent ? new Date(base.lastReminderSent) : null,
          reminderStatus: base.reminderStatus || null,
          lastReminderResponse: base.lastReminderResponse || null,
          engagementSentiment: base.engagementSentiment || null,
          kcseGrade: base.kcseGrade || 'Unknown',
          ...(detail && detail.county && detail.town ? {
            detail: {
              create: {
                county: String(detail.county),
                town: String(detail.town),
                idOrPassport: detail.idOrPassport || null,
              },
            },
          } : {}),
        },
      });

      if (Array.isArray(followups) && followups.length > 0) {
        for (const f of followups) {
          const createdFollowup = await prisma.followup.create({
            data: {
              inquiryId: createdInquiry.id,
              inquiryName: String(f.inquiryName || createdInquiry.fullName || ''),
              type: String(f.type || 'call'),
              scheduledFor: f.scheduledFor ? new Date(f.scheduledFor) : new Date(),
              status: String(f.status || 'pending'),
              assignedTo: f.assignedTo || null,
              notes: f.notes || null,
              completedAt: f.completedAt ? new Date(f.completedAt) : null,
              createdBy: f.createdBy || null,
              tenantId: archive.tenantId,
              paymentStatus: f.paymentStatus || null,
              paymentCode: f.paymentCode || null,
              paymentDate: f.paymentDate ? new Date(f.paymentDate) : null,
            },
          });
          if (Array.isArray(f.comments) && f.comments.length > 0) {
            for (const c of f.comments) {
              await prisma.followupComment.create({
                data: {
                  followupId: createdFollowup.id,
                  comment: String(c.comment || ''),
                  createdBy: c.createdBy || null,
                },
              });
            }
          }
        }
      }
    } else if (archive.type === 'followup') {
      const f = archive.payload || {};
      let targetInquiryId = Number(f.inquiryId);
      const existingInquiry = Number.isFinite(targetInquiryId)
        ? await prisma.inquiry.findFirst({ where: { id: targetInquiryId, tenantId: archive.tenantId ?? null }, select: { id: true } })
        : null;
      if (!existingInquiry) {
        // Recreate a minimal inquiry so follow-up restoration can succeed even when the original inquiry was deleted.
        const fallbackInquiry = await prisma.inquiry.create({
          data: {
            fullName: String(f.inquiryName || 'Restored Inquiry'),
            email: '',
            phone: '0000000000',
            tenantId: archive.tenantId,
            createdBy: f.createdBy || null,
            assignedTo: f.assignedTo || null,
            status: 'Pending',
            kcseGrade: 'Unknown',
          },
        });
        targetInquiryId = fallbackInquiry.id;
      }
      const createdFollowup = await prisma.followup.create({
        data: {
          inquiryId: targetInquiryId,
          inquiryName: String(f.inquiryName || ''),
          type: String(f.type || 'call'),
          scheduledFor: f.scheduledFor ? new Date(f.scheduledFor) : new Date(),
          status: String(f.status || 'pending'),
          assignedTo: f.assignedTo || null,
          notes: f.notes || null,
          completedAt: f.completedAt ? new Date(f.completedAt) : null,
          createdBy: f.createdBy || null,
          tenantId: archive.tenantId,
          paymentStatus: f.paymentStatus || null,
          paymentCode: f.paymentCode || null,
          paymentDate: f.paymentDate ? new Date(f.paymentDate) : null,
        },
      });
      if (Array.isArray(f.comments) && f.comments.length > 0) {
        for (const c of f.comments) {
          await prisma.followupComment.create({
            data: {
              followupId: createdFollowup.id,
              comment: String(c.comment || ''),
              createdBy: c.createdBy || null,
            },
          });
        }
      }
    } else {
      return safeJson(res, { error: 'Unsupported archive type' }, 400);
    }

    await prisma.deleteRequest.update({ where: { id }, data: { status: 'approved' } });
    await auditLogger.custom(req, 'restore_request_approved', 'restore', { requestId: id, archiveId: request.itemId, archiveType: archive.type });
    return safeJson(res, { success: true });
  } catch (e: any) {
    return safeJson(res, { error: e?.message || 'Failed to restore archived data' }, 500);
  }
});

// Upload/update tenant logo via base64
router.post('/tenants/:id/logo', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { imageBase64 } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') return safeJson(res, { error: 'imageBase64 required' }, 400);

    // Extract base64 payload
    const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(imageBase64);
    const mime = m ? m[1].toLowerCase() : 'png';
    const b64 = m ? m[2] : imageBase64;
    const buffer = Buffer.from(b64, 'base64');

    const logosDir = path.join(__dirname, '..', 'assets', 'logos');
    fs.mkdirSync(logosDir, { recursive: true });
    const filename = `tenant-${id}.${mime === 'jpg' ? 'jpg' : mime}`;
    const filePath = path.join(logosDir, filename);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/assets/logos/${filename}?v=${Date.now()}`;
    const t = await prisma.tenant.update({ where: { id }, data: { logo: publicUrl } });
    await auditLogger.custom(req, 'update_tenant_logo', 'cpanel', { tenantId: id });
    return safeJson(res, { success: true, logo: publicUrl, tenant: { id: t.id, name: t.name } });
  } catch (e) {
    return safeJson(res, { error: 'Failed to upload logo' }, 400);
  }
});

// --- Global Users ---
router.get('/users', async (_req, res) => {
	try {
		const users = await prisma.user.findMany({
			select: { id: true, email: true, role: true, approved: true, tenantId: true, createdAt: true },
			orderBy: { createdAt: 'desc' },
			take: 500,
		});
		return safeJson(res, { users });
	} catch (e) {
		return safeJson(res, { error: 'Failed to list users' }, 500);
	}
});

router.put('/users/:id/role', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { role } = req.body || {};
		if (!role) return safeJson(res, { error: 'role is required' }, 400);
		const u = await prisma.user.update({ where: { id }, data: { role: role as any } });
		await auditLogger.custom(req, 'update_user_role', 'cpanel', { userId: id, role });
		return safeJson(res, u);
	} catch (e) {
		return safeJson(res, { error: 'Failed to update user role' }, 400);
	}
});

router.put('/users/:id/approve', async (req, res) => {
	try {
		const id = Number(req.params.id);
		const u = await prisma.user.update({ where: { id }, data: { approved: true } });
		await auditLogger.custom(req, 'approve_user', 'cpanel', { userId: id });
		return safeJson(res, u);
	} catch (e) {
		return safeJson(res, { error: 'Failed to approve user' }, 400);
	}
});

// Invite user (creates user with approved=true and initial password)
router.post('/users/invite', async (req, res) => {
  try {
    const { email, role = 'admissions_officer', tenantId } = req.body || {};
    if (!email) return safeJson(res, { error: 'email required' }, 400);
    
    // Validate tenant exists if tenantId is provided
    let tenant: any = null;
    if (tenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
      if (!tenant) return safeJson(res, { error: 'Tenant not found' }, 400);
    }
    
    // Only block duplicates within the same tenant (honors unique (tenantId,email))
    const whereExisting: any = {
      email: { equals: String(email), mode: 'insensitive' },
      tenantId: tenantId ? Number(tenantId) : null
    };
    const existing = await prisma.user.findFirst({ where: whereExisting });
    if (existing) return safeJson(res, { error: 'User already exists for this tenant' }, 400);
    
    // Generate initial password (readable format)
    const tempPassword = crypto.randomBytes(6).toString('hex'); // 12 character hex password
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);
    
    const allowedRoles = new Set(['admin','senior_staff','admissions_officer']);
    const safeRole = allowedRoles.has(String(role)) ? String(role) : 'admissions_officer';
    
    const u = await prisma.user.create({ 
      data: { 
        email: String(email), 
        role: safeRole as any, 
        approved: true, // Auto-approve users created by super admin
        tenantId: tenantId ? Number(tenantId) : null, 
        password: hashedPassword 
      } 
    });
    
    await auditLogger.custom(req, 'invite_user', 'cpanel', { userId: u.id, tenantId: u.tenantId, role: u.role });
    
    // Return user data with initial password AND tenant info so super admin can share institution ID
    return safeJson(res, { 
      success: true, 
      user: {
        id: u.id,
        email: u.email,
        role: u.role,
        tenantId: u.tenantId,
        approved: u.approved,
        createdAt: u.createdAt
      },
      initialPassword: tempPassword, // Return plain password for super admin to share
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain || null,
      } : null,
    });
  } catch (e: any) {
    console.error('[invite_user] error:', e?.message || e);
    if (e?.code === 'P2002') {
      return safeJson(res, { error: 'User with that email already exists for this tenant' }, 409);
    }
    return safeJson(res, { error: 'Failed to invite user', detail: e?.message }, 400);
  }
});

// Bulk deactivate users (acts like "bulk delete" in cPanel)
// Body: { ids: number[] }
router.put('/users/bulk/deactivate', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return safeJson(res, { error: 'ids[] is required' }, 400);
    }

    const userIds = Array.from(new Set(ids.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0)));
    if (userIds.length === 0) {
      return safeJson(res, { error: 'No valid user ids provided' }, 400);
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { approved: false }
    });

    try {
      await auditLogger.custom(req, 'bulk_deactivate_users', 'cpanel', { userIds });
    } catch (e) {
      console.error('Audit bulk_deactivate_users failed:', e);
    }

    return safeJson(res, { success: true, deactivatedCount: userIds.length });
  } catch (e) {
    console.error('Bulk deactivate users failed:', e);
    return safeJson(res, { error: 'Failed to deactivate users' }, 400);
  }
});

// Deactivate user (set approved=false)
router.put('/users/:id/deactivate', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const u = await prisma.user.update({ where: { id }, data: { approved: false } });
    await auditLogger.custom(req, 'deactivate_user', 'cpanel', { userId: id });
    return safeJson(res, { success: true, user: u });
  } catch (e) {
    return safeJson(res, { error: 'Failed to deactivate user' }, 400);
  }
});

// Set/Reset user password (super admin only)
router.put('/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return safeJson(res, { error: 'Password is required' }, 400);
    }
    
    if (password.length < 6) {
      return safeJson(res, { error: 'Password must be at least 6 characters' }, 400);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: Number(id) }
    });
    
    if (!user) {
      return safeJson(res, { error: 'User not found' }, 404);
    }
    
    // Hash the new password
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await prisma.user.update({
      where: { id: Number(id) },
      data: { password: hashedPassword }
    });
    
    await auditLogger.custom(req, 'reset_user_password', 'cpanel', { 
      userId: user.id, 
      tenantId: user.tenantId,
      userEmail: user.email 
    });
    
    return safeJson(res, { 
      success: true, 
      message: 'Password updated successfully',
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (e) {
    console.error('Set password error:', e);
    return safeJson(res, { error: 'Failed to set password' }, 400);
  }
});

// Bulk role change
router.put('/users/bulk/role', async (req, res) => {
  try {
    const { userIds, role } = req.body || {};
    if (!Array.isArray(userIds) || !role) return safeJson(res, { error: 'userIds[] and role required' }, 400);
    await prisma.user.updateMany({ where: { id: { in: userIds.map((x: any) => Number(x)) } }, data: { role: (role as any) } });
    await auditLogger.custom(req, 'bulk_update_user_role', 'cpanel', { count: userIds.length, role });
    return safeJson(res, { success: true });
  } catch (e) {
    return safeJson(res, { error: 'Failed bulk role change' }, 400);
  }
});

// Assign tenant admin (set role=admin)
router.put('/users/:id/assign-tenant-admin', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const u = await prisma.user.update({ where: { id }, data: { role: 'admin' as any } });
    await auditLogger.custom(req, 'assign_tenant_admin', 'cpanel', { userId: id });
    return safeJson(res, { success: true, user: u });
  } catch (e) {
    return safeJson(res, { error: 'Failed to assign tenant admin' }, 400);
  }
});

// ---- Security & Policy ----
router.get('/security', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.security || {});
});

router.put('/security/ip', async (req, res) => {
  const cfg = await loadCfg();
  const security = (cfg.security = (cfg.security || { ip: { allow: [], deny: [] }, password: {}, twoFA: {}, sso: {} }) as any);
  security.ip = { allow: Array.isArray(req.body?.allow) ? req.body.allow : (security.ip?.allow || []), deny: Array.isArray(req.body?.deny) ? req.body.deny : (security.ip?.deny || []) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_ip_policy', 'cpanel', {});
  return safeJson(res, { success: true, ip: security.ip });
});

router.put('/security/password', async (req, res) => {
  const cfg = await loadCfg();
  const security = (cfg.security = (cfg.security || { ip: { allow: [], deny: [] }, password: {}, twoFA: {}, sso: {} }) as any);
  security.password = { ...(security.password || {}), ...(req.body || {}) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_password_policy', 'cpanel', {});
  return safeJson(res, { success: true, password: security.password });
});

router.put('/security/twofa', async (req, res) => {
  const cfg = await loadCfg();
  const security = (cfg.security = (cfg.security || { ip: { allow: [], deny: [] }, password: {}, twoFA: {}, sso: {} }) as any);
  security.twoFA = { ...(security.twoFA || {}), ...(req.body || {}) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_2fa_policy', 'cpanel', {});
  return safeJson(res, { success: true, twoFA: security.twoFA });
});

router.put('/security/sso', async (req, res) => {
  const cfg = await loadCfg();
  const security = (cfg.security = (cfg.security || { ip: { allow: [], deny: [] }, password: {}, twoFA: {}, sso: {} }) as any);
  security.sso = { ...(security.sso || {}), ...(req.body || {}) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_sso_policy', 'cpanel', {});
  return safeJson(res, { success: true, sso: security.sso });
});

// ---- Billing: Coupons & Credits ----
router.get('/billing', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.billing || {});
});

router.post('/billing/coupons', async (req, res) => {
  const cfg = await loadCfg();
  const { code, amountOff, percentOff, validUntil, maxRedemptions } = req.body || {};
  if (!code) return safeJson(res, { error: 'code required' }, 400);
  const billing = (cfg.billing = (cfg.billing || { mpesa: { sandbox: true }, invoices: [], coupons: [], credits: [] }) as any);
  billing.coupons = billing.coupons || [];
  if (billing.coupons.find((c: any) => c.code?.toLowerCase() === String(code).toLowerCase())) return safeJson(res, { error: 'Coupon code exists' }, 400);
  const coupon = { id: crypto.randomUUID(), code: String(code), amountOff: amountOff ? Number(amountOff) : undefined, percentOff: percentOff ? Number(percentOff) : undefined, validUntil: validUntil ? String(validUntil) : null, maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null, redemptions: 0 };
  billing.coupons.push(coupon as any);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_create_coupon', 'cpanel', { code: coupon.code });
  return safeJson(res, { coupon });
});

router.post('/billing/credits', async (req, res) => {
  const cfg = await loadCfg();
  const { tenantId, amount, reason } = req.body || {};
  if (!tenantId || !amount) return safeJson(res, { error: 'tenantId and amount required' }, 400);
  const billing = (cfg.billing = (cfg.billing || { mpesa: { sandbox: true }, invoices: [], coupons: [], credits: [] }) as any);
  billing.credits = billing.credits || [];
  const credit = { id: crypto.randomUUID(), tenantId: Number(tenantId), amount: Number(amount), reason: reason ? String(reason) : undefined, createdAt: new Date().toISOString() };
  billing.credits.push(credit as any);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_grant_credit', 'cpanel', { tenantId: credit.tenantId, amount: credit.amount });
  return safeJson(res, { credit });
});

// ---- Backups schedule & Maintenance/Kill Switch ----
router.get('/backups/schedule', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.backups?.schedule || { enabled: false });
});

router.put('/backups/schedule', async (req, res) => {
  const cfg = await loadCfg();
  const backups = (cfg.backups = (cfg.backups || { schedule: { enabled: false, cron: '0 3 * * *' } }) as any);
  const { enabled, cron, emailEnabled, emailTo } = req.body || {};
  backups.schedule = {
    enabled: typeof enabled === 'boolean' ? enabled : (backups.schedule?.enabled || false),
    cron: typeof cron === 'string' ? cron : (backups.schedule?.cron || '0 3 * * *'),
    emailEnabled: typeof emailEnabled === 'boolean' ? emailEnabled : (backups.schedule?.emailEnabled || false),
    emailTo: typeof emailTo === 'string' ? emailTo : (backups.schedule?.emailTo || '')
  };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_backup_schedule', 'cpanel', {});
  return safeJson(res, { success: true, schedule: backups.schedule });
});

// System backup: export global configuration and minimal metadata
router.get('/system/backup', async (_req, res) => {
  try {
    const cfg = await loadCfg();
    const payload = {
      meta: { generatedAt: new Date().toISOString(), type: 'system_backup', version: '1.0.0' },
      config: cfg
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=edusmart-system-backup.json`);
    return res.status(200).send(JSON.stringify(payload));
  } catch (e) {
    return safeJson(res, { error: 'Failed to create system backup' }, 500);
  }
});

// Trigger email of system backup (placeholder - integrate with provider settings later)
router.post('/backups/system/email', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return safeJson(res, { error: 'email required' }, 400);
    // Here we would send the generated backup to the specified email.
    await auditLogger.custom(req, 'cpanel_email_system_backup', 'cpanel', { email });
    return safeJson(res, { success: true, message: 'Backup email queued' });
  } catch (e) {
    return safeJson(res, { error: 'Failed to queue backup email' }, 400);
  }
});

router.put('/maintenance', async (req, res) => {
  const cfg = await loadCfg();
  cfg.maintenance = cfg.maintenance || { readOnly: false, killSwitchTenants: [] };
  const { readOnly, killSwitchTenants } = req.body || {};
  if (typeof readOnly === 'boolean') cfg.maintenance.readOnly = readOnly;
  if (Array.isArray(killSwitchTenants)) cfg.maintenance.killSwitchTenants = killSwitchTenants.map((x: any) => Number(x));
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_maintenance', 'cpanel', {});
  return safeJson(res, { success: true, maintenance: cfg.maintenance });
});

// ---- Safe purge with retention (days) ----
router.post('/tenants/:id/purge', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { retentionDays = 30, tables = ['inquiries', 'followups', 'tasks'] } = req.body || {};
    const cutoff = new Date(Date.now() - Math.max(1, Number(retentionDays)) * 24 * 60 * 60 * 1000);

    const results: any = {};
    if (tables.includes('inquiries')) results.inquiries = await prisma.inquiry.deleteMany({ where: { tenantId: id, createdAt: { lt: cutoff } } });
    if (tables.includes('followups')) results.followups = await prisma.followup.deleteMany({ where: { tenantId: id, createdAt: { lt: cutoff } } });
    if (tables.includes('tasks')) results.tasks = await prisma.task.deleteMany({ where: { tenantId: id, createdAt: { lt: cutoff } } });

    await auditLogger.custom(req, 'tenant_safe_purge', 'cpanel', { tenantId: id, retentionDays });
    return safeJson(res, { success: true, results });
  } catch (e) {
    return safeJson(res, { error: 'Failed to purge' }, 400);
  }
});

// ---- Observability stubs ----
router.get('/observability', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.observability || {});
});

// ---- Limits & Quotas ----
router.get('/limits', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.limits || { global: {}, perTenant: {} });
});

router.put('/limits/global', async (req, res) => {
  const cfg = await loadCfg();
  const limits = (cfg.limits = (cfg.limits || { global: {}, perTenant: {} }) as any);
  limits.global = { ...(limits.global || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_limits_global', 'cpanel', {});
  return safeJson(res, { success: true, global: limits.global });
});

router.put('/limits/tenant/:tenantId', async (req, res) => {
  const cfg = await loadCfg();
  const limits = (cfg.limits = (cfg.limits || { global: {}, perTenant: {} }) as any);
  const tid = String(req.params.tenantId);
  limits.perTenant = limits.perTenant || ({} as any);
  limits.perTenant[tid] = { ...(limits.perTenant[tid] || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_limits_tenant', 'cpanel', { tenantId: tid });
  return safeJson(res, { success: true, tenant: tid, limits: limits.perTenant[tid] });
});

// ---- Release Control ----
router.get('/release', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.release || { enabled: false });
});

router.put('/release', async (req, res) => {
  const cfg = await loadCfg();
  cfg.release = { ...(cfg.release || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_release', 'cpanel', {});
  return safeJson(res, { success: true, release: cfg.release });
});

// ---- Incidents ----
router.get('/incidents', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { incidents: cfg.incidents || [] });
});

router.post('/incidents', async (req, res) => {
  const cfg = await loadCfg();
  const { title, body } = req.body || {};
  if (!title) return safeJson(res, { error: 'title required' }, 400);
  cfg.incidents = cfg.incidents || [];
  const incident = { id: crypto.randomUUID(), title: String(title), body: body ? String(body) : undefined, status: 'open', createdAt: new Date().toISOString(), closedAt: null } as any;
  cfg.incidents.push(incident);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_incident_create', 'cpanel', { id: incident.id });
  return safeJson(res, { incident });
});

router.put('/incidents/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const idx = (cfg.incidents || []).findIndex((x: any) => x.id === id);
  if (idx < 0) return safeJson(res, { error: 'Incident not found' }, 404);
  const { title, body, status } = req.body || {};
  if (typeof title === 'string') (cfg.incidents as any)[idx].title = title;
  if (typeof body === 'string') (cfg.incidents as any)[idx].body = body;
  if (status === 'open' || status === 'monitoring' || status === 'closed') {
    (cfg.incidents as any)[idx].status = status;
    (cfg.incidents as any)[idx].closedAt = status === 'closed' ? new Date().toISOString() : null;
  }
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_incident_update', 'cpanel', { id });
  return safeJson(res, { incident: (cfg.incidents as any)[idx] });
});

// ---- API Usage analytics stubs ----
router.get('/analytics/api-usage', async (_req, res) => {
  // Placeholder: In production, read from logs/metrics store
  return safeJson(res, { byEndpoint: [], totals: { requests: 0, errors: 0, p95: 0 } });
});

// ---- SCIM/Directory settings ----
router.get('/security/scim', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.security?.scim || { enabled: false });
});

router.put('/security/scim', async (req, res) => {
  const cfg = await loadCfg();
  const security = (cfg.security = (cfg.security || {}) as any);
  security.scim = { ...(security.scim || {}), ...(req.body || {}) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_scim', 'cpanel', {});
  return safeJson(res, { success: true, scim: security.scim });
});

// ---- Provider settings & templates ----
router.get('/providers', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.providers || {});
});

router.put('/providers', async (req, res) => {
  const cfg = await loadCfg();
  cfg.providers = { ...(cfg.providers || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_providers', 'cpanel', {});
  return safeJson(res, { success: true, providers: cfg.providers });
});

router.get('/templates', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { templates: cfg.templates || [] });
});

router.post('/templates', async (req, res) => {
  const cfg = await loadCfg();
  const { type, name, content } = req.body || {};
  if (!type || !name || !content) return safeJson(res, { error: 'type, name, content required' }, 400);
  cfg.templates = cfg.templates || [];
  const t = { id: crypto.randomUUID(), type, name, content, updatedAt: new Date().toISOString() } as any;
  cfg.templates.push(t);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_create_template', 'cpanel', { id: t.id, type });
  return safeJson(res, { template: t });
});

router.put('/templates/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const idx = (cfg.templates || []).findIndex((x: any) => x.id === id);
  if (idx < 0) return safeJson(res, { error: 'Template not found' }, 404);
  const { name, content } = req.body || {};
  if (typeof name === 'string') (cfg.templates as any)[idx].name = name;
  if (typeof content === 'string') (cfg.templates as any)[idx].content = content;
  (cfg.templates as any)[idx].updatedAt = new Date().toISOString();
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_template', 'cpanel', { id });
  return safeJson(res, { template: (cfg.templates as any)[idx] });
});

router.delete('/templates/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  cfg.templates = (cfg.templates || []).filter((x: any) => x.id !== id);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_delete_template', 'cpanel', { id });
  return safeJson(res, { success: true });
});

// ---- Governance: Custom RBAC roles ----
router.get('/rbac/roles', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { roles: cfg.rbac?.roles || [] });
});

router.post('/rbac/roles', async (req, res) => {
  const cfg = await loadCfg();
  const { name, permissions = [], description } = req.body || {};
  if (!name) return safeJson(res, { error: 'name required' }, 400);
  cfg.rbac = cfg.rbac || { roles: [] };
  if ((cfg.rbac.roles as any).find((r: any) => String(r.name).toLowerCase() === String(name).toLowerCase())) {
    return safeJson(res, { error: 'Role exists' }, 400);
  }
  (cfg.rbac.roles as any).push({ name: String(name), permissions: Array.isArray(permissions) ? permissions : [], description: description ? String(description) : undefined });
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_role_create', 'cpanel', { name });
  return safeJson(res, { success: true });
});

router.put('/rbac/roles/:name', async (req, res) => {
  const cfg = await loadCfg();
  const name = String(req.params.name);
  const idx = (cfg.rbac?.roles || []).findIndex((r: any) => String(r.name) === name);
  if (idx < 0) return safeJson(res, { error: 'Not found' }, 404);
  const { permissions, description } = req.body || {};
  if (Array.isArray(permissions)) (cfg.rbac!.roles as any)[idx].permissions = permissions;
  if (typeof description === 'string') (cfg.rbac!.roles as any)[idx].description = description;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_role_update', 'cpanel', { name });
  return safeJson(res, { success: true, role: (cfg.rbac!.roles as any)[idx] });
});

router.delete('/rbac/roles/:name', async (req, res) => {
  const cfg = await loadCfg();
  const name = String(req.params.name);
  cfg.rbac = cfg.rbac || { roles: [] };
  cfg.rbac.roles = (cfg.rbac.roles as any).filter((r: any) => String(r.name) !== name);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_role_delete', 'cpanel', { name });
  return safeJson(res, { success: true });
});

// ---- Compliance: retention & legal holds & export stubs ----
router.get('/compliance', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { retention: cfg.retention || [], legalHolds: cfg.legalHolds || [] });
});

router.post('/compliance/retention', async (req, res) => {
  const cfg = await loadCfg();
  const { entity, days } = req.body || {};
  if (!entity || typeof days !== 'number') return safeJson(res, { error: 'entity and days required' }, 400);
  cfg.retention = cfg.retention || [];
  const idx = (cfg.retention as any).findIndex((r: any) => r.entity === entity);
  if (idx >= 0) (cfg.retention as any)[idx].days = Number(days); else (cfg.retention as any).push({ entity, days: Number(days) });
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_retention_set', 'cpanel', { entity, days });
  return safeJson(res, { success: true });
});

router.post('/compliance/legal-holds', async (req, res) => {
  const cfg = await loadCfg();
  const { subject, reason } = req.body || {};
  if (!subject) return safeJson(res, { error: 'subject required' }, 400);
  cfg.legalHolds = cfg.legalHolds || [];
  const lh = { id: crypto.randomUUID(), subject: String(subject), reason: reason ? String(reason) : undefined, active: true, createdAt: new Date().toISOString() } as any;
  (cfg.legalHolds as any).push(lh);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_legal_hold_create', 'cpanel', { id: lh.id });
  return safeJson(res, { legalHold: lh });
});

router.put('/compliance/legal-holds/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const idx = (cfg.legalHolds || []).findIndex((x: any) => x.id === id);
  if (idx < 0) return safeJson(res, { error: 'Not found' }, 404);
  const { active, reason } = req.body || {};
  if (typeof active === 'boolean') (cfg.legalHolds as any)[idx].active = active;
  if (typeof reason === 'string') (cfg.legalHolds as any)[idx].reason = reason;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_legal_hold_update', 'cpanel', { id });
  return safeJson(res, { legalHold: (cfg.legalHolds as any)[idx] });
});

router.get('/compliance/export', async (_req, res) => {
  // Export stub: return a small JSON confirming what would be exported
  return safeJson(res, { ok: true, formats: ['csv','json'], note: 'Implement export to file storage/provider' });
});

// ---- Security additions: secrets metadata, geo, passwordless ----
router.get('/security/extras', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { secrets: cfg.secrets || { items: [] }, geo: cfg.geo || {}, passwordless: cfg.passwordless || {} });
});

router.put('/security/geo', async (req, res) => {
  const cfg = await loadCfg();
  cfg.geo = { ...(cfg.geo || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_geo', 'cpanel', {});
  return safeJson(res, { success: true, geo: cfg.geo });
});

router.put('/security/passwordless', async (req, res) => {
  const cfg = await loadCfg();
  cfg.passwordless = { ...(cfg.passwordless || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_passwordless', 'cpanel', {});
  return safeJson(res, { success: true, passwordless: cfg.passwordless });
});

// ---- Billing advanced ----
router.put('/billing/tax', async (req, res) => {
  const cfg = await loadCfg();
  cfg.tax = { ...(cfg.tax || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_tax', 'cpanel', {});
  return safeJson(res, { success: true, tax: cfg.tax });
});

router.put('/billing/overage', async (req, res) => {
  const cfg = await loadCfg();
  cfg.overage = { ...(cfg.overage || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_overage', 'cpanel', {});
  return safeJson(res, { success: true, overage: cfg.overage });
});

// ---- Domains management ----
router.get('/domains', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { items: cfg.domains?.items || [] });
});

router.post('/domains', async (req, res) => {
  const cfg = await loadCfg();
  const { tenantId, domain } = req.body || {};
  if (!tenantId || !domain) return safeJson(res, { error: 'tenantId and domain required' }, 400);
  cfg.domains = cfg.domains || { items: [] };
  (cfg.domains.items as any).push({ tenantId: Number(tenantId), domain: String(domain).toLowerCase(), status: 'pending' });
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_domain_add', 'cpanel', { tenantId });
  return safeJson(res, { success: true });
});

router.put('/domains/verify', async (req, res) => {
  const cfg = await loadCfg();
  const { domain, status } = req.body || {};
  if (!domain) return safeJson(res, { error: 'domain required' }, 400);
  const idx = (cfg.domains?.items || []).findIndex((d: any) => d.domain === String(domain).toLowerCase());
  if (idx < 0) return safeJson(res, { error: 'Not found' }, 404);
  if (status === 'verified' || status === 'invalid' || status === 'pending') (cfg.domains!.items as any)[idx].status = status;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_domain_status', 'cpanel', { domain, status });
  return safeJson(res, { item: (cfg.domains!.items as any)[idx] });
});

// ---- Webhook replay ----
router.post('/webhooks/:id/replay', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const idx = (cfg.webhooks || []).findIndex((w: any) => w.id === id);
  if (idx < 0) return safeJson(res, { error: 'Webhook not found' }, 404);
  await auditLogger.custom(req, 'cpanel_webhook_replay', 'cpanel', { id });
  return safeJson(res, { success: true, replayId: `replay-${Date.now()}` });
});

// ---- SLAs, health scores ----
router.get('/sla', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.sla || { perPlan: {} });
});

router.put('/sla/:planId', async (req, res) => {
  const cfg = await loadCfg();
  const planId = String(req.params.planId);
  const sla = (cfg.sla = (cfg.sla || { perPlan: {} }) as any);
  sla.perPlan[planId] = { ...(sla.perPlan[planId] || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_sla', 'cpanel', { planId });
  return safeJson(res, { success: true, perPlan: sla.perPlan });
});

router.get('/health-scores', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.healthScores || {});
});

router.put('/health-scores/:tenantId', async (req, res) => {
  const cfg = await loadCfg();
  const tid = String(req.params.tenantId);
  const { score } = req.body || {};
  if (typeof score !== 'number') return safeJson(res, { error: 'score required' }, 400);
  cfg.healthScores = cfg.healthScores || {};
  (cfg.healthScores as any)[tid] = Number(score);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_health_score', 'cpanel', { tenantId: tid });
  return safeJson(res, { success: true, score: (cfg.healthScores as any)[tid] });
});

// ---- Data quality & platform settings ----
router.get('/platform', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.platform || {});
});

router.put('/platform', async (req, res) => {
  const cfg = await loadCfg();
  cfg.platform = { ...(cfg.platform || {}), ...(req.body || {}) } as any;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_platform', 'cpanel', {});
  return safeJson(res, { success: true, platform: cfg.platform });
});

router.get('/data-quality', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg.dataQuality || { rules: [] });
});

router.post('/data-quality/rules', async (req, res) => {
  const cfg = await loadCfg();
  const { entity, field, required, unique } = req.body || {};
  if (!entity || !field) return safeJson(res, { error: 'entity and field required' }, 400);
  const dq = (cfg.dataQuality = (cfg.dataQuality || { rules: [] }) as any);
  dq.rules.push({ entity, field, required: !!required, unique: !!unique });
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_add_data_quality_rule', 'cpanel', { entity, field });
  return safeJson(res, { success: true });
});
// ---- Basic cross-tenant analytics ----
router.get('/analytics/summary', async (_req, res) => {
  try {
    const tenants = await prisma.tenant.count();
    const users = await prisma.user.count();
    const inquiries = await prisma.inquiry.count();
    const followups = await prisma.followup.count();
    return safeJson(res, { tenants, users, inquiries, followups });
  } catch (e) {
    return safeJson(res, { error: 'Failed to load analytics' }, 500);
  }
});

// ---- Support tickets stored in cpanel config ----
router.get('/support/tickets', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, { tickets: cfg.support?.tickets || [] });
});

router.post('/support/tickets', async (req, res) => {
  const cfg = await loadCfg();
  const { tenantId, title, body } = req.body || {};
  if (!title || !body) return safeJson(res, { error: 'title and body required' }, 400);
  cfg.support = cfg.support || { tickets: [] };
  const t = { id: crypto.randomUUID(), tenantId: tenantId ? Number(tenantId) : null, title, body, status: 'open', createdAt: new Date().toISOString() } as any;
  cfg.support.tickets.push(t);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_support_ticket_create', 'cpanel', { id: t.id, tenantId: t.tenantId });
  return safeJson(res, { ticket: t });
});

router.put('/support/tickets/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const idx = (cfg.support?.tickets || []).findIndex((x: any) => x.id === id);
  if (idx < 0) return safeJson(res, { error: 'Ticket not found' }, 404);
  const { title, body, status } = req.body || {};
  if (typeof title === 'string') (cfg.support!.tickets as any)[idx].title = title;
  if (typeof body === 'string') (cfg.support!.tickets as any)[idx].body = body;
  if (status === 'open' || status === 'closed') (cfg.support!.tickets as any)[idx].status = status;
  (cfg.support!.tickets as any)[idx].updatedAt = new Date().toISOString();
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_support_ticket_update', 'cpanel', { id });
  return safeJson(res, { ticket: (cfg.support!.tickets as any)[idx] });
});

// --- Audit Logs ---
router.get('/audit', async (req, res) => {
	try {
		const { q, user, tenant, action, limit = '100' } = req.query as any;
		const where: any = {};
		if (q) where.OR = [ { action: { contains: q, mode: 'insensitive' } }, { module: { contains: q, mode: 'insensitive' } } ];
		if (user) where.user = { equals: user, mode: 'insensitive' };
		if (tenant) where.details = { path: ['tenantId'], equals: Number(tenant) };
		if (action) where.action = { equals: action, mode: 'insensitive' };
		const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(500, Number(limit) || 100) });
		return safeJson(res, { logs });
	} catch (e) {
		return safeJson(res, { error: 'Failed to query audit logs' }, 500);
	}
});

// --- Health ---
router.get('/health', async (_req, res) => {
	try {
		const tenants = await prisma.tenant.count();
		const users = await prisma.user.count();
		const inquiries = await prisma.inquiry.count();
		const followups = await prisma.followup.count();
		return safeJson(res, { ok: true, counts: { tenants, users, inquiries, followups } });
	} catch (e) {
		return safeJson(res, { ok: false, error: 'DB error' }, 500);
	}
});

// --- Usage (parallel counts — no N+1) ---
router.get('/usage', async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true }, take: 100 });
    const rows = await Promise.all(
      tenants.map(async (t) => {
        const [users, inquiries, followups, tasks] = await Promise.all([
          prisma.user.count({ where: { tenantId: t.id } }),
          prisma.inquiry.count({ where: { tenantId: t.id } }),
          prisma.followup.count({ where: { tenantId: t.id } }),
          prisma.task.count({ where: { tenantId: t.id } }),
        ]);
        return { tenantId: t.id, tenant: t.name, users, inquiries, followups, tasks };
      })
    );
    return safeJson(res, { tenants: rows });
  } catch (e) {
    return safeJson(res, { error: 'Failed to load usage' }, 500);
  }
});

// --- Billing (MPESA Sandbox/Mock) ---
router.put('/billing/mpesa', async (req, res) => {
  const cfg = await loadCfg();
  const billing = (cfg.billing = (cfg.billing || { mpesa: { sandbox: true }, invoices: [], coupons: [], credits: [] }) as any);
  const current = billing.mpesa || { sandbox: true };
  const { sandbox, shortcode, tillNumber, callbackBaseUrl } = req.body || {};
  billing.mpesa = {
    sandbox: typeof sandbox === 'boolean' ? sandbox : current.sandbox,
    shortcode: typeof shortcode === 'string' ? shortcode : current.shortcode,
    tillNumber: typeof tillNumber === 'string' ? tillNumber : current.tillNumber,
    callbackBaseUrl: typeof callbackBaseUrl === 'string' ? callbackBaseUrl : current.callbackBaseUrl,
  };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_mpesa', 'cpanel', { sandbox: billing.mpesa.sandbox });
  return safeJson(res, { success: true, mpesa: billing.mpesa });
});

router.post('/billing/invoices', async (req, res) => {
  const { tenantId, planId, amount } = req.body || {};
  if (!tenantId || !amount) return safeJson(res, { error: 'tenantId and amount required' }, 400);
  const cfg = await loadCfg();
  const billing = (cfg.billing = (cfg.billing || { invoices: [], mpesa: { sandbox: true }, coupons: [], credits: [] }) as any);
  billing.invoices = billing.invoices || [];
  const inv = { id: crypto.randomUUID(), tenantId: Number(tenantId), planId, amount: Number(amount), status: 'pending' as const, createdAt: new Date().toISOString() };
  billing.invoices.push(inv);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_create_invoice', 'cpanel', { invoiceId: inv.id, tenantId: inv.tenantId, amount: inv.amount });
  return safeJson(res, { invoice: inv });
});

// Simulate MPESA callback to mark invoice paid
router.post('/billing/mpesa/callback', async (req, res) => {
  try {
    const { invoiceId, ref } = req.body || {};
    if (!invoiceId) return safeJson(res, { error: 'invoiceId required' }, 400);
    const cfg = await loadCfg();
    const idx = (cfg.billing?.invoices || []).findIndex((i: any) => i.id === invoiceId);
    if (idx < 0) return safeJson(res, { error: 'Invoice not found' }, 404);
    cfg.billing!.invoices![idx].status = 'paid';
    cfg.billing!.invoices![idx].paidAt = new Date().toISOString();
    cfg.billing!.invoices![idx].ref = typeof ref === 'string' ? ref : `MPESA-${Date.now()}`;
    await saveCfg(cfg);
    await auditLogger.custom(req, 'cpanel_invoice_paid', 'cpanel', { invoiceId });
    return safeJson(res, { success: true, invoice: cfg.billing!.invoices![idx] });
  } catch (e) {
    return safeJson(res, { error: 'Callback handling failed' }, 400);
  }
});

// --- DLP Delete Requests Review (cross-tenant) ---
router.get('/delete-requests', async (_req, res) => {
  try {
    const list = await prisma.deleteRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return safeJson(res, { requests: list });
  } catch (e) {
    return safeJson(res, { error: 'Failed to list delete requests' }, 500);
  }
});

router.post('/delete-requests/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const dr = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!dr) return safeJson(res, { error: 'Not found' }, 404);
    // Call into existing tenant delete approval flow or perform hard delete
    // For now: mark approved and leave tenant-side worker to do the deletion
    const updated = await prisma.deleteRequest.update({ where: { id }, data: { status: 'approved' } });
    await auditLogger.custom(req, 'cpanel_approve_delete', 'cpanel', { id });
    return safeJson(res, { success: true, request: updated });
  } catch (e) {
    return safeJson(res, { error: 'Failed to approve request' }, 400);
  }
});

router.post('/delete-requests/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const dr = await prisma.deleteRequest.findUnique({ where: { id } });
    if (!dr) return safeJson(res, { error: 'Not found' }, 404);
    const updated = await prisma.deleteRequest.update({ where: { id }, data: { status: 'rejected' } });
    await auditLogger.custom(req, 'cpanel_reject_delete', 'cpanel', { id });
    return safeJson(res, { success: true, request: updated });
  } catch (e) {
    return safeJson(res, { error: 'Failed to reject request' }, 400);
  }
});

// --- Plans & Feature Flags & Announcements ---
router.get('/config', async (_req, res) => {
  const cfg = await loadCfg();
  return safeJson(res, cfg);
});

router.put('/plans', async (req, res) => {
  try {
    const cfg = await loadCfg();
    const plans = Array.isArray(req.body?.plans) ? req.body.plans : null;
    if (!plans) return safeJson(res, { error: 'plans array required' }, 400);
    cfg.plans = plans;
    await saveCfg(cfg);
    await auditLogger.custom(req, 'cpanel_update_plans', 'cpanel', { count: plans.length });
    return safeJson(res, { success: true, plans: cfg.plans });
  } catch {
    return safeJson(res, { error: 'Failed to update plans' }, 400);
  }
});

router.put('/flags/global', async (req, res) => {
  const cfg = await loadCfg();
  cfg.flags.global = { ...(cfg.flags.global || {}), ...(req.body || {}) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_flags_global', 'cpanel', {});
  return safeJson(res, { success: true, flags: cfg.flags.global });
});

router.put('/flags/tenant/:tenantId', async (req, res) => {
  const cfg = await loadCfg();
  const tid = String(req.params.tenantId);
  cfg.flags.perTenant[tid] = { ...(cfg.flags.perTenant[tid] || {}), ...(req.body || {}) };
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_flags_tenant', 'cpanel', { tenantId: tid });
  return safeJson(res, { success: true, flags: cfg.flags.perTenant[tid] });
});

router.post('/announcements', async (req, res) => {
  const cfg = await loadCfg();
  const { title, body, audience = 'all', tenantId, role } = req.body || {};
  if (!title || !body) return safeJson(res, { error: 'title and body required' }, 400);
  const ann = { id: crypto.randomUUID(), title, body, createdAt: new Date().toISOString(), audience, tenantId, role };
  cfg.announcements.push(ann);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_announcement', 'cpanel', { id: ann.id, audience, tenantId, role });
  return safeJson(res, { success: true, announcement: ann });
});

// --- Tenant Settings & Plan Assignment ---
router.put('/tenants/:id/plan', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const { planId, limitsOverride } = req.body || {};
  if (!planId) return safeJson(res, { error: 'planId required' }, 400);
  cfg.tenantSettings[id] = cfg.tenantSettings[id] || {};
  cfg.tenantSettings[id].planId = planId;
  if (limitsOverride && typeof limitsOverride === 'object') cfg.tenantSettings[id].limitsOverride = limitsOverride;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_assign_plan', 'cpanel', { tenantId: id, planId });
  return safeJson(res, { success: true, settings: cfg.tenantSettings[id] });
});

router.get('/tenants/:id/settings', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  return safeJson(res, { tenantId: id, settings: cfg.tenantSettings[id] || {} });
});

// --- API Keys ---
router.post('/apikeys', async (req, res) => {
  const { label, tenantId } = req.body || {};
  if (!label) return safeJson(res, { error: 'label required' }, 400);
  const cfg = await loadCfg();
  const raw = crypto.randomBytes(24).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  const key = { id: crypto.randomUUID(), label, hashed, createdAt: new Date().toISOString(), tenantId: tenantId ? Number(tenantId) : null };
  cfg.apiKeys.push(key);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_create_apikey', 'cpanel', { id: key.id, tenantId: key.tenantId });
  return safeJson(res, { id: key.id, apiKey: raw, tenantId: key.tenantId });
});

router.delete('/apikeys/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  cfg.apiKeys = cfg.apiKeys.filter(k => k.id !== id);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_delete_apikey', 'cpanel', { id });
  return safeJson(res, { success: true });
});

// --- Webhooks ---
router.post('/webhooks', async (req, res) => {
  const { url, events = [], tenantId } = req.body || {};
  if (!url || !Array.isArray(events)) return safeJson(res, { error: 'url and events[] required' }, 400);
  const cfg = await loadCfg();
  const wh = { id: crypto.randomUUID(), tenantId: tenantId ? Number(tenantId) : null, url, secret: crypto.randomBytes(16).toString('hex'), events, active: true, createdAt: new Date().toISOString() };
  cfg.webhooks.push(wh);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_create_webhook', 'cpanel', { id: wh.id, tenantId: wh.tenantId });
  return safeJson(res, { webhook: wh });
});

router.put('/webhooks/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  const idx = cfg.webhooks.findIndex(w => w.id === id);
  if (idx < 0) return safeJson(res, { error: 'Webhook not found' }, 404);
  const { url, events, active } = req.body || {};
  if (typeof url === 'string') cfg.webhooks[idx].url = url;
  if (Array.isArray(events)) cfg.webhooks[idx].events = events;
  if (typeof active === 'boolean') cfg.webhooks[idx].active = active;
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_update_webhook', 'cpanel', { id });
  return safeJson(res, { webhook: cfg.webhooks[idx] });
});

router.delete('/webhooks/:id', async (req, res) => {
  const cfg = await loadCfg();
  const id = String(req.params.id);
  cfg.webhooks = cfg.webhooks.filter(w => w.id !== id);
  await saveCfg(cfg);
  await auditLogger.custom(req, 'cpanel_delete_webhook', 'cpanel', { id });
  return safeJson(res, { success: true });
});

// --- Backups ---
router.post('/tenants/:id/backup', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return safeJson(res, { error: 'Tenant not found' }, 404);

    // Stream backup table-by-table to avoid holding full payload in memory
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=tenant-${tenant.id}-backup.json`);
    res.status(200);
    res.write('{"meta":' + JSON.stringify({
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      generatedAt: new Date().toISOString(),
      versions: { app: '1.0.0' }
    }) + ',"data":{');

    const tables: Array<{ key: string; query: Promise<any[]> }> = [
      { key: 'users', query: prisma.user.findMany({ where: { tenantId: id } }) },
      { key: 'inquiries', query: prisma.inquiry.findMany({ where: { tenantId: id } }) },
      { key: 'inquiryDetails', query: prisma.inquiryDetail.findMany({ where: { inquiry: { tenantId: id } } }) },
      { key: 'followups', query: prisma.followup.findMany({ where: { tenantId: id } }) },
      { key: 'followupComments', query: prisma.followupComment.findMany({ where: { followup: { tenantId: id } } }) },
      { key: 'tasks', query: prisma.task.findMany({ where: { tenantId: id } }) },
    ];
    for (let i = 0; i < tables.length; i++) {
      const rows = await tables[i].query;
      res.write(`${i > 0 ? ',' : ''}"${tables[i].key}":${JSON.stringify(rows)}`);
    }
    res.write('}}');
    return res.end();
  } catch (e) {
    return safeJson(res, { error: 'Failed to create backup' }, 500);
  }
});

router.post('/tenants/:id/restore', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return safeJson(res, { error: 'Tenant not found' }, 404);

    const { data } = req.body || {};
    if (!data) return safeJson(res, { error: 'No data payload provided' }, 400);

    // Basic restore: transactional upserts by primary keys where possible
    const result = await prisma.$transaction(async (tx) => {
      let users = 0, inquiries = 0, inquiryDetails = 0, followups = 0, followupComments = 0, tasks = 0;

      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          try {
            await tx.user.upsert({
              where: { id: u.id },
              update: { ...u, tenantId: id },
              create: { ...u, tenantId: id }
            });
            users++;
          } catch {}
        }
      }
      if (Array.isArray(data.inquiries)) {
        for (const i of data.inquiries) {
          try {
            await tx.inquiry.upsert({
              where: { id: i.id },
              update: { ...i, tenantId: id },
              create: { ...i, tenantId: id }
            });
            inquiries++;
          } catch {}
        }
      }
      if (Array.isArray(data.inquiryDetails)) {
        for (const d of data.inquiryDetails) {
          try {
            await tx.inquiryDetail.upsert({
              where: { id: d.id },
              update: d,
              create: d
            });
            inquiryDetails++;
          } catch {}
        }
      }
      if (Array.isArray(data.followups)) {
        for (const f of data.followups) {
          try {
            await tx.followup.upsert({
              where: { id: f.id },
              update: { ...f, tenantId: id },
              create: { ...f, tenantId: id }
            });
            followups++;
          } catch {}
        }
      }
      if (Array.isArray(data.followupComments)) {
        for (const c of data.followupComments) {
          try {
            await tx.followupComment.upsert({
              where: { id: c.id },
              update: c,
              create: c
            });
            followupComments++;
          } catch {}
        }
      }
      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          try {
            await tx.task.upsert({
              where: { id: t.id },
              update: { ...t, tenantId: id },
              create: { ...t, tenantId: id }
            });
            tasks++;
          } catch {}
        }
      }

      return { users, inquiries, inquiryDetails, followups, followupComments, tasks };
    });

    await auditLogger.custom(req, 'restore_tenant', 'cpanel', { tenantId: id, restored: result });
    return safeJson(res, { success: true, restored: result });
  } catch (e) {
    return safeJson(res, { error: 'Failed to restore backup' }, 500);
  }
});

export default router;

// --- Impersonation ---
router.post('/impersonate', async (req, res) => {
  try {
    const { email, userId, tenantId, days = 7 } = req.body || {};
    const where: any = {};
    if (userId) where.id = Number(userId);
    if (email) where.email = { equals: String(email), mode: 'insensitive' };
    if (!where.id && !where.email) return safeJson(res, { error: 'email or userId required' }, 400);

    const user = await prisma.user.findFirst({ where: { ...where, tenantId: tenantId ? Number(tenantId) : undefined } });
    if (!user) return safeJson(res, { error: 'User not found' }, 404);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * Math.max(1, Math.min(30, Number(days) || 7)));
    await prisma.$executeRaw`
      INSERT INTO sessions (token, "userId", "tenantId", "expiresAt", "lastUsedAt")
      VALUES (${token}, ${user.id}, ${user.tenantId || tenantId || null}, ${expiresAt}, NOW())
    `;

    // Set session cookie and helpful non-HttpOnly hints
    res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: expiresAt, path: '/' });
    if (tenantId) {
      const t = await prisma.tenant.findUnique({ where: { id: Number(tenantId) } });
      if (t?.subdomain) res.cookie('tenant', t.subdomain, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: expiresAt, path: '/' });
    }

    await auditLogger.custom(req, 'impersonate_start', 'cpanel', { targetUserId: user.id, tenantId: tenantId || user.tenantId });
    return safeJson(res, { success: true, user: { id: user.id, email: user.email, role: user.role }, expiresAt });
  } catch (e) {
    return safeJson(res, { error: 'Failed to impersonate' }, 500);
  }
});

router.post('/impersonate/stop', async (req, res) => {
  try {
    const cookie = String(req.headers['cookie'] || '');
    const m = /(?:^|; )session=([^;]+)/.exec(cookie);
    const token = m ? decodeURIComponent(m[1]) : '';
    if (token) await prisma.$executeRaw`DELETE FROM sessions WHERE token = ${token}`;
    res.clearCookie('session', { path: '/' });
    await auditLogger.custom(req, 'impersonate_stop', 'cpanel', {});
    return safeJson(res, { success: true });
  } catch (e) {
    return safeJson(res, { error: 'Failed to stop impersonation' }, 500);
  }
});
