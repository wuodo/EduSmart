import crypto from 'crypto'

type Challenge = {
  id: string
  codeHash: string
  email: string
  tenantId: number | null
  role: 'tenant' | 'super_admin'
  deviceId: string
  ip: string
  expiresAt: number
  attempts: number
}

const TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const store = new Map<string, Challenge>()

function hashCode(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function createOtpChallenge(input: Omit<Challenge, 'id' | 'codeHash' | 'expiresAt' | 'attempts'>): { id: string; code: string } {
  const id = crypto.randomBytes(16).toString('hex')
  const code = String(Math.floor(100000 + Math.random() * 900000))
  store.set(id, {
    id,
    codeHash: hashCode(code),
    email: input.email.toLowerCase().trim(),
    tenantId: input.tenantId,
    role: input.role,
    deviceId: input.deviceId,
    ip: input.ip,
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  })
  return { id, code }
}

export function verifyOtpChallenge(id: string, code: string): { ok: boolean; reason?: string; challenge?: Challenge } {
  const c = store.get(id)
  if (!c) return { ok: false, reason: 'invalid' }
  if (Date.now() > c.expiresAt) {
    store.delete(id)
    return { ok: false, reason: 'expired' }
  }
  if (c.attempts >= MAX_ATTEMPTS) {
    store.delete(id)
    return { ok: false, reason: 'too_many_attempts' }
  }
  c.attempts += 1
  if (hashCode(code) !== c.codeHash) {
    return { ok: false, reason: 'invalid' }
  }
  store.delete(id)
  return { ok: true, challenge: c }
}

export function getChallenge(id: string): Challenge | null {
  const c = store.get(id)
  if (!c) return null
  if (Date.now() > c.expiresAt) {
    store.delete(id)
    return null
  }
  return c
}

