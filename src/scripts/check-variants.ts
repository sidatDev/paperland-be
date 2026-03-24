import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variants = await prisma.product.findMany({
    where: {
      parentId: { not: null }
    },
    select: {
      id: true,
      name: true,
      sku: true,
      parentId: true
    }
  });

  console.log('Total Variants found:', variants.length);
  if (variants.length > 0) {
    console.log('Sample Variants:', variants.slice(0, 5));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
