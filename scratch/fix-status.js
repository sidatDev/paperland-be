const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.product.update({
        where: { id: 'f14113e3-3f31-45eb-b560-8ceacd4f9fd5' },
        data: { status: 'Active' }
    });
    console.log('Reset product status to Active:', p.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
