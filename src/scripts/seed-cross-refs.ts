import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCrossRefs() {
  console.log('🌱 Seeding Cross-Brand Recommendations...');

  try {
    // We'll link "Fleetguard filter" to "Compressed Hydraulic Air Filters - HX Series" (Baldwin)
    const sourceId = "0f81fda8-d4df-4d71-be8c-05a00a8cb418"; // Fleetguard
    const targetId = "25320f23-e5df-4a1d-966f-16ed39cbaeba"; // Baldwin (Compressed Hydraulic)

    await prisma.crossReference.upsert({
        where: {
            productId_targetProductId_relationType: {
                productId: sourceId,
                targetProductId: targetId,
                relationType: "COMPATIBLE"
            }
        },
        update: {},
        create: {
            productId: sourceId,
            targetProductId: targetId,
            relationType: "COMPATIBLE",
            notes: "Verified alternative for Fleetguard industrial applications"
        }
    });

    console.log('✅ Cross-Brand link created successfully!');
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCrossRefs();
