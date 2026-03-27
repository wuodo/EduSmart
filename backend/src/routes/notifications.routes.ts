import express from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { loadCpanelFromDb, saveCpanelToDb } from '../utils/cpanelStore';

type Audience = 'all' | 'role';

type BroadcastNotification = {
  id: string;
  title: string;
  body: string;
  priority: 'info' | 'warning' | 'critical';
  publishAt?: string;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  tenantId: number | null;
  audience: Audience;
  role?: string;
};

type NotificationStore = {
  broadcasts: BroadcastNotification[];
  reads: Record<string, string[] | Record<string, string>>;
};

const router = express.Router();
const STORE_PATH = path.join(__dirname, '../../data/notifications.json');

function loadStore(): NotificationStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as NotificationStore;
      return {
        broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : [],
        reads: parsed.reads && typeof parsed.reads === 'object' ? parsed.reads : {},
      };
    }
  } catch {}
  return { broadcasts: [], reads: {} };
}

function saveStore(store: NotificationStore) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

async function loadStoreFromDb(): Promise<NotificationStore> {
  try {
    const cfg = await loadCpanelFromDb();
    const data = (cfg as any).notifications as NotificationStore | undefined;
    if (data && Array.isArray(data.broadcasts)) return data;
  } catch {}
  return loadStore();
}

async function saveStoreToDb(store: NotificationStore): Promise<void> {
  try {
    const cfg = await loadCpanelFromDb();
    await saveCpanelToDb({ ...cfg, notifications: store } as any);
  } catch {}
  saveStore(store);
}

function toReadMap(entry: string[] | Record<string, string> | undefined): Record<string, string> {
  if (!entry) return {};
  if (Array.isArray(entry)) {
    const mapped: Record<string, string> = {};
    for (const id of entry) {
      if (id) mapped[String(id)] = '';
    }
    return mapped;
  }
  if (typeof entry === 'object') return { ...entry };
  return {};
}

function pruneStore(store: NotificationStore): boolean {
  let changed = false;
  const now = Date.now();
  const before = store.broadcasts.length;
  store.broadcasts = store.broadcasts.filter((n) => {
    if (!n.expiresAt) return true;
    const t = +new Date(n.expiresAt);
    if (!Number.isFinite(t)) return true;
    return t > now;
  });
  if (store.broadcasts.length !== before) changed = true;

  const validIds = new Set(store.broadcasts.map((n) => n.id));
  const normalizedReads: Record<string, Record<string, string>> = {};
  for (const [email, raw] of Object.entries(store.reads || {})) {
    const mapped = toReadMap(raw);
    const cleaned: Record<string, string> = {};
    for (const [id, ts] of Object.entries(mapped)) {
      if (validIds.has(id)) cleaned[id] = ts || '';
    }
    if (Object.keys(cleaned).length > 0) normalizedReads[email] = cleaned;
    if (JSON.stringify(raw) !== JSON.stringify(cleaned)) changed = true;
  }
  if (JSON.stringify(store.reads) !== JSON.stringify(normalizedReads)) changed = true;
  store.reads = normalizedReads;
  return changed;
}

function currentUser(req: any) {
  const email = String(req?.user?.email || '').trim().toLowerCase();
  const role = String(req?.user?.role || '').trim().toLowerCase();
  const tenantId = req?.tenant?.id ?? req?.user?.tenantId ?? null;
  return { email, role, tenantId };
}

function canReceive(n: BroadcastNotification, role: string, tenantId: number | null) {
  if (n.tenantId !== null && tenantId !== n.tenantId) return false;
  const now = Date.now();
  if (n.publishAt && Number.isFinite(+new Date(n.publishAt)) && +new Date(n.publishAt) > now) return false;
  if (n.expiresAt && Number.isFinite(+new Date(n.expiresAt)) && +new Date(n.expiresAt) <= now) return false;
  if (n.audience === 'all') return true;
  if (n.audience === 'role' && n.role) return String(n.role).toLowerCase() === role;
  return false;
}

