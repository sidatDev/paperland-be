
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const productsPage = await prisma.cMSPage.findFirst({
    where: { slug: 'products' }
  });

  if (productsPage) {
    console.log('Products Page Slug:', productsPage.slug);
    console.log('Content (JSON):', JSON.stringify(productsPage.content, null, 2));
  } else {
    console.log('Products page not found in CMSPage table.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
