/**
 * Per-tenant CRM extensions (stored on Tenant.crmSettings JSON).
 */
export type TenantCrmWebhook = {
  id: string
  url: string
  secret: string
  events: string[]
  active: boolean
}

export type TenantFeatureToggles = {
  autoSendLetters?: boolean;
  enableESignature?: boolean;
}

export type TenantSmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export type TenantCrmSettings = {
  /** Outbound webhooks (tenant-scoped; separate from global cpanel webhooks) */
  webhooks?: TenantCrmWebhook[]
  /** Emails in order for new-inquiry round-robin assignment */
  roundRobinEmails?: string[]
  /** Last index used for round-robin (persisted so restarts continue rotation) */
  roundRobinCursor?: number
  /** Multi-step sequence definitions (stored JSON; worker may execute later) */
  sequences?: Array<{
    id: string
    name: string
    steps: Array<{ delayDays: number; action: string; payload?: Record<string, unknown> }>
  }>
  /** Suggested data retention in days for exports / purge jobs (policy only) */
  dataRetentionDays?: number
  /** Calendar integration placeholders */
  integrations?: {
    googleCalendar?: { enabled: boolean; calendarId?: string }
    microsoftCalendar?: { enabled: boolean }
    smsProvider?: { name: string; config?: Record<string, unknown> }
    whatsappProvider?: { name: string; config?: Record<string, unknown> }
  }
  /** Last run metadata for scheduled jobs (display-only) */
  scheduledJobsMeta?: Array<{ id: string; label: string; lastRunAt?: string; nextRunAt?: string; status?: string }>
  /** Per-tenant SMTP configuration for sending emails as this tenant */
  smtpConfig?: TenantSmtpConfig
  /** Feature toggles for auto-send, e-signature, etc. */
  featureToggles?: TenantFeatureToggles
  /** Custom pipeline stages (ordered) */
  pipelineStages?: string[]
  /** Stage-gate validation rules: required fields per transition */
  stageGateRules?: Array<{ from: string; to: string; requiredFields: string[] }>
}

export function mergeTenantCrmSettings(raw: unknown): TenantCrmSettings {
  const r = raw && typeof raw === 'object' ? (raw as TenantCrmSettings) : {}
  return {
    webhooks: Array.isArray(r.webhooks) ? r.webhooks : [],
    roundRobinEmails: Array.isArray(r.roundRobinEmails) ? r.roundRobinEmails.filter(Boolean) : [],
    roundRobinCursor: typeof r.roundRobinCursor === 'number' ? r.roundRobinCursor : 0,
    sequences: Array.isArray(r.sequences) ? r.sequences : [],
    dataRetentionDays: typeof r.dataRetentionDays === 'number' ? r.dataRetentionDays : undefined,
    integrations: r.integrations && typeof r.integrations === 'object' ? r.integrations : {},
    scheduledJobsMeta: Array.isArray(r.scheduledJobsMeta) ? r.scheduledJobsMeta : [],
    smtpConfig: r.smtpConfig && typeof r.smtpConfig === 'object' ? r.smtpConfig as TenantSmtpConfig : undefined,
    featureToggles: r.featureToggles && typeof r.featureToggles === 'object' ? r.featureToggles as TenantFeatureToggles : undefined,
    pipelineStages: Array.isArray(r.pipelineStages) ? r.pipelineStages : undefined,
    stageGateRules: Array.isArray(r.stageGateRules) ? r.stageGateRules : [
      { from: 'new', to: 'contacted', requiredFields: ['email', 'phone'] },
      { from: 'contacted', to: 'qualified', requiredFields: ['kcseGrade', 'programOfInterest'] },
      { from: 'qualified', to: 'proposal', requiredFields: ['intakePeriod', 'studyMode'] },
    ],
  }
}

export function validateSmtpConfig(cfg: unknown): TenantSmtpConfig | null {
  if (!cfg || typeof cfg !== 'object') return null
  const c = cfg as Record<string, unknown>
  if (!c.host || !c.user || !c.pass) return null
  return {
    host: String(c.host),
    port: Number(c.port) || 587,
    secure: c.secure === true || String(c.secure) === 'true',
    user: String(c.user),
    pass: String(c.pass),
    from: String(c.from || c.user),
  }
}

export function pickNextRoundRobinEmail(emails: string[], cursor: number): { email: string; nextCursor: number } {
  const list = emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  if (list.length === 0) return { email: '', nextCursor: cursor }
  const idx = Math.abs(cursor) % list.length
  return { email: list[idx], nextCursor: idx + 1 }
}
