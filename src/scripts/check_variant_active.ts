import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const v = await prisma.product.findUnique({
    where: { id: '714bac5d-586a-41d4-a715-35d57a7d9999' }
  });
  console.log("VARIANT 714bac5d-586a-41d4-a715-35d57a7d9999:", {
    id: v?.id,
    sku: v?.sku,
    isActive: v?.isActive,
    status: v?.status,
    deletedAt: v?.deletedAt,
    isVisibleOnEcommerce: v?.isVisibleOnEcommerce
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
