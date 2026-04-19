import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed for Logistics Couriers...');

  const couriers = [
    {
      name: 'TCS Pakistan',
      code: 'TCS_PK',
      region: 'PK',
      trackingUrl: 'https://www.tcsexpress.com/tracking?trackNo={trackingNumber}',
      isActive: true,
      apiConfig: {
        provider: 'TCS',
        mode: 'production',
      }
    },
    {
      name: 'Leopards CourierService',
      code: 'LEOPARDS_PK',
      region: 'PK',
      trackingUrl: 'https://leopardscourier.com/tracking?track={trackingNumber}',
      isActive: true,
      apiConfig: {
        provider: 'LEOPARDS',
        mode: 'production',
      }
    },
    {
      name: 'Trax Courier',
      code: 'TRAX_PK',
      region: 'PK',
      trackingUrl: 'https://trax.pk/tracking?tracking_number={trackingNumber}',
      isActive: true,
      apiConfig: {
        provider: 'TRAX',
        mode: 'production',
      }
    }
  ];

  for (const courier of couriers) {
    const exists = await prisma.courierProvider.findUnique({
      where: { code: courier.code }
    });

    if (!exists) {
      await prisma.courierProvider.create({
        data: courier
      });
      console.log(`Created courier: ${courier.name}`);
    } else {
      console.log(`Courier ${courier.name} already exists. Skipping.`);
    }
  }

  // Also seed a default Self-Delivery Rider for test purposes
  const defaultRider = await prisma.rider.findFirst({
    where: { phone: '+923000000000' }
  });

  if (!defaultRider) {
    await prisma.rider.create({
      data: {
        name: 'Default In-House Rider',
        phone: '+923000000000',
        cnic: '42101-0000000-0',
        region: 'PK',
        status: 'AVAILABLE',
        isActive: true,
      }
    });
    console.log('Created default Rider');
  } else {
    console.log('Default Rider already exists. Skipping.');
  }

  console.log('Seeding finished.');

  // ----- SEED SHIPPING RULES -----
  console.log('Starting seed for Shipping Rules...');
  
  const tcs = await prisma.courierProvider.findUnique({ where: { code: 'TCS_PK' } });
  
  const rules = [
    {
      name: 'Karachi In-House Delivery',
      city: 'Karachi',
      logisticsType: 'SELF_DELIVERY',
      priority: 10,
      region: 'PK',
      isActive: true
    },
    {
      name: 'Standard TCS Pakistan Delivery',
      city: null, // Catch-all
      logisticsType: 'THIRD_PARTY',
      courierProviderId: tcs?.id,
      priority: 0,
      region: 'PK',
      isActive: true
    }
  ];

  for (const rule of rules) {
    const exists = await prisma.shippingRule.findUnique({
      where: { name: rule.name }
    });

    if (!exists) {
      await prisma.shippingRule.create({
        data: rule
      });
      console.log(`Created shipping rule: ${rule.name}`);
    } else {
      console.log(`Shipping rule ${rule.name} already exists. Updating...`);
      await prisma.shippingRule.update({
        where: { id: exists.id },
        data: rule
      });
    }
  }

  console.log('Logistics Seeding fully finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
