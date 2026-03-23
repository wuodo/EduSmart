const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function testAuditLogs() {
  try {
    console.log('Checking audit logs in database...');
    
    // Check existing audit logs
    const existingLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${existingLogs.length} audit logs:`);
    existingLogs.forEach(log => {
      console.log(`- ID: ${log.id}, Action: ${log.action}, Module: ${log.module}, User: ${log.user}, Created: ${log.createdAt}`);
    });
    
    // Test the getUserFromRequest function logic
    console.log('\nTesting getUserFromRequest logic...');
    try {
      const testToken = '5b21b72fd9f1c78940062969fd0c6f151835c6ddbb215e93da54fbd074546e15';
      const userFromSession = await prisma.$queryRaw`
        SELECT u.email as user_email 
        FROM sessions s 
        LEFT JOIN users u ON s.user_id = u.id 
        WHERE s.token = ${testToken} AND s.expires_at > NOW()
      `;
      console.log('User from session test:', userFromSession);
    } catch (error) {
      console.log('Error testing getUserFromRequest:', error.message);
    }
    
    // Create a test audit log
    console.log('\nCreating test audit log...');
    const testLog = await prisma.auditLog.create({
      data: {
        action: 'test_action',
        module: 'test_module',
        user: 'test@example.com',
        details: {
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          timestamp: new Date().toISOString(),
          testData: 'This is a test audit log entry'
        }
      }
    });
    
    console.log('Test audit log created:', testLog);
    
    // Check total count
    const totalCount = await prisma.auditLog.count();
    console.log(`\nTotal audit logs in database: ${totalCount}`);
    
  } catch (error) {
    console.error('Error testing audit logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditLogs();
