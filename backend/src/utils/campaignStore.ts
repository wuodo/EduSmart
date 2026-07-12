import fs from 'fs';
import path from 'path';

export type CampaignStep = {
  stepOrder: number;
  delayDays: number;
  type: 'email' | 'sms' | 'whatsapp' | 'call';
  content: Record<string, unknown>;
};

export type CampaignFilter = {
  statusIn?: string[];
  sourceEquals?: string;
  programEquals?: string;
  scoreMin?: number;
  scoreMax?: number;
  createdAfter?: string;
  createdBefore?: string;
};

export type Campaign = {
  id: string;
  tenantId: number | null;
  name: string;
  description?: string;
  type: 'email' | 'sms' | 'whatsapp' | 'sequence';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'completed' | 'paused' | 'failed';
  audience: CampaignFilter;
  content: Record<string, unknown>;
  scheduleAt?: string;
  completedAt?: string;
  sentCount: number;
  openedCount: number;
  repliedCount: number;
  bouncedCount: number;
  createdBy?: string;
  steps?: CampaignStep[];
  createdAt: string;
  updatedAt: string;
};

type Store = { campaigns: Campaign[] };
const STORE_PATH = path.join(__dirname, '../../data/campaigns.json');

function load(): Store {
  try { if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch {}
  return { campaigns: [] };
}

function save(s: Store) {
  try { fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true }); fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8'); } catch {}
}

export function listCampaigns(tenantId?: number | null): Campaign[] {
  const s = load();
  return s.campaigns.filter(c => !tenantId || c.tenantId === tenantId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getCampaign(id: string): Campaign | undefined {
  return load().campaigns.find(c => c.id === id);
}

export function createCampaign(data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'sentCount' | 'openedCount' | 'repliedCount' | 'bouncedCount'>): Campaign {
  const s = load();
  const now = new Date().toISOString();
  const entry: Campaign = {
    ...data, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sentCount: 0, openedCount: 0, repliedCount: 0, bouncedCount: 0,
    createdAt: now, updatedAt: now,
  };
  s.campaigns.push(entry);
  save(s);
  return entry;
}

export function updateCampaign(id: string, data: Partial<Campaign>): Campaign | null {
  const s = load();
  const idx = s.campaigns.findIndex(c => c.id === id);
  if (idx === -1) return null;
  s.campaigns[idx] = { ...s.campaigns[idx], ...data, updatedAt: new Date().toISOString() };
  save(s);
  return s.campaigns[idx];
}

export function deleteCampaign(id: string): boolean {
  const s = load();
  const len = s.campaigns.length;
  s.campaigns = s.campaigns.filter(c => c.id !== id);
  if (s.campaigns.length === len) return false;
  save(s);
  return true;
}
