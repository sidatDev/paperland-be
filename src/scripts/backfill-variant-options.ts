import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillVariantOptions() {
  console.log('Starting variant backfill job...');
  
  // Find all products that have variants
  const parents = await prisma.product.findMany({
    where: {
      variants: {
        some: {}
      }
    },
    include: {
      variants: true
    }
  });

  let updatedCount = 0;

  for (const parent of parents) {
    // Only process if variantOptions is empty or missing
    // Assuming variantOptions is stored as a JSON field. If it's an array of objects:
    const existingOptions = parent.variantOptions as any[];
    if (existingOptions && existingOptions.length > 0) {
      continue; // Already has options
    }

    // Collect all variant attributes
    const variantOptionsMap = new Map<string, Set<string>>();
    
    for (const variant of parent.variants) {
      const attrs = variant.variantAttributes as Record<string, string>;
      if (!attrs) continue;
      
      for (const [key, value] of Object.entries(attrs)) {
        if (!variantOptionsMap.has(key)) {
          variantOptionsMap.set(key, new Set());
        }
        variantOptionsMap.get(key)!.add(value);
      }
    }

    // Build variantOptions array
    const variantOptions = Array.from(variantOptionsMap.entries()).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet)
    }));

    if (variantOptions.length > 0) {
      await prisma.product.update({
        where: { id: parent.id },
        data: { variantOptions }
      });
      updatedCount++;
      console.log(`Updated product ${parent.sku} with variantOptions:`, variantOptions);
    }
  }

  console.log(`Backfill job completed. Updated ${updatedCount} products.`);
  await prisma.$disconnect();
}

backfillVariantOptions().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
