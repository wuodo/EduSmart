import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000';

// Local cache used by UI (fallback)
let permissions = {
  roles: [
    { name: 'admin', permissions: ['all'] },
    { name: 'senior_staff', permissions: ['view', 'edit', 'export','delete'] },
    { name: 'admissions_officer', permissions: ['view'] },
    { name: 'viewer', permissions: ['view'] },
  ],
  modules: {
    inquiries: ['admin', 'senior_staff', 'admissions_officer', 'viewer'],
    reports: ['admin', 'senior_staff'],
    settings: ['admin','senior_staff'],
    students: ['admin', 'senior_staff', 'admissions_officer'],
    followups: ['admin','senior_staff','admissions_officer'],
    admission_letters: ['admin','senior_staff','admissions_officer'],
    registrations: ['admin','senior_staff','admissions_officer'],
    campaigns: ['admin','senior_staff']
  },
};

function fwdHeaders(req: NextRequest) {
  const h: Record<string,string> = {}
  const cookie = req.headers.get('cookie');
  const tenant = req.headers.get('x-tenant');
  if (cookie) h['cookie'] = cookie;
  if (tenant) h['x-tenant'] = tenant;
  return h;
}

export async function GET(req: NextRequest) {
  try {
    // Prefer backend persisted model
    const res = await fetch(`${BACKEND}/api/permissions`, { headers: fwdHeaders(req), cache: 'no-store' });
    if (res.ok) {
      const model = await res.json();
      return NextResponse.json(model);
    }
  } catch {}
  // Fallback to local cache
  return NextResponse.json(permissions);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  if (data.roles) permissions.roles = data.roles;
  if (data.modules) permissions.modules = data.modules;

  // Forward to backend to persist permissions so RBAC uses them
  try {
    await fetch(`${BACKEND}/api/import/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...fwdHeaders(req) },
      body: JSON.stringify(permissions)
    });
  } catch {}

  return NextResponse.json({ success: true, permissions });
} 