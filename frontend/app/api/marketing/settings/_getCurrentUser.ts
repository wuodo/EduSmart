import { NextRequest } from 'next/server';

const BACKEND = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const BASE = (BACKEND as string).replace(/\/+$/, '').replace(/\/api$/, '');

export async function getCurrentUser(req: NextRequest): Promise<{ email: string; role: string } | null> {
  try {
    const cookie = req.headers.get('cookie') || '';
    const tenant = req.headers.get('x-tenant') || req.cookies.get('tenant')?.value || '';
    const res = await fetch(`${BASE}/api/users/me`, {
      cache: 'no-store',
      headers: {
        cookie,
        ...(tenant ? { 'x-tenant': tenant } : {}),
      },
    });
    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    const email = user?.email || '';
    const role = user?.role || '';
    return email ? { email, role } : null;
  } catch {
    return null;
  }
}
