import prisma from '../lib/prisma';
import { loadCpanelFromDb, saveCpanelToDb } from './cpanelStore';

export type AutomationTrigger = 'inquiry_created' | 'inquiry_status_changed' | 'followup_completed';

export type AutomationWhen = {
  statusIn?: string[];
  sourceEquals?: string;
  /** Previous status (inquiry_status_changed) */
  fromStatus?: string;
  /** New status (inquiry_status_changed) */
  toStatus?: string;
  /** Follow-up type (followup_completed) */
  followupTypeEquals?: string;
};

export type AutomationAction =
  | { type: 'create_followup'; followupType: string; daysFromNow: number; notes?: string }
  | { type: 'assign_inquiry'; assignTo: string }
  | { type: 'add_tags'; tags: string[] };

export type AutomationRule = {
  id: string;
  enabled: boolean;
  order: number;
  trigger: AutomationTrigger;
  when?: AutomationWhen;
  action: AutomationAction;
  /** Multi-step: additional actions executed in sequence after the primary action */
  subsequentActions?: AutomationAction[];
};

export type AutomationLogEntry = {
  ts: string;
  ruleId: string;
  inquiryId: number;
  action: string;
  ok: boolean;
  message?: string;
};

export type AutomationConfig = {
  enabled: boolean;
  rules: AutomationRule[];
  log: AutomationLogEntry[];
};

export const DEFAULT_AUTOMATION: AutomationConfig = {
  enabled: false,
  rules: [
    { id: 'hot-followup', enabled: true, order: 1, trigger: 'inquiry_created', when: { statusIn: ['hot'] }, action: { type: 'create_followup', followupType: 'call', daysFromNow: 2, notes: 'Automatic reminder: contact hot lead' } },
    { id: 'whatsapp-source', enabled: false, order: 2, trigger: 'inquiry_created', when: { sourceEquals: 'whatsapp' }, action: { type: 'create_followup', followupType: 'whatsapp', daysFromNow: 1, notes: 'Automatic reminder: WhatsApp source lead' } },
    { id: 'warm-to-hot-tags', enabled: false, order: 3, trigger: 'inquiry_status_changed', when: { fromStatus: 'warm', toStatus: 'hot' }, action: { type: 'add_tags', tags: ['priority-follow-up'] } },
    { id: 'call-done-next', enabled: false, order: 4, trigger: 'followup_completed', when: { followupTypeEquals: 'call' }, action: { type: 'create_followup', followupType: 'whatsapp', daysFromNow: 3, notes: 'Automatic: follow up after completed call' } },
  ],
  log: [],
};

export type InquiryAutomationContext = {
  id: number;
  fullName: string;
  status?: string | null;
  source?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  leadTags?: unknown /** Prisma Json */;
};

const TRIGGER_VALUES: AutomationTrigger[] = [
  'inquiry_created',
  'inquiry_status_changed',
  'followup_completed',
];

export function mergeAutomationConfig(raw: unknown): AutomationConfig {
  const r = raw && typeof raw === 'object' ? (raw as AutomationConfig) : null;
  const rules = Array.isArray(r?.rules) ? (r!.rules as AutomationRule[]) : DEFAULT_AUTOMATION.rules;
  return {
    enabled: !!r?.enabled,
    rules: rules.length > 0 ? normalizeRules(rules) : DEFAULT_AUTOMATION.rules,
    log: Array.isArray(r?.log) ? r!.log.slice(0, 100) : [],
  };
}

function mergeAutomation(raw: unknown): AutomationConfig {
  return mergeAutomationConfig(raw);
}

/** Migrate older saved rules missing trigger/action shapes */
function normalizeRules(rules: AutomationRule[]): AutomationRule[] {
  return rules.map((rule) => {
    const r: AutomationRule = { ...rule };
    if (!r.trigger || !TRIGGER_VALUES.includes(r.trigger)) {
      r.trigger = 'inquiry_created';
    }
    const a = r.action as any;
    if (!a?.type) {
      r.action = {
        type: 'create_followup',
        followupType: 'call',
        daysFromNow: 2,
        notes: 'Automated follow-up',
      };
    }
    return r;
  });
}

export async function loadAutomationConfig(): Promise<AutomationConfig> {
  const cfg = await loadCpanelFromDb();
  return mergeAutomation((cfg as any).automationConfig);
}

function norm(s: string | null | undefined) {
  return String(s || '').toLowerCase().trim();
}

function matchWhen(
  trigger: AutomationTrigger,
  when: AutomationWhen | undefined,
  ctx: {
    inquiry: InquiryAutomationContext;
    previousStatus?: string | null;
    followup?: { type: string };
  },
): boolean {
  const w = when || {};
  const st = norm(ctx.inquiry.status);
  const src = norm(ctx.inquiry.source);

  if (trigger === 'inquiry_created') {
    if (w.statusIn?.length && !w.statusIn.map((x) => norm(x)).includes(st)) return false;
    if (w.sourceEquals && norm(w.sourceEquals) !== src) return false;
    return true;
  }

  if (trigger === 'inquiry_status_changed') {
    const prev = norm(ctx.previousStatus);
    const next = st;
    if (prev === next) return false;
    if (w.fromStatus && norm(w.fromStatus) !== prev) return false;
    if (w.toStatus && norm(w.toStatus) !== next) return false;
    if (w.statusIn?.length && !w.statusIn.map((x) => norm(x)).includes(next)) return false;
    if (w.sourceEquals && norm(w.sourceEquals) !== src) return false;
    return true;
  }

  if (trigger === 'followup_completed') {
    const ft = norm(ctx.followup?.type);
    if (w.followupTypeEquals && norm(w.followupTypeEquals) !== ft) return false;
    if (w.statusIn?.length && !w.statusIn.map((x) => norm(x)).includes(st)) return false;
    if (w.sourceEquals && norm(w.sourceEquals) !== src) return false;
    return true;
  }

  return false;
}

function parseLeadTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function resolveAssignTo(token: string, inquiry: InquiryAutomationContext): string | null {
  const t = token.trim();
  if (t === '__creator__' || t === '__owner__') {
    return (inquiry.createdBy && String(inquiry.createdBy).trim()) || null;
  }
  if (t === '__assignee__') {
    return (inquiry.assignedTo && String(inquiry.assignedTo).trim()) || null;
  }
  return t || null;
}

async function executeAction(
  rule: AutomationRule,
  inquiry: InquiryAutomationContext,
  tenantId: number,
): Promise<{ ok: boolean; message?: string; actionLabel: string }> {
  const act = rule.action;
  const fallbackAssignee = inquiry.assignedTo || inquiry.createdBy || undefined;

  if (act.type === 'create_followup') {
    const days = Math.max(0, Number(act.daysFromNow) || 1);
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + days);
    const notes = `${act.notes || 'Automated follow-up'} [automation:${rule.id}]`;
    await prisma.followup.create({
      data: {
        inquiryId: inquiry.id,
        inquiryName: inquiry.fullName,
        tenantId,
        type: act.followupType || 'call',
        scheduledFor,
        status: 'pending',
        assignedTo: fallbackAssignee,
        notes,
        createdBy: fallbackAssignee || null,
      },
    });
    return { ok: true, actionLabel: 'create_followup' };
  }

  if (act.type === 'assign_inquiry') {
    const email = resolveAssignTo(act.assignTo, inquiry);
    if (!email) {
      return { ok: false, message: 'No assignee resolved', actionLabel: 'assign_inquiry' };
    }
    await prisma.inquiry.update({
      where: { id: inquiry.id, tenantId } as any,
      data: { assignedTo: email },
    });
    return { ok: true, actionLabel: 'assign_inquiry' };
  }

  if (act.type === 'add_tags') {
    const existing = parseLeadTags(inquiry.leadTags);
    const add = (act.tags || []).map((x) => String(x).trim()).filter(Boolean);
    const merged = Array.from(new Set([...existing, ...add]));
    await prisma.inquiry.update({
      where: { id: inquiry.id, tenantId } as any,
      data: { leadTags: merged },
    });
    return { ok: true, actionLabel: 'add_tags' };
  }

  return { ok: false, message: 'Unknown action', actionLabel: 'unknown' };
}

/**
 * Unified runner: match rules by trigger, execute actions, append log once.
 */
export async function runAutomations(
  trigger: AutomationTrigger,
  tenantId: number,
  ctx: {
    inquiry: InquiryAutomationContext;
    previousStatus?: string | null;
    followup?: { type: string };
  },
): Promise<void> {
  const cfg = await loadCpanelFromDb();
  const auto = mergeAutomation((cfg as any).automationConfig);
  if (!auto.enabled) return;

  const entries: AutomationLogEntry[] = [];
  let live: InquiryAutomationContext = { ...ctx.inquiry };

  const sortedRules = [...auto.rules].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  for (const rule of sortedRules) {
    if (!rule.enabled || rule.trigger !== trigger) continue;
    if (!matchWhen(trigger, rule.when, { ...ctx, inquiry: live })) continue;

    const actionsToExecute = [rule.action, ...(rule.subsequentActions || [])];
    for (const action of actionsToExecute) {
      try {
        const ruleWithAction = { ...rule, action };
        const result = await executeAction(ruleWithAction, live, tenantId);
        entries.push({
          ts: new Date().toISOString(),
          ruleId: rule.id,
          inquiryId: live.id,
          action: result.actionLabel,
          ok: result.ok,
          message: result.message,
        });
        if (
          result.ok &&
          (action.type === 'assign_inquiry' || action.type === 'add_tags')
        ) {
          const row = await prisma.inquiry.findFirst({ where: { id: live.id, tenantId } });
          if (row) {
            live = {
              id: row.id, fullName: row.fullName, status: row.status,
              source: row.source, assignedTo: row.assignedTo,
              createdBy: row.createdBy, leadTags: row.leadTags as unknown,
            };
          }
        }
      } catch (e: any) {
        entries.push({
          ts: new Date().toISOString(), ruleId: rule.id,
          inquiryId: live.id, action: (action as any)?.type || 'error',
          ok: false, message: e?.message || String(e),
        });
      }
    }
  }

  if (entries.length === 0) return;

  const newLog = [...entries, ...auto.log].slice(0, 100);
  await saveCpanelToDb({
    ...cfg,
    automationConfig: {
      ...auto,
      log: newLog,
    },
  } as any);
}

export async function runInquiryCreatedAutomations(
  inquiry: InquiryAutomationContext,
  tenantId: number,
): Promise<void> {
  return runAutomations('inquiry_created', tenantId, { inquiry });
}

export async function runInquiryStatusChangeAutomations(
  inquiry: InquiryAutomationContext,
  previousStatus: string | null | undefined,
  tenantId: number,
): Promise<void> {
  return runAutomations('inquiry_status_changed', tenantId, { inquiry, previousStatus });
}

export async function runFollowupCompletedAutomations(
  followup: { type: string },
  inquiry: InquiryAutomationContext,
  tenantId: number,
): Promise<void> {
  return runAutomations('followup_completed', tenantId, { inquiry, followup });
}
