import fs from 'fs';
import path from 'path';

export type QuickReply = {
  id: string;
  tenantId: number | null;
  title: string;
  body: string;
  createdAt: string;
};

type Store = { replies: QuickReply[] };

const STORE_PATH = path.join(__dirname, '../../data/quickReplies.json');

function load(): Store {
  try { if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch {}
  return { replies: [] };
}

function save(s: Store) {
  try { fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true }); fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8'); } catch {}
}

export function getReplies(tenantId?: number | null): QuickReply[] {
  const s = load();
  return s.replies.filter(r => !tenantId || r.tenantId === tenantId);
}

export function addReply(title: string, body: string, tenantId?: number | null): QuickReply {
  const s = load();
  const entry: QuickReply = { id: Date.now().toString(36), tenantId: tenantId ?? null, title, body, createdAt: new Date().toISOString() };
  s.replies.push(entry);
  save(s);
  return entry;
}

export function updateReply(id: string, title: string, body: string): QuickReply | null {
  const s = load();
  const idx = s.replies.findIndex(r => r.id === id);
  if (idx === -1) return null;
  s.replies[idx] = { ...s.replies[idx], title, body };
  save(s);
  return s.replies[idx];
}

export function deleteReply(id: string): boolean {
  const s = load();
  const len = s.replies.length;
  s.replies = s.replies.filter(r => r.id !== id);
  if (s.replies.length === len) return false;
  save(s);
  return true;
}
