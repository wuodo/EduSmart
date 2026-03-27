import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from './_auditStore';

function backendBase() {
  return (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '');
}

const DEFAULT_SETTINGS = {
  institution: { name: 'EduSmart College', logo: '', email: 'info@edusmart.edu', phone: '+1234567890', address: '123 Main St, City, Country' },
  passwordPolicy: { minLength: 8, requireSpecial: true, expiryDays: 90 },
};

export async function GET(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const res = await fetch(`${backendBase()}/api/marketing-settings`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {}
  return NextResponse.json(DEFAULT_SETTINGS);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const cookie = req.headers.get('cookie') || '';

    const backendRes = await fetch(`${backendBase()}/api/marketing-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(data),
    });

    const json = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(json, { status: backendRes.status });
    }

    // Mirror to audit log (best-effort)
    try {
      const { getCurrentUser } = await import('./_getCurrentUser');
      const currentUser = await getCurrentUser(req);
      addAuditLog({
        action: 'update_settings',
        module: 'settings',
        user: currentUser?.email || 'unknown',
        ip: req.headers.get('x-forwarded-for') || undefined,
        details: data,
      });
    } catch {}

    return NextResponse.json(json);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}