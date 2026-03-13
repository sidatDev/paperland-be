
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const countries = await prisma.country.findMany();
  console.log('Existing Countries:', JSON.stringify(countries, null, 2));

  const zones = await prisma.shippingZone.findMany({
    include: { rates: true }
  });
  console.log('Existing Zones:', JSON.stringify(zones, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
