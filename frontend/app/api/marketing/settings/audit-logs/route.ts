import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_API_URL || 'http://localhost:5000';

interface BackendAuditLog {
  id: number;
  action: string;
  module: string;
  user?: string;
  details?: any;
  createdAt: string;
}

interface FrontendAuditLog {
  id: string;
  timestamp: number;
  action: string;
  module: string;
  user?: string;
  ip?: string;
  details?: any;
}

function transformBackendToFrontend(log: BackendAuditLog): FrontendAuditLog {
  return {
    id: String(log.id),
    timestamp: new Date(log.createdAt).getTime(),
    action: log.action,
    module: log.module,
    user: log.user || log.details?.email || log.details?.user || undefined,
    ip: log.details?.ip || undefined,
    details: log.details
  };
}

function matches(log: FrontendAuditLog, q?: string, action?: string, user?: string, from?: number, to?: number) {
  if (q) {
    const text = `${log.action} ${log.module} ${log.user ?? ''} ${JSON.stringify(log.details ?? {})}`.toLowerCase();
    if (!text.includes(q.toLowerCase())) return false;
  }
  if (action && log.action !== action) return false;
  if (user && (log.user ?? '').toLowerCase() !== user.toLowerCase()) return false;
  if (from && log.timestamp < from) return false;
  if (to && log.timestamp > to) return false;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || undefined;
    const action = searchParams.get('action') || undefined;
    const user = searchParams.get('user') || undefined;
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const limit = Math.min(Number(searchParams.get('limit') || 20), 200);
    const offset = Number(searchParams.get('offset') || 0);

    const from = fromStr ? Number(fromStr) : undefined;
    const to = toStr ? Number(toStr) : undefined;

    // Get audit logs from backend
    const response = await fetch(`${BACKEND}/api/audit-logs?page=1&limit=1000`, {
      headers: {
        'Cookie': req.headers.get('cookie') || '',
        'x-tenant': req.headers.get('x-tenant') || ''
      }
    });

    if (!response.ok) {
      console.error('Backend response not ok:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    const data = await response.json();
    const backendLogs: BackendAuditLog[] = data.logs || [];
    
    // Transform backend logs to frontend format
    const frontendLogs: FrontendAuditLog[] = backendLogs.map(transformBackendToFrontend);
    
    // Filter logs
    const filteredLogs = frontendLogs.filter((l: FrontendAuditLog) => matches(l, q, action, user, from, to));
    const total = filteredLogs.length;
    const items = filteredLogs.slice(offset, offset + limit);

    return NextResponse.json({ items, total, limit, offset });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Forward to backend audit log creation
    const response = await fetch(`${BACKEND}/api/audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
        'x-tenant': req.headers.get('x-tenant') || ''
      },
      body: JSON.stringify({
        action: data.action ?? 'unknown',
        module: data.module ?? 'unknown',
        details: data.details
      })
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, log: result.log });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Forward to backend audit log clearing
    const response = await fetch(`${BACKEND}/api/audit-logs`, {
      method: 'DELETE',
      headers: {
        'Cookie': req.headers.get('cookie') || '',
        'x-tenant': req.headers.get('x-tenant') || ''
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to clear audit logs' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear audit logs' }, { status: 500 });
  }
} 