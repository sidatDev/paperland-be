
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const pakistanZones = [
  {
    name: 'Sindh',
    cities: [
      { name: 'Karachi', base: 200, weight: 50, volume: 100 },
      { name: 'Hyderabad', base: 250, weight: 60, volume: 120 },
      { name: 'Sukkur', base: 300, weight: 70, volume: 140 }
    ]
  },
  {
    name: 'Punjab',
    cities: [
      { name: 'Lahore', base: 220, weight: 55, volume: 110 },
      { name: 'Faisalabad', base: 260, weight: 65, volume: 130 },
      { name: 'Multan', base: 280, weight: 70, volume: 140 },
      { name: 'Rawalpindi', base: 240, weight: 60, volume: 120 }
    ]
  },
  {
    name: 'KPK',
    cities: [
      { name: 'Peshawar', base: 300, weight: 80, volume: 160 },
      { name: 'Abbottabad', base: 350, weight: 90, volume: 180 }
    ]
  },
  {
    name: 'Balochistan',
    cities: [
      { name: 'Quetta', base: 400, weight: 100, volume: 200 },
      { name: 'Gwadar', base: 500, weight: 120, volume: 240 }
    ]
  },
  {
    name: 'Islamabad (ICT)',
    cities: [
      { name: 'Islamabad', base: 230, weight: 55, volume: 110 }
    ]
  },
  {
    name: 'AJK & Gilgit-Baltistan',
    cities: [
      { name: 'Muzaffarabad', base: 400, weight: 100, volume: 200 },
      { name: 'Gilgit', base: 450, weight: 110, volume: 220 },
      { name: 'Skardu', base: 500, weight: 120, volume: 240 }
    ]
  }
];

async function main() {
  const pakistan = await prisma.country.findFirst({
    where: { code: 'PK' }
  });

  if (!pakistan) {
    console.error('Pakistan not found in countries table. Please run country seed first.');
    process.exit(1);
  }

  console.log('Seeding Pakistan Shipping Zones...');

  for (const zoneData of pakistanZones) {
    // Check if zone exists
    let zone = await (prisma as any).shippingZone.findUnique({
      where: { name: zoneData.name }
    });

    if (!zone) {
      zone = await (prisma as any).shippingZone.create({
        data: {
          name: zoneData.name,
          countries: ['PK'],
          countryId: pakistan.id,
          volumetricDivisor: 5000
        }
      });
      console.log(`Created Zone: ${zoneData.name}`);
    } else {
      console.log(`Zone exists: ${zoneData.name}`);
    }

    // Add Cities
    for (const city of zoneData.cities) {
      const existingRate = await (prisma as any).shippingRate.findFirst({
        where: {
          zoneId: zone.id,
          cityName: city.name
        }
      });

      if (!existingRate) {
        await (prisma as any).shippingRate.create({
          data: {
            zoneId: zone.id,
            cityName: city.name,
            baseRate: city.base,
            weightIncrement: city.weight,
            volumeIncrement: city.volume,
            minWeight: 0,
            estimatedDays: '3-5 Days'
          }
        });
        console.log(`  Added City Rate: ${city.name}`);
      }
    }
  }

  console.log('Pakistan Shipping Seeding Completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
