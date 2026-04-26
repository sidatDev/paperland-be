const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const log = await prisma.productImportLog.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest Log:', JSON.stringify(log, null, 2));
  
  const parent = await prisma.product.findUnique({
    where: { sku: 'IMP-232' }
  });
  console.log('Parent IMP-232 in DB:', parent ? 'YES' : 'NO');
}

check().catch(console.error).finally(() => prisma.$disconnect());
