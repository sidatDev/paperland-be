import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Verifying ERP IDs for all orders...\n');
  
  const orders = await prisma.order.findMany({
    where: {
      orderNumber: {
        startsWith: 'ORD-2026'
      }
    },
    select: {
      orderNumber: true,
      erpOrderId: true,
      erpSyncStatus: true
    },
    orderBy: {
      orderNumber: 'asc'
    }
  });
  
  console.log('Order Count:', orders.length);
  console.log('\nERP ID Status:');
  console.log('─'.repeat(80));
  
  let withErpId = 0;
  let withoutErpId = 0;
  
  orders.forEach(order => {
    const hasErpId = order.erpOrderId ? '✅' : '❌';
    if (order.erpOrderId) withErpId++;
    else withoutErpId++;
    
    console.log(`${hasErpId} ${order.orderNumber.padEnd(20)} | ERP ID: ${(order.erpOrderId || 'NULL').padEnd(25)} | Status: ${order.erpSyncStatus}`);
  });
  
  console.log('─'.repeat(80));
  console.log(`\n✅ With ERP ID: ${withErpId}`);
  console.log(`❌ Without ERP ID: ${withoutErpId}`);
  
  if (withoutErpId === 0) {
    console.log('\n🎉 SUCCESS! All orders have ERP IDs!');
  } else {
    console.log('\n⚠️  WARNING: Some orders are missing ERP IDs!');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
