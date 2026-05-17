
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCampaigns() {
  const ids = [
    '983b2109-06ce-4efa-8b80-5996f15bcf46',
    'c0af7070-9760-4a32-8f58-e7039d4558dd'
  ];

  for (const id of ids) {
    console.log(`--- Checking Campaign: ${id} ---`);
    const promo = await prisma.promotion.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ]
      },
      include: {
        tiers: true
      }
    });

    if (promo) {
      console.log(JSON.stringify(promo, null, 2));
    } else {
      console.log('Not found');
    }
  }

  await prisma.$disconnect();
}

checkCampaigns();
