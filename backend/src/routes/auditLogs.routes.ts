import express from 'express';
import { listAuditLogs, createAuditLog, clearAuditLogs } from '../controllers/auditLog.controller';

const router = express.Router();

// GET /api/audit-logs -> list audit logs (admin only)
router.get('/', listAuditLogs);

// POST /api/audit-logs -> create audit log entry
router.post('/', createAuditLog);

// DELETE /api/audit-logs -> clear all audit logs (admin only)
router.delete('/', clearAuditLogs);

export default router;
