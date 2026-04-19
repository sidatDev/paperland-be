import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      orderNumber: true,
      status: true,
      logisticsType: true,
      courierProviderId: true,
      fulfillmentWarehouseId: true,
      shippingDetails: true
    }
  });
  console.log(JSON.stringify(orders, null, 2));
}
main().finally(() => prisma.$disconnect());
