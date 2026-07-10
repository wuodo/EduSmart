import prisma from '../lib/prisma';
import { sendEmail, hasSmtpConfig } from '../utils/email';

export async function sendDailyDigests() {
  if (!hasSmtpConfig()) {
    console.log('[digest] SMTP not configured — skipping daily digest');
    return;
  }

  const tenants = await prisma.tenant.findMany({ where: { isActive: true } });

  for (const tenant of tenants) {
    const staff = await prisma.user.findMany({
      where: { tenantId: tenant.id, approved: true },
    });

    for (const user of staff) {
      const hotLeads = await prisma.inquiry.count({
        where: { tenantId: tenant.id, status: 'Hot', createdBy: user.email },
      });
      const pendingFollowups = await prisma.followup.count({
        where: { assignedTo: user.email, status: 'pending', tenantId: tenant.id },
      });
      const overdueFollowups = await prisma.followup.count({
        where: { assignedTo: user.email, status: 'pending', scheduledFor: { lte: new Date() }, tenantId: tenant.id },
      });
      const totalInquiries = await prisma.inquiry.count({
        where: { tenantId: tenant.id, createdBy: user.email },
      });
      const tasksDue = await prisma.task.count({
        where: { ownerEmail: user.email, status: { not: 'completed' }, dueDate: { lte: new Date() }, tenantId: tenant.id },
      });

      const name = user.name || user.email;
      const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">Good morning, ${name}!</h1>
          <p style="margin:4px 0 0;opacity:0.9">${tenant.name} — Daily Digest</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:12px;text-align:center;background:#f0fdfa;border-radius:6px">
                <div style="font-size:28px;font-weight:700;color:#0d9488">${hotLeads}</div>
                <div style="font-size:12px;color:#6b7280">Hot Leads</div>
              </td>
              <td style="width:8px"></td>
              <td style="padding:12px;text-align:center;background:#fef2f2;border-radius:6px">
                <div style="font-size:28px;font-weight:700;color:#dc2626">${overdueFollowups}</div>
                <div style="font-size:12px;color:#6b7280">Overdue Follow-ups</div>
              </td>
              <td style="width:8px"></td>
              <td style="padding:12px;text-align:center;background:#fffbeb;border-radius:6px">
                <div style="font-size:28px;font-weight:700;color:#d97706">${pendingFollowups}</div>
                <div style="font-size:12px;color:#6b7280">Pending Follow-ups</div>
              </td>
            </tr>
          </table>

          <h3 style="margin:20px 0 8px;color:#374151">Today's Priorities</h3>
          <ul style="padding-left:20px;color:#4b5563;line-height:1.8">
            ${hotLeads > 0 ? `<li><strong>${hotLeads} hot lead(s)</strong> need immediate attention</li>` : ''}
            ${overdueFollowups > 0 ? `<li><strong>${overdueFollowups} follow-up(s) overdue</strong> — catch up today</li>` : ''}
            ${pendingFollowups > 0 ? `<li><strong>${pendingFollowups} pending follow-up(s)</strong> scheduled</li>` : ''}
            ${tasksDue > 0 ? `<li><strong>${tasksDue} task(s) past due</strong></li>` : ''}
            ${totalInquiries === 0 ? '<li>No inquiries assigned yet. Check the inquiry pool.</li>' : ''}
          </ul>

          <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
          <p style="font-size:12px;color:#6b7280">EduSmart CRM — Automated Daily Digest</p>
        </div>
      </div>`;

      const text = [
        `Good morning, ${name}!`,
        `${tenant.name} — Daily Digest`,
        ``,
        `Hot Leads: ${hotLeads}`,
        `Overdue Follow-ups: ${overdueFollowups}`,
        `Pending Follow-ups: ${pendingFollowups}`,
        `Tasks Due: ${tasksDue}`,
        ``,
        `Login: ${process.env.FRONTEND_URL || 'https://edusmart-frontend-production.up.railway.app'}`,
      ].join('\n');

      try {
        await sendEmail(user.email, `EduSmart Daily Digest — ${new Date().toLocaleDateString()}`, text, html);
      } catch (e: any) {
        console.error(`[digest] Failed to send to ${user.email}:`, e.message);
      }
    }
  }
}
