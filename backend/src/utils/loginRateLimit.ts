/**
 * In-memory login rate limiting to prevent brute-force attacks.
 * After MAX_ATTEMPTS failed attempts, locks the key for LOCKOUT_MS.
 * Keys are cleaned up periodically to avoid memory growth.
 */

// Disable rate limiting (prevents HTTP 429 lockouts during login).
// Override by setting DISABLE_LOGIN_RATE_LIMIT=false in the environment if needed.
const DISABLE_LOGIN_RATE_LIMIT =
  String(process.env.DISABLE_LOGIN_RATE_LIMIT ?? 'true').toLowerCase() === 'true'

const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

type Entry = { count: number; lockedUntil: number }

const store = new Map<string, Entry>()

function getKey(prefix: string, ip: string, identifier: string): string {
  const normalized = identifier.toLowerCase().trim()
  return `${prefix}:${ip}:${normalized}`
}

export function isLocked(prefix: string, ip: string, identifier: string): boolean {
  if (DISABLE_LOGIN_RATE_LIMIT) return false
  const key = getKey(prefix, ip, identifier)
  const entry = store.get(key)
  if (!entry) return false
  if (Date.now() < entry.lockedUntil) return true
  store.delete(key)
  return false
}

export function recordFailedAttempt(prefix: string, ip: string, identifier: string): void {
  if (DISABLE_LOGIN_RATE_LIMIT) return
  const key = getKey(prefix, ip, identifier)
  const now = Date.now()
  const existing = store.get(key)
  if (!existing) {
    store.set(key, { count: 1, lockedUntil: 0 })
    return
  }
  if (existing.lockedUntil > now) return // already locked
  existing.count += 1
  if (existing.count >= MAX_ATTEMPTS) {
    existing.lockedUntil = now + LOCKOUT_MS
  }
}

export function clearAttempts(prefix: string, ip: string, identifier: string): void {
  if (DISABLE_LOGIN_RATE_LIMIT) return
  store.delete(getKey(prefix, ip, identifier))
}

export function getRemainingLockoutMs(prefix: string, ip: string, identifier: string): number {
  const key = getKey(prefix, ip, identifier)
  const entry = store.get(key)
  if (!entry || entry.lockedUntil <= 0) return 0
  const remaining = entry.lockedUntil - Date.now()
  return remaining > 0 ? remaining : 0
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.lockedUntil > 0 && entry.lockedUntil < now) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)
