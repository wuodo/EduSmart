import fs from 'fs';
import path from 'path';

export type QaItem = {
  id: string;
  tenantId: number | null;
  type: 'inquiry' | 'admission_letter' | 'followup';
  refId: number;
  refName: string;
  score: number;
  flags: string[];
  status: 'pending' | 'approved' | 'rejected';
  assignedTo?: string;
  reviewedBy?: string;
  reviewComment?: string;
  reviewedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Store = { items: QaItem[] };
const STORE_PATH = path.join(__dirname, '../../data/qa-items.json');

function load(): Store {
  try { if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch {}
  return { items: [] };
}

function save(s: Store) {
  try { fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true }); fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8'); } catch {}
}

export function listQaItems(tenantId?: number | null, type?: string, status?: string): QaItem[] {
  const s = load();
  let items = s.items;
  if (tenantId) items = items.filter(i => i.tenantId === tenantId);
  if (type) items = items.filter(i => i.type === type);
  if (status) items = items.filter(i => i.status === status);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getQaItem(id: string): QaItem | undefined {
  return load().items.find(i => i.id === id);
}

export function createQaItem(data: Omit<QaItem, 'id' | 'createdAt' | 'updatedAt'>): QaItem {
  const s = load();
  const now = new Date().toISOString();
  const entry: QaItem = { ...data, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: now, updatedAt: now };
  s.items.push(entry);
  save(s);
  return entry;
}

export function updateQaItem(id: string, data: Partial<QaItem>): QaItem | null {
  const s = load();
  const idx = s.items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  s.items[idx] = { ...s.items[idx], ...data, updatedAt: new Date().toISOString() };
  save(s);
  return s.items[idx];
}

export function deleteQaItem(id: string): boolean {
  const s = load();
  const len = s.items.length;
  s.items = s.items.filter(i => i.id !== id);
  if (s.items.length === len) return false;
  save(s);
  return true;
}

export function getQaStats(tenantId?: number | null) {
  const items = load().items.filter(i => !tenantId || i.tenantId === tenantId);
  return {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
    byType: {
      inquiry: items.filter(i => i.type === 'inquiry').length,
      admission_letter: items.filter(i => i.type === 'admission_letter').length,
      followup: items.filter(i => i.type === 'followup').length,
    },
  };
}
