import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'Jamal Nieves' }
    },
    select: { id: true, name: true, sku: true, parentId: true }
  });

  console.log(`Found ${products.length} products:`);
  products.forEach(p => console.log(`- [${p.id}] ${p.name} (Parent: ${p.parentId})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
