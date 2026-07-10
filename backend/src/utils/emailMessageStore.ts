import fs from 'fs';
import path from 'path';

export type EmailMessage = {
  id: string;
  tenantId: number | null;
  inquiryId?: number;
  direction: 'outgoing' | 'incoming';
  from: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  status: 'sent' | 'failed' | 'received';
  reference?: string;
  attachmentUrl?: string;
  createdAt: string;
  readAt?: string;
  archived?: boolean;
  deleted?: boolean;
  parentId?: string;
};

type EmailStore = {
  messages: EmailMessage[];
};

const STORE_PATH = path.join(__dirname, '../../data/emailMessages.json');

function loadStore(): EmailStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as EmailStore;
    }
  } catch {}
  return { messages: [] };
}

function saveStore(store: EmailStore) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

export function addMessage(msg: Omit<EmailMessage, 'id' | 'createdAt'>): EmailMessage {
  const store = loadStore();
  const entry: EmailMessage = { ...msg, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString() };
  store.messages.push(entry);
  saveStore(store);
  return entry;
}

export function getMessages(tenantId?: number | null, inquiryId?: number, includeArchived = false, limit = 200): EmailMessage[] {
  const store = loadStore();
  let msgs = store.messages;
  if (tenantId) msgs = msgs.filter(m => m.tenantId === tenantId);
  if (inquiryId) msgs = msgs.filter(m => m.inquiryId === inquiryId);
  if (!includeArchived) msgs = msgs.filter(m => !m.archived && !m.deleted);
  return msgs.slice(-limit).reverse();
}

export function getMessageById(id: string): EmailMessage | undefined {
  return loadStore().messages.find(m => m.id === id);
}

export function markAsRead(messageId: string) {
  const store = loadStore();
  const msg = store.messages.find(m => m.id === messageId);
  if (msg && !msg.readAt) { msg.readAt = new Date().toISOString(); saveStore(store); }
}

export function markAsArchived(messageId: string, archived: boolean) {
  const store = loadStore();
  const msg = store.messages.find(m => m.id === messageId);
  if (msg) { msg.archived = archived; saveStore(store); }
}

export function markAsDeleted(messageId: string) {
  const store = loadStore();
  const msg = store.messages.find(m => m.id === messageId);
  if (msg) { msg.deleted = true; saveStore(store); }
}

export function getUnreadCount(tenantId?: number | null): number {
  const store = loadStore();
  return store.messages.filter(m => m.direction === 'incoming' && !m.readAt && !m.deleted && !m.archived && (!tenantId || m.tenantId === tenantId)).length;
}
