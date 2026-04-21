import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find all active variants that have no imageUrl
  const activeVariants = await prisma.product.findMany({
    where: {
      parentId: { not: null },
      isActive: true,
      deletedAt: null,
      imageUrl: null
    }
  });

  console.log(`Found ${activeVariants.length} active variants without an image.`);

  let updatedCount = 0;

  for (const activeVar of activeVariants) {
    if (!activeVar.variantAttributes) continue;

    // Find a deleted variant with the same parentId and same attributes that HAS an image
    const deletedVariant = await prisma.product.findFirst({
      where: {
        parentId: activeVar.parentId,
        deletedAt: { not: null },
        imageUrl: { not: null },
        variantAttributes: {
          equals: activeVar.variantAttributes
        }
      },
      orderBy: { deletedAt: 'desc' }
    });

    if (deletedVariant && deletedVariant.imageUrl) {
      await prisma.product.update({
        where: { id: activeVar.id },
        data: { imageUrl: deletedVariant.imageUrl }
      });
      console.log(`Restored image for ${activeVar.name} (ID: ${activeVar.id}) from deleted variant ${deletedVariant.id}`);
      updatedCount++;
    } else {
        // Fallback: try to find by name similarity if attributes don't strictly match (rare)
        const partialMatch = await prisma.product.findFirst({
            where: {
                parentId: activeVar.parentId,
                deletedAt: { not: null },
                imageUrl: { not: null },
                name: { contains: activeVar.name.replace(/\s*\(.*\)\s*/, '').trim() }
            }
        });
        if (partialMatch && partialMatch.imageUrl) {
             // Let's verify attributes manually
             const activeAttrStr = JSON.stringify(activeVar.variantAttributes);
             const deletedAttrStr = JSON.stringify(partialMatch.variantAttributes);
             if (activeAttrStr === deletedAttrStr) {
                 await prisma.product.update({
                     where: { id: activeVar.id },
                     data: { imageUrl: partialMatch.imageUrl }
                   });
                   console.log(`Restored image (partial match) for ${activeVar.name} from deleted variant ${partialMatch.id}`);
                   updatedCount++;
             }
        }
    }
  }

  console.log(`Successfully restored images for ${updatedCount} variants.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
