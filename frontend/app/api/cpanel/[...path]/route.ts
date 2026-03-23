import { NextRequest } from 'next/server';

const BASE = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function fwdHeaders(req: NextRequest) {
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  return Object.fromEntries(headers.entries());
}

async function proxy(req: NextRequest) {
  const pathParam = req.nextUrl.pathname.replace(/^\/api\/cpanel/, '');
  const url = `${BASE}/api/cpanel${pathParam}${req.nextUrl.search}`;
  const hasBody = !(req.method === 'GET' || req.method === 'HEAD');
  
  const init: RequestInit = {
    method: req.method,
    headers: fwdHeaders(req) as any,
    redirect: 'manual' as any,
    cache: 'no-store',
  };
  
  if (hasBody) {
    // Forward request body reliably (avoids intermittent JSON/body parsing quirks)
    const buf = await req.arrayBuffer();
    // Don't set an empty body
    if (buf.byteLength > 0) init.body = Buffer.from(buf);
  }
  
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';

    const respHeaders: Record<string, string> = { 'content-type': contentType.includes('application/json') ? 'application/json' : contentType };
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) respHeaders['set-cookie'] = setCookie;

    if (contentType.includes('application/json')) {
      const data = await res.json();
      return new Response(JSON.stringify(data), { status: res.status, headers: respHeaders });
    }

    const body = await res.text();
    return new Response(body, { status: res.status, headers: respHeaders });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy request failed' }), { 
      status: 500, 
      headers: { 'content-type': 'application/json' } 
    });
  }
}

export async function GET(req: NextRequest) { return proxy(req); }
export async function POST(req: NextRequest) { return proxy(req); }
export async function PUT(req: NextRequest) { return proxy(req); }
export async function DELETE(req: NextRequest) { return proxy(req); }


