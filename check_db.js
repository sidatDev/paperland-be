
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const latest = await prisma.productRelation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        sourceProduct: { select: { id: true, name: true, sku: true } },
        targetProduct: { select: { id: true, name: true, sku: true } }
      }
    });
    
    latest.forEach(r => {
      console.log(`[${r.type}] SrcID: ${r.sourceProduct.id} (${r.sourceProduct.sku}) -> TgtID: ${r.targetProduct.id} (${r.targetProduct.sku})`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
