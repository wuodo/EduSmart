const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function moveBusinessDataToHealth() {
  try {
    console.log('🔄 Moving data from Business -> Health tenant...');

    const health = await prisma.tenant.findFirst({
      where: { OR: [{ name: 'Health School' }, { subdomain: 'health' }] }
    });
    const business = await prisma.tenant.findFirst({
      where: { OR: [{ name: 'Business School' }, { subdomain: 'business' }] }
    });

    if (!health) throw new Error('Health tenant not found');
    if (!business) throw new Error('Business tenant not found');

    const [inq, fol, task] = await prisma.$transaction([
      prisma.inquiry.updateMany({ where: { tenantId: business.id }, data: { tenantId: health.id } }),
      prisma.followup.updateMany({ where: { tenantId: business.id }, data: { tenantId: health.id } }),
      prisma.task.updateMany({ where: { tenantId: business.id }, data: { tenantId: health.id } }),
    ]);

    console.log('✅ Move complete:', {
      inquiries: inq.count,
      followups: fol.count,
      tasks: task.count
    });
  } catch (err) {
    console.error('❌ Move failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

moveBusinessDataToHealth();











