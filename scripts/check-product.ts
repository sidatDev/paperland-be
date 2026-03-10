import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = '1288-o41-filter-pack-100-pcs-p554234';
  const product = await prisma.product.findFirst({
    where: { 
      OR: [
        { slug: slug },
        { id: slug } // In case it's an ID
      ]
    }
  });

  if (!product) {
    console.log('Product not found');
    return;
  }

  console.log('Product Name:', product.name);
  console.log('Description:', product.description);
  console.log('Full Description:', product.fullDescription);
  console.log('Description Lines:', product.description ? product.description.split('\n').length : 0);
  console.log('Full Description Length:', product.fullDescription ? product.fullDescription.length : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
