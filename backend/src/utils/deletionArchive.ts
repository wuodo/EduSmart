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

function loadEntries(): DeletionArchiveEntry[] {
  try {
    if (!fs.existsSync(ARCHIVE_PATH)) return [];
    const raw = fs.readFileSync(ARCHIVE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: DeletionArchiveEntry[]) {
  fs.mkdirSync(path.dirname(ARCHIVE_PATH), { recursive: true });
  fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

export function archiveDeletedRecord(input: Omit<DeletionArchiveEntry, 'archiveId' | 'deletedAt'>): DeletionArchiveEntry {
  const entries = loadEntries();
  const entry: DeletionArchiveEntry = {
    archiveId: `arc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deletedAt: new Date().toISOString(),
    ...input,
  };
  entries.unshift(entry);
  if (entries.length > 10000) entries.splice(10000);
  saveEntries(entries);
  return entry;
}

export function getArchivedRecord(archiveId: string): DeletionArchiveEntry | null {
  const entries = loadEntries();
  return entries.find((e) => e.archiveId === archiveId) || null;
}

export function listArchivedRecords(limit = 200): DeletionArchiveEntry[] {
  return loadEntries().slice(0, Math.max(1, Math.min(2000, limit)));
}
