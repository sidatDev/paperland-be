import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const id = 'c6d80f87-2272-44f7-b415-a299c0ad311f';
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        include: {
          prices: true,
          stocks: true
        }
      }
    }
  });

  console.log(JSON.stringify(product, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
