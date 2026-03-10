const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Updating all orders to SAR...');
    
    // 1. Get SAR currency
    const sar = await prisma.currency.findUnique({ where: { code: 'SAR' } });
    if (!sar) {
        throw new Error('SAR currency not found in database. Please run fix-db-data.js first.');
    }

    // 2. Update all orders
    const result = await prisma.order.updateMany({
        data: {
            currencyId: sar.id
        }
    });
    
    console.log(`Successfully updated ${result.count} orders to SAR (Currency ID: ${sar.id}).`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
