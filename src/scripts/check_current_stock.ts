import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { contains: 'DEL-STA-1592', mode: 'insensitive' } }
      ]
    },
    include: {
      stocks: {
        include: { warehouse: true }
      },
      variants: {
        include: { stocks: true }
      }
    }
  });

  console.log("=== DB PRODUCTS FOR DEL-STA-1592 ===");
  for (const p of products) {
    console.log(`ID: ${p.id} | SKU: ${p.sku} | ParentId: ${p.parentId} | Status: ${p.status} | DeletedAt: ${p.deletedAt}`);
    console.log(`Stocks (${p.stocks.length}):`, p.stocks.map(s => ({ id: s.id, qty: s.qty, warehouseId: s.warehouseId })));
    console.log(`Variants (${p.variants.length}):`, p.variants.map(v => v.sku));
    console.log("-----------------------------------------");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
