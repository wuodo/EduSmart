import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '../_auditStore';

// In-memory communication settings (replace with DB in production)
let communication = {
  emailTemplates: [
    { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to EduSmart', body: 'Dear {{name}}, welcome to EduSmart!' },
    { id: 'reminder', name: 'Reminder Email', subject: "Don't forget!", body: 'This is a reminder for {{event}}.' },
  ],
  smsTemplates: [
    { id: 'otp', name: 'OTP SMS', body: 'Your OTP is {{otp}}.' },
  ],
  whatsapp: {
    enabled: false,
    apiKey: '',
    senderNumber: '',
  },
  notificationPreferences: {
    admissions_officer: ['email', 'sms'],
    admin: ['email', 'sms', 'whatsapp'],
    viewer: ['email'],
  },
};

export async function GET() {
  return NextResponse.json(communication);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  if (data.emailTemplates) communication.emailTemplates = data.emailTemplates;
  if (data.smsTemplates) communication.smsTemplates = data.smsTemplates;
  if (data.whatsapp) communication.whatsapp = { ...communication.whatsapp, ...data.whatsapp };
  if (data.notificationPreferences) communication.notificationPreferences = data.notificationPreferences;

  // Audit log
  const { getCurrentUser } = await import('../_getCurrentUser');
  const currentUser = await getCurrentUser(req);
  const user = currentUser?.email || 'unknown';
  const ip = req.headers.get('x-forwarded-for') || undefined;
  addAuditLog({
    action: 'update_communication',
    module: 'settings',
    user,
    ip,
    details: data,
  });

  return NextResponse.json({ success: true, communication });
} 