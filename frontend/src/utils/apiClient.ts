export type ApiOptions = RequestInit & { rawUrl?: boolean };

function attachHeaders(init?: RequestInit): HeadersInit {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return headers;
}

export async function apiFetch(path: string, options?: ApiOptions): Promise<Response> {
  const base = options?.rawUrl ? '' : '/api/proxy';
  const url = `${base}${path}`;
  const init: RequestInit = {
    ...options,
    headers: attachHeaders(options),
  };
  return fetch(url, init);
}

// ---------------------------------------------------------------------------
// cachedApiFetch — in-memory TTL cache for GET requests.
// Multiple components calling the same endpoint within the TTL window share
// one real network request instead of each making their own.
// ---------------------------------------------------------------------------
interface CacheEntry { data: unknown; expiresAt: number }
const _apiCache = new Map<string, CacheEntry>();

export async function cachedApiFetch(path: string, ttlMs = 30_000): Promise<Response> {
  const hit = _apiCache.get(path);
  if (hit && Date.now() < hit.expiresAt) {
    return new Response(JSON.stringify(hit.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const res = await apiFetch(path, { cache: 'no-store' });
  if (res.ok) {
    const data = await res.clone().json().catch(() => null);
    if (data !== null) {
      _apiCache.set(path, { data, expiresAt: Date.now() + ttlMs });
    }
  }
  return res;
}

/** Call after mutations (e.g. branding save) to force fresh data on next fetch. */
export function invalidateCache(path: string): void {
  _apiCache.delete(path);
}

