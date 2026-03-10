"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function truncate() {
    console.log('Starting product truncation...');
    try {
        // Delete dependent records first where cascade might be missing or to be safe
        console.log('Deleting Stocks...');
        await prisma.stock.deleteMany({});
        console.log('Deleting CartItems...');
        await prisma.cartItem.deleteMany({});
        console.log('Deleting OrderItems...');
        await prisma.orderItem.deleteMany({});
        // Note: Model name might be rFQItem or rfqItem depending on Prisma generation
        console.log('Deleting RFQItems...');
        try {
            // @ts-ignore
            await prisma.rFQItem.deleteMany({});
        }
        catch {
            // @ts-ignore
            await prisma.rfqItem.deleteMany({});
        }
        console.log('Deleting Reviews...');
        await prisma.review.deleteMany({});
        // Prices and Batches likely have cascade, but deleting them explicitly doesn't hurt
        console.log('Deleting Prices...');
        await prisma.price.deleteMany({});
        console.log('Deleting Products...');
        await prisma.product.deleteMany({});
        console.log('Truncation complete. All products deleted.');
    }
    catch (error) {
        console.error('Error truncating products:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
truncate();
