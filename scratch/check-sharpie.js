const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.product.findFirst({
        where: { id: 'f14113e3-3f31-45eb-b560-8ceacd4f9fd5' },
        select: { id: true, name: true, status: true, specifications: true, stocks: { select: { qty: true, reservedQty: true } } }
    });
    console.log(JSON.stringify(p, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
