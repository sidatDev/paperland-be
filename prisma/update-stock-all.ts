import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting global stock update...');
    
    // 1. Update all existing stock records to 100
    const updateResult = await prisma.stock.updateMany({
        data: {
            qty: 100
        }
    });
    console.log(`✅ Updated ${updateResult.count} existing stock records to 100.`);

    // 2. Find products that don't have ANY stock records and create one for them
    const productsWithoutStock = await prisma.product.findMany({
        where: {
            stocks: {
                none: {}
            }
        },
        select: {
            id: true,
            name: true
        }
    });

    if (productsWithoutStock.length > 0) {
        console.log(`🔍 Found ${productsWithoutStock.length} products without stock records. Creating 'MAIN' stock for them...`);
        
        let createdCount = 0;
        for (const product of productsWithoutStock) {
            await prisma.stock.create({
                data: {
                    productId: product.id,
                    locationId: 'MAIN',
                    qty: 100
                }
            });
            createdCount++;
        }
        console.log(`✅ Created ${createdCount} new stock records.`);
    }

    console.log('✨ All products now have a stock of 100.');
}

main()
    .catch((e) => {
        console.error('❌ Error updating stocks:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
