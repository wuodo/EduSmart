import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

export type Plan = { id: string; name: string; limits: { users?: number; storageMB?: number; apiCallsPerDay?: number }; priceUSD?: number };
export type FeatureFlags = { [flag: string]: boolean };
export type TenantFlags = { [tenantId: string]: FeatureFlags };
export type Announcements = { id: string; title: string; body: string; createdAt: string; audience: 'all' | 'tenant' | 'role'; tenantId?: number; role?: string }[];
export type ApiKey = { id: string; label: string; hashed: string; createdAt: string; lastUsedAt?: string | null; tenantId?: number | null };
export type Webhook = { id: string; tenantId?: number | null; url: string; secret: string; events: string[]; active: boolean; createdAt: string };
export type TenantSettings = { [tenantId: string]: { planId?: string; limitsOverride?: { users?: number; storageMB?: number; apiCallsPerDay?: number }; flags?: FeatureFlags } };
export type MpesaConfig = { sandbox: boolean; shortcode?: string; tillNumber?: string; callbackBaseUrl?: string };
export type TenantInvoice = { id: string; tenantId: number; planId?: string; amount: number; status: 'pending' | 'paid' | 'failed'; createdAt: string; paidAt?: string | null; ref?: string };

// Security & Access
export type IpPolicy = { allow?: string[]; deny?: string[] };
export type PasswordPolicy = { minLength?: number; requireUpper?: boolean; requireNumber?: boolean; requireSymbol?: boolean };
export type TwoFAPolicy = { enforced?: boolean; methods?: ('totp' | 'sms')[] };
export type SsoPolicy = { enabled?: boolean; saml?: { entityId?: string; ssoUrl?: string; certificate?: string } | null };
export type ScimSettings = { enabled?: boolean; baseUrl?: string; token?: string };

// Billing Extras
export type Coupon = { id: string; code: string; amountOff?: number; percentOff?: number; validUntil?: string | null; maxRedemptions?: number | null; redemptions?: number };
export type Credit = { id: string; tenantId: number; amount: number; reason?: string; createdAt: string };

// Backups & Maintenance
export type BackupSchedule = { enabled: boolean; cron?: string; emailEnabled?: boolean; emailTo?: string };
export type MaintenanceFlags = { readOnly?: boolean; killSwitchTenants?: number[] };

// Providers & Templates
export type ProviderSettings = { email?: { provider?: 'smtp' | 'resend' | 'sendgrid'; from?: string; config?: Record<string, unknown> }; sms?: { provider?: 'twilio' | 'africas_talking' | 'mock'; from?: string; config?: Record<string, unknown> } };
export type Template = { id: string; type: 'letter' | 'notification' | 'followup_script'; name: string; content: string; updatedAt: string };

// Support & Observability
export type SupportTicket = { id: string; tenantId?: number | null; title: string; body: string; status: 'open' | 'closed'; createdAt: string; updatedAt?: string };
export type ObservabilityStats = { last24hErrors?: number; slowQueries?: number; queueDepth?: number; mailDelivered?: number; smsDelivered?: number };

// Limits & Release & Incidents
export type GlobalLimits = { apiPerDay?: number; storageMB?: number; users?: number };
export type TenantLimitsOverride = { [tenantId: string]: { apiPerDay?: number; storageMB?: number; users?: number } };
export type ReleaseControl = { enabled?: boolean; canaryPercent?: number; targetedTenants?: number[] };
export type Incident = { id: string; title: string; body?: string; status: 'open' | 'monitoring' | 'closed'; createdAt: string; closedAt?: string | null };

// Governance & Compliance
export type CustomRole = { name: string; permissions: string[]; description?: string };
export type RbacConfig = { roles: CustomRole[] };
export type RetentionPolicy = { entity: string; days: number };
export type LegalHold = { id: string; subject: string; reason?: string; active: boolean; createdAt: string };

// Security additions
export type SecretsMeta = { items: { id: string; name: string; lastRotatedAt?: string | null }[] };
export type GeoPolicy = { allowedCountries?: string[]; blockedCountries?: string[] };
export type PasswordlessPolicy = { enabled?: boolean; methods?: ('webauthn' | 'magic_link')[] };

// Billing advanced
export type TaxSettings = { enabled?: boolean; vatPercent?: number };
export type OveragePolicy = { autoUpgrade?: boolean; graceDays?: number };

// Domains & SLAs
export type DomainItem = { tenantId: number; domain: string; status: 'pending' | 'verified' | 'invalid' };
export type SlaPerPlan = { [planId: string]: { responseMins?: number; resolutionMins?: number } };
export type HealthScores = { [tenantId: string]: number };

// Data quality & platform
export type DataQualityRule = { entity: string; field: string; required?: boolean; unique?: boolean };
export type PlatformSettings = { localization?: { defaultLocale?: string; timeZone?: string }; files?: { maxMB?: number; allowedMime?: string[]; antivirus?: boolean } };

