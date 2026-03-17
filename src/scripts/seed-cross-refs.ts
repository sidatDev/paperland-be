import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCrossRefs() {
  console.log('🌱 Seeding Cross-Brand Recommendations...');

  try {
    // We'll link "Premium Bond Paper" to "Executive Writing Set"
    const sourceId = "0f81fda8-d4df-4d71-be8c-05a00a8cb418"; 
    const targetId = "25320f23-e5df-4a1d-966f-16ed39cbaeba"; 

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
            notes: "Verified premium stationery set for corporate use"
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
