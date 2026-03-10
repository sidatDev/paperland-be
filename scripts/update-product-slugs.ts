
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const generateUniqueSlug = async (name: string, partNo: string, sku: string, excludeId?: string) => {
    const parts = [name];
    if (partNo) parts.push(partNo);
    if (sku && sku.trim().toLowerCase() !== partNo.trim().toLowerCase()) parts.push(sku);
    
    let slug = slugify(parts.join('-'));
    
    let counter = 0;
    while (true) {
        const checkSlug = counter === 0 ? slug : `${slug}-${counter}`;
        const existing = await prisma.product.findFirst({ where: { slug: checkSlug } });
        if (!existing || (excludeId && existing.id === excludeId)) return checkSlug;
        counter++;
    }
};

async function main() {
  console.log('Starting product slug update...');
  
  const products = await prisma.product.findMany({});
  console.log(`Found ${products.length} products.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    try {
        const specs = product.specifications as any || {};
        const partNo = specs.partNo || "";
        const sku = product.sku || "";
        
        // Generate new slug
        const newSlug = await generateUniqueSlug(product.name, partNo, sku, product.id);

        if (newSlug !== product.slug) {
            await prisma.product.update({
                where: { id: product.id },
                data: { slug: newSlug }
            });
            console.log(`Updated: ${product.name} -> ${newSlug}`);
            updatedCount++;
        } else {
            // console.log(`Skipped (Unchanged): ${product.name}`);
            skippedCount++;
        }
    } catch (error) {
        console.error(`Failed to update product ${product.id}:`, error);
    }
  }

  console.log('-----------------------------------');
  console.log(`Update Complete.`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log('-----------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
