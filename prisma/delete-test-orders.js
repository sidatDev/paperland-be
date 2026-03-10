"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Deleting 2026 orders and their items...');
    // First, find all 2026 orders
    const orders = await prisma.order.findMany({
        where: {
            orderNumber: {
                startsWith: 'ORD-2026'
            }
        },
        select: { id: true }
    });
    const orderIds = orders.map(o => o.id);
    console.log(`Found ${orderIds.length} orders to delete`);
    // Delete order items first (due to foreign key)
    const itemsDeleted = await prisma.orderItem.deleteMany({
        where: {
            orderId: {
                in: orderIds
            }
        }
    });
    console.log(`Deleted ${itemsDeleted.count} order items`);
    // Now delete the orders
    const result = await prisma.order.deleteMany({
        where: {
            id: {
                in: orderIds
            }
        }
    });
    console.log(`Deleted ${result.count} orders`);
    console.log('✅ Cleanup complete!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
