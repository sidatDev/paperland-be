import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderNumber: 'ORD-310399' },
    include: {
      address: {
          include: { country: true }
      },
    },
  });

  console.log('Order Details:', JSON.stringify(order, null, 2));

  const rules = await prisma.shippingRule.findMany({
    where: { isActive: true },
    include: {
        courierProvider: true,
    }
  });

  console.log('Active Shipping Rules:', JSON.stringify(rules, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
