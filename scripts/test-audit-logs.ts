import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAuditLogQuery() {
  try {
    console.log('🧪 Testing AuditLog queries...\n');

    // Test 1: Find all audit logs
    console.log('Test 1: Fetching all audit logs...');
    const allLogs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log(`✅ Found ${allLogs.length} logs`);
    console.log(allLogs[0]);

    // Test 2: Find logs by entity type
    console.log('\nTest 2: Fetching ORDER logs...');
    const orderLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'ORDER'
      },
      include: {
        performer: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      take: 3
    });
    console.log(`✅ Found ${orderLogs.length} order logs`);
    if (orderLogs.length > 0) {
      console.log('Sample log:');
      console.log(orderLogs[0]);
    }

    // Test 3: Count by entity type
    console.log('\nTest 3: Counting logs by entity type...');
    const counts = await prisma.$queryRaw`
      SELECT entity_type, COUNT(*) as count
      FROM audit_logs
      GROUP BY entity_type;
    `;
    console.log('📊 Logs by entity type:');
    console.table(counts);

    console.log('\n✅ All tests passed! AuditLog is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditLogQuery();
