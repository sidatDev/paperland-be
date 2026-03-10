
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const id = '4b8a1e2c-c540-4424-b835-2fde0f208d0c';
    const product = await prisma.product.findUnique({
        where: { id }
    });

    if (!product) {
        console.log('Product not found');
    } else {
        console.log('Product Found:', product.name);
        console.log('Slug:', product.slug);
        console.log('Specifications:', JSON.stringify(product.specifications, null, 2));
    }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
