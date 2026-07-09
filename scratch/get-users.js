const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Brand keys:", Object.keys(prisma.brand || {}));
  console.log("Category keys:", Object.keys(prisma.category || {}));
  
  // Try querying one of each with products relation
  const sampleBrand = await prisma.brand.findFirst({
    include: {
      products: true
    }
  });
  console.log("Sample Brand products type:", typeof sampleBrand?.products);

  const sampleCategory = await prisma.category.findFirst({
    include: {
      products: true
    }
  });
  console.log("Sample Category products type:", typeof sampleCategory?.products);
}

main().catch(err => {
  console.error(err);
}).finally(() => {
  prisma.$disconnect();
});
