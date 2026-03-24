import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variant = await prisma.product.findFirst({
    where: {
      parentId: { not: null }
    },
    include: {
      category: true,
      brand: true
    }
  });

  console.log('--- Variant Details ---');
  console.log(JSON.stringify(variant, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
