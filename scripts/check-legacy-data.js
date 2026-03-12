const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLegacyData() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        micronRating: true,
        flowRate: true,
        maxPressure: true,
        temperatureRange: true,
        efficiency: true,
        outerDiameter: true,
        innerDiameter: true,
        threadSize: true,
        gasketOD: true,
        gasketId: true,
        erpId: true,
        groupNumber: true,
      }
    });

    const legacyFields = [
      'micronRating', 'flowRate', 'maxPressure', 'temperatureRange',
      'efficiency', 'outerDiameter', 'innerDiameter', 'threadSize',
      'gasketOD', 'gasketId', 'erpId', 'groupNumber'
    ];

    const stats = legacyFields.reduce((acc, field) => {
      acc[field] = products.filter(p => p[field] !== null && p[field] !== '').length;
      return acc;
    }, {});

    console.log('Legacy Field Usage Stats (Non-null/Non-empty count):');
    console.log(JSON.stringify(stats, null, 2));

    if (products.length > 0) {
      console.log('\nTotal Products Checked:', products.length);
    } else {
      console.log('\nNo products found in database.');
    }

  } catch (err) {
    console.error('Error checking legacy data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkLegacyData();
