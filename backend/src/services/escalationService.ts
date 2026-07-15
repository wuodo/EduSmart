import prisma from '../lib/prisma';
import { notifyStaff, getInAppNotifications } from './notificationService';

export async function runEscalationChecks() {
  const now = new Date();
  const criticalThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const criticalOverdue = await prisma.followup.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: criticalThreshold },
    },
    include: {
      inquiry: { select: { fullName: true, id: true, tenantId: true } },
    },
  });

  for (const f of criticalOverdue) {
    const assignedEmail = f.assignedTo;
    if (!assignedEmail) continue;

    const tenantId = f.tenantId ?? f.inquiry.tenantId;
    if (!tenantId) continue;

    const managers = await prisma.user.findMany({
      where: { tenantId, role: { in: ['admin', 'senior_staff'] } },
    });

    for (const mgr of managers) {
      const assignedUser = await prisma.user.findFirst({ where: { email: assignedEmail, tenantId } });
      const staffName = assignedUser?.name || assignedEmail;

      const existingNotifs = getInAppNotifications().filter(n => n.title === 'Escalation: Critical Overdue Follow-up' && n.body.includes(`#${f.id}`));
      if (existingNotifs.length > 0) continue;

      await notifyStaff(
        {
          userId: mgr.id,
          email: mgr.email,
          name: mgr.name || mgr.email,
          title: 'Escalation: Critical Overdue Follow-up',
          body: `Follow-up (#${f.id}, type: ${f.type}) for ${f.inquiry.fullName} is overdue by 48+ hours. Assigned to ${staffName}. Requires manager intervention.`,
          priority: 'critical',
          link: `/inquiries/${f.inquiry.id}`,
          tenantId,
        },
        ['in_app', 'email'],
      );
    }
  }

  const slaBreaches = await prisma.inquiry.findMany({
    where: {
      firstResponseAt: null,
      createdAt: { lte: criticalThreshold },
      status: { notIn: ['Registered', 'Paid', 'Cancelled'] },
    },
    include: { tenant: { select: { name: true } } },
  });

  for (const i of slaBreaches) {
    const tenantId = i.tenantId;
    if (!tenantId) continue;
    const admins = await prisma.user.findMany({
      where: { tenantId, role: 'admin' },
    });
    for (const admin of admins) {
      await notifyStaff(
        {
          userId: admin.id,
          email: admin.email,
          name: admin.name || admin.email,
          title: 'SLA Breach Alert',
          body: `Inquiry "${i.fullName}" (#${i.id}) has no response for 48+ hours. Review and assign immediately.`,
          priority: 'critical',
          link: `/inquiries/${i.id}`,
          tenantId,
        },
        ['in_app', 'email'],
      );
    }
  }
}
