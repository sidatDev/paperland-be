import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

async function generateUniqueSlug(name: string, partNo: string, sku: string, excludeId?: string) {
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
}

async function main() {
  const parentId = 'c6d80f87-2272-44f7-b415-a299c0ad311f';
  const parent = await prisma.product.findUnique({
    where: { id: parentId },
    include: { variants: true }
  });

  if (!parent) {
    console.error('Parent product not found');
    return;
  }

  console.log(`Fixing variants for parent: ${parent.name} (${parent.id})`);

  for (const variant of parent.variants) {
    if (variant.name.includes('Jamal Nieves')) {
      const attrs = variant.variantAttributes as Record<string, string>;
      const attrValues = Object.values(attrs || {}).join(' / ');
      const newName = `${parent.name} (${attrValues})`;
      const newSlug = await generateUniqueSlug(newName, "", variant.sku, variant.id);

      console.log(`Updating variant ${variant.id}:`);
      console.log(`  Old Name: ${variant.name}`);
      console.log(`  New Name: ${newName}`);
      console.log(`  New Slug: ${newSlug}`);

      await prisma.product.update({
        where: { id: variant.id },
        data: {
          name: newName,
          slug: newSlug
        }
      });
    }
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
