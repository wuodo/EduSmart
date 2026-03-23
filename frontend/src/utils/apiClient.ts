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

