const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function seedTenants() {
  try {
    console.log('🌱 Seeding tenants...');

    // Create Business School tenant
    const businessSchool = await prisma.tenant.upsert({
      where: { name: 'Business School' },
      update: {},
      create: {
        name: 'Business School',
        subdomain: 'business',
        domain: 'business.edusmart.com',
        logo: '/images/business-school-logo.png',
        primaryColor: '#ea3c3d',
        secondaryColor: '#afd657',
        accentColor: '#39b1ed',
        isActive: true
      }
    });

    // Create Health School tenant
    const healthSchool = await prisma.tenant.upsert({
      where: { name: 'Health School' },
      update: {},
      create: {
        name: 'Health School',
        subdomain: 'health',
        domain: 'health.edusmart.com',
        logo: '/images/health-school-logo.png',
        primaryColor: '#2e7d32',
        secondaryColor: '#4caf50',
        accentColor: '#2196f3',
        isActive: true
      }
    });

    console.log('✅ Tenants seeded successfully:');
    console.log(`   - ${businessSchool.name} (ID: ${businessSchool.id})`);
    console.log(`   - ${healthSchool.name} (ID: ${healthSchool.id})`);

    // Update existing users to assign them to Business School by default
    const updatedUsers = await prisma.user.updateMany({
      where: {
        tenantId: null
      },
      data: {
        tenantId: businessSchool.id
      }
    });

    console.log(`✅ Updated ${updatedUsers.count} existing users to Business School tenant`);

  } catch (error) {
    console.error('❌ Error seeding tenants:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTenants();