export type CpanelConfig = {
	plans: Plan[];
	flags: { global: FeatureFlags; perTenant: TenantFlags };
	announcements: Announcements;
	apiKeys: ApiKey[];
	webhooks: Webhook[];
	tenantSettings: TenantSettings;
	billing?: { mpesa?: MpesaConfig; invoices?: TenantInvoice[]; coupons?: Coupon[]; credits?: Credit[] };
	security?: { ip?: IpPolicy; password?: PasswordPolicy; twoFA?: TwoFAPolicy; sso?: SsoPolicy; scim?: ScimSettings };
	backups?: { schedule?: BackupSchedule };
	maintenance?: MaintenanceFlags;
	providers?: ProviderSettings;
	templates?: Template[];
	support?: { tickets: SupportTicket[] };
	observability?: ObservabilityStats;
	limits?: { global?: GlobalLimits; perTenant?: TenantLimitsOverride };
	release?: ReleaseControl;
	incidents?: Incident[];
	rbac?: RbacConfig;
	retention?: RetentionPolicy[];
	legalHolds?: LegalHold[];
	secrets?: SecretsMeta;
	geo?: GeoPolicy;
	passwordless?: PasswordlessPolicy;
	tax?: TaxSettings;
	overage?: OveragePolicy;
	domains?: { items: DomainItem[] };
	sla?: { perPlan: SlaPerPlan };
	healthScores?: HealthScores;
	dataQuality?: { rules: DataQualityRule[] };
	platform?: PlatformSettings;
};

const STORE_PATH = path.join(__dirname, '../../data/cpanel.json');

let cache: CpanelConfig | null = null;
let mtime = 0;

function defaults(): CpanelConfig {
	return {
		plans: [
			{ id: 'free', name: 'Free', limits: { users: 5, storageMB: 500, apiCallsPerDay: 5000 }, priceUSD: 0 },
			{ id: 'pro', name: 'Pro', limits: { users: 100, storageMB: 20000, apiCallsPerDay: 100000 }, priceUSD: 49 },
		],
		flags: { global: {}, perTenant: {} },
		announcements: [],
		apiKeys: [],
		webhooks: [],
		tenantSettings: {},
		billing: { mpesa: { sandbox: true }, invoices: [], coupons: [], credits: [] },
		security: { ip: { allow: [], deny: [] }, password: { minLength: 8, requireUpper: true, requireNumber: true, requireSymbol: false }, twoFA: { enforced: false, methods: ['totp'] }, sso: { enabled: false, saml: null }, scim: { enabled: false } },
		backups: { schedule: { enabled: false, cron: '0 3 * * *' } },
		maintenance: { readOnly: false, killSwitchTenants: [] },
		providers: { email: { provider: 'smtp', from: '', config: {} }, sms: { provider: 'mock', from: '', config: {} } },
		templates: [],
		support: { tickets: [] },
		observability: { last24hErrors: 0, slowQueries: 0, queueDepth: 0, mailDelivered: 0, smsDelivered: 0 },
		limits: { global: { apiPerDay: 100000, storageMB: 20000, users: 100 }, perTenant: {} },
		release: { enabled: false, canaryPercent: 0, targetedTenants: [] },
		incidents: [],
		rbac: { roles: [] },
		retention: [],
		legalHolds: [],
		secrets: { items: [] },
		geo: { allowedCountries: [], blockedCountries: [] },
		passwordless: { enabled: false, methods: ['webauthn'] },
		tax: { enabled: false, vatPercent: 0 },
		overage: { autoUpgrade: false, graceDays: 7 },
		domains: { items: [] },
		sla: { perPlan: {} },
		healthScores: {},
		dataQuality: { rules: [] },
		platform: { localization: { defaultLocale: 'en', timeZone: 'UTC' }, files: { maxMB: 20, allowedMime: ['image/png','image/jpeg','application/pdf'], antivirus: false } }
	};
}

export function loadCpanel(): CpanelConfig {
	try {
		if (fs.existsSync(STORE_PATH)) {
			const stat = fs.statSync(STORE_PATH);
			if (!cache || stat.mtimeMs !== mtime) {
				cache = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as CpanelConfig;
				mtime = stat.mtimeMs;
			}
			return cache!;
		}
	} catch {}
	cache = defaults();
	return cache;
}

export function saveCpanel(cfg: CpanelConfig) {
	try {
		// Write to DB in background and mirror to file
		;(async () => {
			try {
				await (prisma as any).cpanelConfig.upsert({ where: { id: 1 }, update: { data: cfg as any }, create: { id: 1, data: cfg as any } });
			} catch {}
		})()
		fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
		fs.writeFileSync(STORE_PATH, JSON.stringify(cfg, null, 2));
		cache = cfg;
		mtime = Date.now();
	} catch {}
}

export async function loadCpanelFromDb(): Promise<CpanelConfig> {
	try {
		const row = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
		if (row?.data) return row.data as CpanelConfig;
	} catch {}
	return loadCpanel();
}

export async function saveCpanelToDb(cfg: CpanelConfig): Promise<void> {
	try {
		await (prisma as any).cpanelConfig.upsert({ where: { id: 1 }, update: { data: cfg as any }, create: { id: 1, data: cfg as any } });
	} catch {}
	saveCpanel(cfg);
}

// Bootstrap: ensure DB row exists and mirrors current file defaults on startup
;(async () => {
  try {
    const existing = await (prisma as any).cpanelConfig.findUnique({ where: { id: 1 } });
    if (!existing) {
      const initial = loadCpanel();
      await (prisma as any).cpanelConfig.create({ data: { id: 1, data: initial as any } });
    }
  } catch {}
})();
