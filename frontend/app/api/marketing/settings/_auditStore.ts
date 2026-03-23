export type AuditLog = {
  id: string;
  timestamp: number;
  action: string;
  module: string;
  user?: string;
  ip?: string;
  details?: any;
};

let auditLogs: AuditLog[] = [];
const MAX_LOGS = 1000;

export function addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'> & Partial<Pick<AuditLog, 'timestamp'>>) {
  const log: AuditLog = {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    timestamp: entry.timestamp ?? Date.now(),
    action: entry.action,
    module: entry.module,
    user: entry.user,
    ip: entry.ip,
    details: entry.details,
  };
  auditLogs.unshift(log);
  if (auditLogs.length > MAX_LOGS) {
    auditLogs = auditLogs.slice(0, MAX_LOGS);
  }
  return log;
}

export function getAuditLogs() {
  return auditLogs;
}

export function clearAuditLogs() {
  auditLogs = [];
} 