import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking Products...');
  
  const products = await prisma.product.findMany({
      select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          isEcommerceVisible: true,
          deletedAt: true
      }
  });

  console.table(products);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
