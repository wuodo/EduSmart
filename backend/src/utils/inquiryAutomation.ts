import prisma from '../lib/prisma';
import { loadCpanelFromDb, saveCpanelToDb } from './cpanelStore';

export type AutomationRule = {
  id: string;
  enabled: boolean;
  trigger: 'inquiry_created';
  when?: {
    /** Match if inquiry status is one of these (case-insensitive) */
    statusIn?: string[];
    /** Match if source equals (case-insensitive) */
    sourceEquals?: string;
  };
  action: {
    type: 'create_followup';
    followupType: string;
    daysFromNow: number;
    notes?: string;
  };
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
    {
      id: 'hot-followup',
      enabled: true,
      trigger: 'inquiry_created',
      when: { statusIn: ['hot'] },
      action: {
        type: 'create_followup',
        followupType: 'call',
        daysFromNow: 2,
        notes: 'Automatic reminder: contact hot lead',
      },
    },
    {
      id: 'whatsapp-source',
      enabled: false,
      trigger: 'inquiry_created',
      when: { sourceEquals: 'whatsapp' },
      action: {
        type: 'create_followup',
        followupType: 'whatsapp',
        daysFromNow: 1,
        notes: 'Automatic reminder: WhatsApp source lead',
      },
    },
  ],
  log: [],
};

function mergeAutomation(raw: unknown): AutomationConfig {
  const r = raw && typeof raw === 'object' ? (raw as AutomationConfig) : null;
  return {
    enabled: !!r?.enabled,
    rules: Array.isArray(r?.rules) && r.rules.length > 0 ? r.rules : DEFAULT_AUTOMATION.rules,
    log: Array.isArray(r?.log) ? r.log.slice(0, 100) : [],
  };
}

export async function loadAutomationConfig(): Promise<AutomationConfig> {
  const cfg = await loadCpanelFromDb();
  return mergeAutomation((cfg as any).automationConfig);
}

/**
 * Run rules when a new inquiry is created. Creates pending follow-ups via Prisma (does not touch firstResponseAt).
 */
export async function runInquiryCreatedAutomations(
  inquiry: {
    id: number;
    fullName: string;
    status?: string | null;
    source?: string | null;
    assignedTo?: string | null;
    createdBy?: string | null;
  },
  tenantId: number,
): Promise<void> {
  const cfg = await loadCpanelFromDb();
  const auto = mergeAutomation((cfg as any).automationConfig);
  if (!auto.enabled) return;

  const entries: AutomationLogEntry[] = [];
  const assignee = inquiry.assignedTo || inquiry.createdBy || undefined;

  for (const rule of auto.rules) {
    if (!rule.enabled) continue;
    if (rule.trigger !== 'inquiry_created') continue;
    const when = rule.when || {};
    if (when.statusIn?.length) {
      const st = String(inquiry.status || '').toLowerCase();
      if (!when.statusIn.map((s) => String(s).toLowerCase()).includes(st)) continue;
    }
    if (when.sourceEquals) {
      if (String(inquiry.source || '').toLowerCase() !== String(when.sourceEquals).toLowerCase()) continue;
    }
    const act = rule.action;
    if (!act || act.type !== 'create_followup') continue;

    const days = Math.max(0, Number(act.daysFromNow) || 1);
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + days);
    const notes = `${act.notes || 'Automated follow-up'} [automation:${rule.id}]`;

    try {
      await prisma.followup.create({
        data: {
          inquiryId: inquiry.id,
          inquiryName: inquiry.fullName,
          tenantId,
          type: act.followupType || 'call',
          scheduledFor,
          status: 'pending',
          assignedTo: assignee,
          notes,
          createdBy: assignee || null,
        },
      });
      entries.push({
        ts: new Date().toISOString(),
        ruleId: rule.id,
        inquiryId: inquiry.id,
        action: 'create_followup',
        ok: true,
      });
    } catch (e: any) {
      entries.push({
        ts: new Date().toISOString(),
        ruleId: rule.id,
        inquiryId: inquiry.id,
        action: 'create_followup',
        ok: false,
        message: e?.message || String(e),
      });
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
