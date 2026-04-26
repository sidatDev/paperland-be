import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function backfillVariantHash() {
  console.log('Starting Variant Hash backfill job...');
  
  const variants = await prisma.product.findMany({
    where: {
      parentId: { not: null },
      deletedAt: null
    }
  });

  let updatedCount = 0;

  for (const variant of variants) {
    const attrs = variant.variantAttributes as Record<string, any>;
    if (!attrs || Object.keys(attrs).length === 0) continue;

    const variantHash = crypto.createHash('md5')
      .update(JSON.stringify(Object.entries(attrs).sort()))
      .digest('hex');

    const specs = (variant.specifications as any) || {};
    
    // Only update if hash is missing or different
    if (specs.variantHash !== variantHash) {
      await prisma.product.update({
        where: { id: variant.id },
        data: {
          specifications: {
            ...specs,
            variantHash
          }
        }
      });
      updatedCount++;
    }
  }

  console.log(`Backfill job completed. Updated ${updatedCount} variants.`);
  await prisma.$disconnect();
}

backfillVariantHash().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
