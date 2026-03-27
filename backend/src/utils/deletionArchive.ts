import fs from 'fs';
import path from 'path';

export type DeletionArchiveType = 'inquiry' | 'followup';

export type DeletionArchiveEntry = {
  archiveId: string;
  type: DeletionArchiveType;
  tenantId: number | null;
  deletedAt: string;
  deletedBy: string;
  reason?: string;
  payload: any;
};

const ARCHIVE_PATH = path.join(__dirname, '../../data/deletion-archive.json');
const MAX_ENTRIES = 500;

// In-process cache — loaded once on first access, never re-read from disk on each call.
let _cache: DeletionArchiveEntry[] | null = null;

function getCache(): DeletionArchiveEntry[] {
  if (_cache !== null) return _cache;
  try {
    if (!fs.existsSync(ARCHIVE_PATH)) { _cache = []; return _cache; }
    const parsed = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
    _cache = Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

function persistAsync(entries: DeletionArchiveEntry[]) {
  try {
    fs.mkdirSync(path.dirname(ARCHIVE_PATH), { recursive: true });
    fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(entries), 'utf8');
  } catch { /* non-critical */ }
}

export function archiveDeletedRecord(input: Omit<DeletionArchiveEntry, 'archiveId' | 'deletedAt'>): DeletionArchiveEntry {
  const entries = getCache();
  const entry: DeletionArchiveEntry = {
    archiveId: `arc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deletedAt: new Date().toISOString(),
    ...input,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);
  // Persist asynchronously — don't block the request
  setImmediate(() => persistAsync(entries));
  return entry;
}

export function getArchivedRecord(archiveId: string): DeletionArchiveEntry | null {
  return getCache().find((e) => e.archiveId === archiveId) || null;
}

export function listArchivedRecords(limit = 200): DeletionArchiveEntry[] {
  return getCache().slice(0, Math.max(1, Math.min(MAX_ENTRIES, limit)));
}
