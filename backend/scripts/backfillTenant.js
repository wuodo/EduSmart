const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function backfill() {
  try {
    console.log('🔧 Backfilling tenantId for existing records...');

    // Find default tenant (Business School)
    const defaultTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { name: 'Business School' },
          { subdomain: 'business' }
        ]
      }
    });

    if (!defaultTenant) {
      throw new Error('Default tenant not found. Seed tenants first.');
    }

    const tenantId = defaultTenant.id;

    // Users
    const users = await prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId }
    });

    // Inquiries
    const inquiries = await prisma.inquiry.updateMany({
      where: { tenantId: null },
      data: { tenantId }
    });

    // Followups
    const followups = await prisma.followup.updateMany({
      where: { tenantId: null },
      data: { tenantId }
    });

    // Tasks
    const tasks = await prisma.task.updateMany({
      where: { tenantId: null },
      data: { tenantId }
    });

    console.log('✅ Backfill complete:', {
      users: users.count,
      inquiries: inquiries.count,
      followups: followups.count,
      tasks: tasks.count,
    });
  } catch (err) {
    console.error('❌ Backfill failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

backfill();











