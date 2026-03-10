import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

async function main() {
  console.log('Starting slug backfill...');
  
  const total = await prisma.product.count();
  console.log(`Total products in DB: ${total}`);

  // Fetch all products just to be safe if checking for null fails
  // const products = await prisma.product.findMany({ where: { slug: null } });
  
  // Or: fetch all and check if slug is missing or empty or invalid
  const products = await prisma.product.findMany({
    where: {
      OR: [
          { slug: null },
          // { slug: "" } Prisma might not allow empty string check if nullable string? It does.
      ]
    },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  console.log(`Found ${products.length} products without slugs.`);

  for (const product of products) {
    let slug = slugify(product.name);
    
    // Ensure uniqueness
    let isUnique = false;
    let counter = 0;
    let originalSlug = slug;

    while (!isUnique) {
      const existing = await prisma.product.findUnique({
        where: { slug },
      });
      if (!existing) {
        isUnique = true;
      } else {
        counter++;
        slug = `${originalSlug}-${counter}`;
      }
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { slug },
    });
    console.log(`Updated product ${product.name} -> ${slug}`);
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
