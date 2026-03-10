import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAll() {
    console.log('Cleaning up data...');

    // 1. Delete dependent transactional data first
    console.log('Deleting Order Items...');
    await prisma.orderItem.deleteMany();
    
    console.log('Deleting Orders...');
    await prisma.order.deleteMany();

    console.log('Deleting Cart Items...');
    await prisma.cartItem.deleteMany();

    console.log('Deleting RFQ Items...');
    await prisma.rFQItem.deleteMany();

    console.log('Deleting Reviews...');
    await prisma.review.deleteMany();

    // 2. Delete Product related data
    console.log('Deleting Stocks...');
    await prisma.stock.deleteMany();

    console.log('Deleting Prices...');
    await prisma.price.deleteMany();
    
    console.log('Deleting Product Industries...');
    await prisma.productIndustry.deleteMany();

    console.log('Deleting Batches...');
    await prisma.batch.deleteMany();

    // 3. Finally Delete Products
    console.log('Deleting Products...');
    await prisma.product.deleteMany();

    console.log('All product and order data removed.');
}

deleteAll()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
