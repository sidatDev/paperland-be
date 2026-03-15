
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const couriers = [
    {
      name: 'TCS Pakistan',
      identifier: 'tcs',
      isActive: true,
      config: {
        apiKey: 'demo-api-key',
        accountNo: 'demo-acc-123',
        password: 'demo-password'
      }
    },
    {
      name: 'Leopards Courier',
      identifier: 'leopards',
      isActive: true,
      config: {
        apiKey: 'demo-api-key',
        accountNo: 'demo-acc-456',
        password: 'demo-password'
      }
    },
    {
      name: 'M&P Courier',
      identifier: 'mnp',
      isActive: true,
      config: {
        apiKey: 'demo-api-key',
        username: 'demo-user',
        password: 'demo-password'
      }
    }
  ];

  console.log('Seeding couriers...');

  for (const courier of couriers) {
    await prisma.shippingCourier.upsert({
      where: { identifier: courier.identifier },
      update: courier,
      create: courier
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
