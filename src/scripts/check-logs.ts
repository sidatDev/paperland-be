import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.trackingLog.findMany({
    where: { order: { orderNumber: 'ORD-310399' } },
    orderBy: { loggedAt: 'asc' }
  });
  console.log('Logs for ORD-310399:', JSON.stringify(logs, null, 2));

  const logs2 = await prisma.trackingLog.findMany({
    where: { order: { orderNumber: 'ORD-870505' } },
    orderBy: { loggedAt: 'asc' }
  });
  console.log('Logs for ORD-870505:', JSON.stringify(logs2, null, 2));
}
main().finally(() => prisma.$disconnect());