router.get('/', async (req, res) => {
  const { email, role, tenantId } = currentUser(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const store = await loadStoreFromDb();
  if (pruneStore(store)) await saveStoreToDb(store);
  const readMap = toReadMap(store.reads[email]);
  const readSet = new Set(Object.keys(readMap));
  const items = store.broadcasts
    .filter((n) => canReceive(n, role, tenantId) && !readSet.has(n.id))
    .sort((a, b) => {
      const aTime = +(new Date(a.publishAt || a.createdAt));
      const bTime = +(new Date(b.publishAt || b.createdAt));
      return bTime - aTime;
    })
    .slice(0, 100)
    .map((n) => ({ ...n, read: false }));
  return res.json({ notifications: items });
});

router.get('/unread-count', async (req, res) => {
  const { email, role, tenantId } = currentUser(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const store = await loadStoreFromDb();
  if (pruneStore(store)) await saveStoreToDb(store);
  const readMap = toReadMap(store.reads[email]);
  const readSet = new Set(Object.keys(readMap));
  const count = store.broadcasts.filter((n) => canReceive(n, role, tenantId) && !readSet.has(n.id)).length;
  return res.json({ count });
});

router.get('/sent', async (req, res) => {
  const { email, role } = currentUser(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  if (!(role === 'admin' || role === 'senior_staff' || role === 'manager')) {
    return res.status(403).json({ error: 'Only admins, managers, or senior staff can view sent broadcasts' });
  }
  const store = await loadStoreFromDb();
  if (pruneStore(store)) await saveStoreToDb(store);
  const myBroadcasts = store.broadcasts
    .filter((n) => n.createdBy === email)
    .sort((a, b) => +(new Date(b.createdAt)) - +(new Date(a.createdAt)))
    .slice(0, 100);

  const audienceCache = new Map<string, Array<{ email: string; name: string | null }>>();
  const items = [];
  for (const n of myBroadcasts) {
    const cacheKey = `${n.tenantId ?? 'null'}|${n.audience}|${n.role || ''}`;
    let recipients = audienceCache.get(cacheKey);
    if (!recipients) {
      recipients = await prisma.user.findMany({
        where: {
          approved: true,
          tenantId: n.tenantId,
          ...(n.audience === 'role' && n.role ? { role: n.role as any } : {}),
        },
        select: { email: true, name: true },
      });
      audienceCache.set(cacheKey, recipients);
    }

    const readers = recipients
      .map((u) => {
        const e = String(u.email || '').toLowerCase();
        const readAt = toReadMap(store.reads[e])[n.id];
        if (!readAt && readAt !== '') return null;
        return {
          email: u.email,
          name: u.name || null,
          readAt: readAt || null,
        };
      })
      .filter(Boolean) as Array<{ email: string; name: string | null; readAt: string | null }>;

    items.push({
      ...n,
      recipientCount: recipients.length,
      readCount: readers.length,
      unreadCount: Math.max(0, recipients.length - readers.length),
      readers,
    });
  }

  return res.json({ notifications: items });
});

router.put('/:id/read', async (req, res) => {
  const { email } = currentUser(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing notification id' });
  const store = await loadStoreFromDb();
  const map = toReadMap(store.reads[email]);
  if (!map[id]) map[id] = new Date().toISOString();
  store.reads[email] = map;
  await saveStoreToDb(store);
  return res.json({ success: true });
});

router.put('/read-all', async (req, res) => {
  const { email, role, tenantId } = currentUser(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const store = await loadStoreFromDb();
  const ids = store.broadcasts.filter((n) => canReceive(n, role, tenantId)).map((n) => n.id);
  const map = toReadMap(store.reads[email]);
  const now = new Date().toISOString();
  for (const id of ids) {
    if (!map[id]) map[id] = now;
  }
  store.reads[email] = map;
  await saveStoreToDb(store);
  return res.json({ success: true, readCount: ids.length });
});

router.post('/broadcast', async (req: any, res) => {
  const { email, role, tenantId } = currentUser(req);
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  if (!(role === 'admin' || role === 'senior_staff' || role === 'manager')) {
    return res.status(403).json({ error: 'Only admins, managers, or senior staff can broadcast' });
  }

  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  const priorityRaw = String(req.body?.priority || 'info').trim().toLowerCase();
  const priority = (priorityRaw === 'warning' || priorityRaw === 'critical' ? priorityRaw : 'info') as 'info' | 'warning' | 'critical';
  const publishAtRaw = String(req.body?.publishAt || '').trim();
  const expiresAtRaw = String(req.body?.expiresAt || '').trim();
  const audience = (String(req.body?.audience || 'all').trim().toLowerCase() as Audience) || 'all';
  const targetRole = String(req.body?.role || '').trim().toLowerCase();
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  if (!(audience === 'all' || audience === 'role')) return res.status(400).json({ error: 'Invalid audience' });
  if (audience === 'role' && !targetRole) return res.status(400).json({ error: 'role required for role audience' });
  const publishAt = publishAtRaw ? new Date(publishAtRaw) : null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (publishAtRaw && Number.isNaN(+publishAt!)) return res.status(400).json({ error: 'Invalid publishAt' });
  if (expiresAtRaw && Number.isNaN(+expiresAt!)) return res.status(400).json({ error: 'Invalid expiresAt' });
  if (publishAt && expiresAt && +expiresAt <= +publishAt) return res.status(400).json({ error: 'expiresAt must be after publishAt' });

  const store = await loadStoreFromDb();
  pruneStore(store);
  const n: BroadcastNotification = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    priority,
    publishAt: publishAt ? publishAt.toISOString() : undefined,
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
    createdAt: new Date().toISOString(),
    createdBy: email,
    createdByName: String(req?.user?.name || '').trim() || undefined,
    tenantId: typeof tenantId === 'number' ? tenantId : null,
    audience,
    role: audience === 'role' ? targetRole : undefined,
  };
  store.broadcasts.unshift(n);
  if (store.broadcasts.length > 2000) store.broadcasts = store.broadcasts.slice(0, 2000);
  await saveStoreToDb(store);
  return res.status(201).json({ success: true, notification: n });
});

export default router;

