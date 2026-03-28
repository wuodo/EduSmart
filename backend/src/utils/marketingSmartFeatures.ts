import type { PrismaClient } from '@prisma/client';
import { loadCpanelFromDb } from './cpanelStore';

export type LeadScoringWeights = {
  hasEmail: number;
  hasPhone: number;
  hasKcseGrade: number;
  followedUp: number;
  highIntakeUrgency: number;
  repeatContact: number;
};

export type SmartConfigFull = {
  leadScoring: { enabled: boolean; weights: LeadScoringWeights };
  autoReminders: {
    enabled: boolean;
    firstReminderDays: number;
    repeatIntervalDays: number;
    channels: { email: boolean; sms: boolean; whatsapp: boolean };
    maxReminders: number;
  };
  dormantLeads: { enabled: boolean; thresholdDays: number; alertAdmins: boolean; autoTagAsCold: boolean };
  duplicateDetection: {
    enabled: boolean;
    matchPhone: boolean;
    matchEmail: boolean;
    matchName: boolean;
    blockOnDuplicate: boolean;
  };
  intakeCapacity: { enabled: boolean; warnAtPercent: number; lockOnFull: boolean };
  exportSchedule: { enabled: boolean; frequency: string; dayOfWeek: number; recipients: string };
  responseSla: { enabled: boolean; targetHours: number };
  profileHygiene: { enabled: boolean; nudgeIncompleteHours: number };
};

const DEFAULTS: SmartConfigFull = {
  leadScoring: {
    enabled: true,
    weights: { hasEmail: 10, hasPhone: 10, hasKcseGrade: 15, followedUp: 20, highIntakeUrgency: 25, repeatContact: 20 },
  },
  autoReminders: {
    enabled: true,
    firstReminderDays: 2,
    repeatIntervalDays: 5,
    maxReminders: 4,
    channels: { email: true, sms: false, whatsapp: false },
  },
  dormantLeads: { enabled: true, thresholdDays: 14, alertAdmins: true, autoTagAsCold: true },
  duplicateDetection: { enabled: true, matchPhone: true, matchEmail: true, matchName: false, blockOnDuplicate: false },
  intakeCapacity: { enabled: false, warnAtPercent: 80, lockOnFull: false },
  exportSchedule: { enabled: false, frequency: 'weekly', dayOfWeek: 1, recipients: '' },
  responseSla: { enabled: false, targetHours: 24 },
  profileHygiene: { enabled: true, nudgeIncompleteHours: 48 },
};

export function mergeSmartDefaults(raw: unknown): SmartConfigFull {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const deep = <T extends object>(def: T, patch: unknown): T => {
    if (!patch || typeof patch !== 'object') return { ...def };
    const out: any = Array.isArray(def) ? [...(def as any)] : { ...def };
    for (const k of Object.keys(patch as object)) {
      const pv = (patch as any)[k];
      const dv = (def as any)[k];
      if (pv !== undefined && typeof pv === 'object' && !Array.isArray(pv) && dv !== undefined && typeof dv === 'object' && !Array.isArray(dv)) {
        out[k] = deep(dv, pv);
      } else if (pv !== undefined) out[k] = pv;
    }
    return out as T;
  };
  return deep(DEFAULTS, r);
}

export async function fetchSmartConfigMerged(): Promise<SmartConfigFull> {
  const cfg = await loadCpanelFromDb();
  return mergeSmartDefaults((cfg as any).smartConfig);
}

/** Same normalisation as /inquiries/check-phone for OR queries */
export function phoneMatchVariants(phone: string): string[] {
  const digits = String(phone || '').replace(/\D/g, '');
  let core = digits;
  if (digits.startsWith('254') && digits.length >= 12) core = digits.slice(3);
  else if (digits.startsWith('0') && digits.length >= 10) core = digits.slice(1);
  const raw = String(phone || '').trim();
  return Array.from(new Set([raw, `0${core}`, `254${core}`, `+254${core}`, core].filter(Boolean)));
}

export function computeLeadScore(
  input: {
    email?: string | null;
    phone?: string | null;
    kcseGrade?: string | null;
    preferredContactMethod?: string | null;
    source?: string | null;
    status?: string | null;
    firstResponseAt?: Date | null;
  },
  weights: LeadScoringWeights,
  ctx: { followupCount: number; repeatPhoneCount: number },
): number {
  let score = 0;
  if ((input.email || '').trim()) score += weights.hasEmail;
  if ((input.phone || '').trim()) score += weights.hasPhone;
  const kg = String(input.kcseGrade || '').trim();
  if (kg && kg.toLowerCase() !== 'unknown') score += weights.hasKcseGrade;
  if (input.firstResponseAt || ctx.followupCount > 0) score += weights.followedUp;
  const st = String(input.status || '').toLowerCase();
  if (st === 'hot') score += weights.highIntakeUrgency;
  if (ctx.repeatPhoneCount > 0) score += weights.repeatContact;
  return Math.min(100, score);
}

export async function findSmartDuplicate(
  prisma: PrismaClient,
  tenantId: number,
  input: { fullName: string; phone: string; email: string },
  dup: SmartConfigFull['duplicateDetection'],
): Promise<{ blocked: boolean; record: { id: number; fullName: string } | null }> {
  if (!dup.enabled) return { blocked: false, record: null };

  const orClause: any[] = [];
  if (dup.matchPhone && input.phone) {
    const variants = phoneMatchVariants(input.phone);
    for (const v of variants) {
      orClause.push({ phone: { equals: v, mode: 'insensitive' } });
    }
  }
  if (dup.matchEmail && (input.email || '').trim()) {
    orClause.push({ email: { equals: input.email.trim(), mode: 'insensitive' } });
  }
  if (dup.matchName && (input.fullName || '').trim()) {
    orClause.push({ fullName: { equals: input.fullName.trim(), mode: 'insensitive' } });
  }
  if (orClause.length === 0) return { blocked: false, record: null };

  const found = await prisma.inquiry.findFirst({
    where: { tenantId, OR: orClause },
    select: { id: true, fullName: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!found) return { blocked: false, record: null };
  if (dup.blockOnDuplicate) return { blocked: true, record: found };
  return { blocked: false, record: found };
}

export type InquirySmartMeta = {
  dormant?: boolean;
  intakeFillPercent?: number;
  intakeWarning?: boolean;
  duplicateMatchId?: number;
};

export function enrichInquiriesWithSmartMeta(
  rows: any[],
  smart: SmartConfigFull,
  ctx: {
    now: number;
    programStats: Record<string, { enrolled: number; seats: number | null }>;
  },
): any[] {
  const dormantDays = smart.dormantLeads.enabled ? smart.dormantLeads.thresholdDays : null;
  return rows.map((i) => {
    const smartMeta: InquirySmartMeta = {};
    if (dormantDays != null && i.updatedAt) {
      const days = (ctx.now - new Date(i.updatedAt).getTime()) / 86400000;
      if (days >= dormantDays) smartMeta.dormant = true;
    }
    if (smart.intakeCapacity.enabled && i.programOfInterest) {
      const st = ctx.programStats[String(i.programOfInterest)];
      if (st?.seats != null && st.seats > 0) {
        const pct = Math.round((st.enrolled / st.seats) * 100);
        smartMeta.intakeFillPercent = pct;
        if (pct >= smart.intakeCapacity.warnAtPercent) smartMeta.intakeWarning = true;
      }
    }
    const keys = Object.keys(smartMeta).filter((k) => (smartMeta as any)[k] !== undefined);
    if (keys.length === 0) return i;
    return { ...i, smartMeta };
  });
}
