import prisma from '../lib/prisma';
import { notifyStaff, pushInAppNotification } from './notificationService';

export async function processOverdueFollowups() {
  const now = new Date();
  const overdueFollowups = await prisma.followup.findMany({
    where: { status: 'pending', scheduledFor: { lte: now } },
    include: { inquiry: { select: { fullName: true, id: true, tenantId: true } } },
  });

  for (const f of overdueFollowups) {
    const assignedEmail = f.assignedTo;
    if (!assignedEmail) continue;

    const user = await prisma.user.findFirst({
      where: { email: assignedEmail, tenantId: f.tenantId ?? undefined },
    });
    if (!user) continue;

    await notifyStaff(
      {
        userId: user.id,
        email: user.email,
        name: user.name || user.email,
        title: 'Overdue Follow-up Reminder',
        body: `Follow-up "${f.type}" for ${f.inquiry.fullName} (#${f.inquiry.id}) was due ${f.scheduledFor.toLocaleDateString()}. Please action.`,
        priority: 'warning',
        link: `/inquiries/${f.inquiryId}`,
        tenantId: f.tenantId ?? f.inquiry.tenantId,
      },
      ['in_app', 'email'],
    );
  }

  const expiredTasks = await prisma.task.findMany({
    where: { status: { not: 'completed' }, dueDate: { lte: now } },
    include: { inquiry: { select: { fullName: true, id: true } } },
  });

  for (const t of expiredTasks) {
    if (!t.ownerEmail) continue;
    const user = await prisma.user.findFirst({ where: { email: t.ownerEmail, tenantId: t.tenantId ?? undefined } });
    if (!user) continue;

    pushInAppNotification({
      userId: user.id,
      email: user.email,
      name: user.name || user.email,
      title: 'Overdue Task',
      body: `Task "${t.title}" was due ${t.dueDate?.toLocaleDateString() ?? 'N/A'}.${t.inquiry ? ` Related to ${t.inquiry.fullName}.` : ''}`,
      priority: 'warning',
      link: t.inquiry ? `/inquiries/${t.inquiry.id}` : undefined,
      tenantId: t.tenantId,
    });
  }
}

export async function processDormantLeads() {
  const threshold = new Date(Date.now() - 14 * 86400000);

  const dormantInquiries = await prisma.inquiry.findMany({
    where: {
      updatedAt: { lte: threshold },
      status: { notIn: ['Registered', 'Paid', 'Cancelled'] },
    },
    include: { tenant: { select: { name: true } } },
  });

  for (const i of dormantInquiries) {
    const admins = await prisma.user.findMany({
      where: { tenantId: i.tenantId ?? undefined, role: { in: ['admin', 'senior_staff'] } },
    });
    for (const admin of admins) {
      pushInAppNotification({
        userId: admin.id,
        email: admin.email,
        name: admin.name || admin.email,
        title: 'Dormant Lead Alert',
        body: `Lead ${i.fullName} (#${i.id}) has been inactive for 14+ days. Consider re-engagement.`,
        priority: 'info',
        link: `/inquiries/${i.id}`,
        tenantId: i.tenantId,
      });
    }

    if (admins.length > 0 && i.status !== 'Cold') {
      await prisma.inquiry.update({ where: { id: i.id }, data: { status: 'Cold' } }).catch(() => {});
    }
  }
}
