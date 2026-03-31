import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const prod = await prisma.product.findUnique({
    where: { slug: 'notebook-black-n-46782' },
    include: { variants: true }
  });

  if (!prod) {
    console.log('Product not found for that slug.');
    return;
  }

  console.log('Parent Product ID:', prod.id);
  const variantIds = prod.variants.map((v) => v.id);
  console.log('Variant IDs:', variantIds);

  const productIds = [prod.id, ...variantIds];
  
  const reviews = await prisma.review.findMany({
    where: {
      productId: { in: productIds }
    }
  });

  console.log('All Reviews for this product family:', reviews);
}

main().finally(() => prisma.$disconnect());
