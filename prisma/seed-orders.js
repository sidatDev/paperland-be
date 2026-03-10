"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Helper to create sync log with multiple attempts
function createSyncLog(syncStatus, orderNumber, attempts = 1) {
    const logs = [];
    const now = new Date();
    if (syncStatus === 'SUCCESS') {
        // Add failed attempts before success
        for (let i = attempts - 1; i > 0; i--) {
            const attemptDate = new Date(now.getTime() - (i * 15 * 60 * 1000)); // 15 min intervals
            logs.push({
                attemptedAt: attemptDate.toISOString(),
                status: 'FAILED',
                message: i % 2 === 0 ? 'Connection timeout with ERP gateway' : 'Invalid credentials',
                code: i % 2 === 0 ? 504 : 401
            });
        }
        // Final success
        logs.push({
            attemptedAt: now.toISOString(),
            status: 'SUCCESS',
            message: 'Synced successfully with ERP',
            code: 200,
            erpOrderId: `ERP-${orderNumber}`
        });
    }
    else if (syncStatus === 'FAILED') {
        // Multiple failed attempts
        for (let i = 0; i < attempts; i++) {
            const attemptDate = new Date(now.getTime() - ((attempts - i) * 10 * 60 * 1000));
            logs.push({
                attemptedAt: attemptDate.toISOString(),
                status: 'FAILED',
                message: i % 3 === 0
                    ? 'Connection timeout with ERP gateway'
                    : i % 3 === 1
                        ? 'Duplicate ERP Order ID detected'
                        : 'ERP service unavailable',
                code: i % 3 === 0 ? 504 : i % 3 === 1 ? 409 : 503
            });
        }
    }
    else {
        // PENDING - no attempts yet or initial attempt
        if (attempts > 0) {
            logs.push({
                attemptedAt: now.toISOString(),
                status: 'PENDING',
                message: 'Waiting for ERP sync',
                code: 0
            });
        }
    }
    return logs;
}
async function main() {
    console.log('Start seeding orders with ERP sync logs...');
    // 1. Fetch dependencies
    const users = await prisma.user.findMany({ take: 10, include: { addresses: true } });
    if (users.length === 0) {
        console.log("No users found. Please seed users first.");
        return;
    }
    const product = await prisma.product.findFirst();
    if (!product) {
        console.log("No products found. Please seed products first.");
        return;
    }
    const sar = await prisma.currency.findFirst({ where: { code: 'SAR' } });
    const aed = await prisma.currency.findFirst({ where: { code: 'AED' } });
    const pkr = await prisma.currency.findFirst({ where: { code: 'PKR' } });
    const currencies = { SAR: sar?.id, AED: aed?.id, PKR: pkr?.id };
    // 2. Define comprehensive mock data for filter testing
    const ordersToSeed = [
        // PENDING orders - for status filter testing
        {
            orderNumber: "ORD-2026-101",
            date: new Date("2026-01-23T08:30:00"),
            status: "PENDING",
            currencyCode: "SAR",
            total: 15000,
            tax: 2250,
            syncStatus: "PENDING",
            syncAttempts: 0
        },
        {
            orderNumber: "ORD-2026-102",
            date: new Date("2026-01-22T14:20:00"),
            status: "PENDING",
            currencyCode: "AED",
            total: 8500,
            tax: 425,
            syncStatus: "PENDING",
            syncAttempts: 1
        },
        // PROCESSING orders
        {
            orderNumber: "ORD-2026-103",
            date: new Date("2026-01-22T10:15:00"),
            status: "PROCESSING",
            currencyCode: "SAR",
            total: 32000,
            tax: 4800,
            syncStatus: "SUCCESS",
            syncAttempts: 1
        },
        {
            orderNumber: "ORD-2026-104",
            date: new Date("2026-01-21T16:45:00"),
            status: "PROCESSING",
            currencyCode: "PKR",
            total: 450000,
            tax: 67500,
            syncStatus: "SUCCESS",
            syncAttempts: 2 // Had one failure before success
        },
        // SHIPPED orders
        {
            orderNumber: "ORD-2026-105",
            date: new Date("2026-01-20T09:30:00"),
            status: "SHIPPED",
            currencyCode: "SAR",
            total: 78000,
            tax: 11700,
            syncStatus: "SUCCESS",
            syncAttempts: 1
        },
        {
            orderNumber: "ORD-2026-106",
            date: new Date("2026-01-19T11:00:00"),
            status: "SHIPPED",
            currencyCode: "AED",
            total: 25000,
            tax: 1250,
            syncStatus: "SUCCESS",
            syncAttempts: 3 // Multiple retries before success
        },
        // DELIVERED orders
        {
            orderNumber: "ORD-2026-107",
            date: new Date("2026-01-18T13:20:00"),
            status: "DELIVERED",
            currencyCode: "SAR",
            total: 95000,
            tax: 14250,
            syncStatus: "SUCCESS",
            syncAttempts: 1
        },
        {
            orderNumber: "ORD-2026-108",
            date: new Date("2026-01-15T10:30:00"),
            status: "DELIVERED",
            currencyCode: "PKR",
            total: 680000,
            tax: 102000,
            syncStatus: "SUCCESS",
            syncAttempts: 1
        },
        // CANCELLED orders
        {
            orderNumber: "ORD-2026-109",
            date: new Date("2026-01-17T15:40:00"),
            status: "CANCELLED",
            currencyCode: "AED",
            total: 12000,
            tax: 600,
            syncStatus: "FAILED",
            syncAttempts: 4 // Multiple failures
        },
        // Orders with FAILED sync status for testing
        {
            orderNumber: "ORD-2026-110",
            date: new Date("2026-01-22T12:00:00"),
            status: "PENDING",
            currencyCode: "SAR",
            total: 45000,
            tax: 6750,
            syncStatus: "FAILED",
            syncAttempts: 3
        },
        {
            orderNumber: "ORD-2026-111",
            date: new Date("2026-01-21T08:15:00"),
            status: "PROCESSING",
            currencyCode: "AED",
            total: 18500,
            tax: 925,
            syncStatus: "FAILED",
            syncAttempts: 2
        },
        // Older orders for date range testing
        {
            orderNumber: "ORD-2026-080",
            date: new Date("2026-01-10T09:00:00"),
            status: "DELIVERED",
            currencyCode: "SAR",
            total: 120000,
            tax: 18000,
            syncStatus: "SUCCESS",
            syncAttempts: 1
        },
        {
            orderNumber: "ORD-2026-081",
            date: new Date("2026-01-05T14:30:00"),
            status: "DELIVERED",
            currencyCode: "PKR",
            total: 850000,
            tax: 127500,
            syncStatus: "SUCCESS",
            syncAttempts: 2
        },
        {
            orderNumber: "ORD-2025-999",
            date: new Date("2025-12-28T10:00:00"),
            status: "DELIVERED",
            currencyCode: "AED",
            total: 95000,
            tax: 4750,
            syncStatus: "SUCCESS",
            syncAttempts: 1
        },
        // Edge case: Very recent order
        {
            orderNumber: "ORD-2026-112",
            date: new Date(), // Today
            status: "PENDING",
            currencyCode: "SAR",
            total: 22000,
            tax: 3300,
            syncStatus: "PENDING",
            syncAttempts: 0
        }
    ];
    for (const order of ordersToSeed) {
        // Assign users cyclically for variety in search testing
        const userIndex = parseInt(order.orderNumber.split('-').pop() || '0') % users.length;
        const user = users[userIndex];
        let addressId = user.addresses[0]?.id;
        // If user has no address, create one
        if (!addressId) {
            const country = await prisma.country.findFirst() || await prisma.country.create({
                data: { code: 'SA', name: 'Saudi Arabia', currencyId: currencies['SAR'] }
            });
            const newAddr = await prisma.address.create({
                data: {
                    userId: user.id,
                    firstName: user.firstName || "Test",
                    lastName: user.lastName || "User",
                    city: "Riyadh",
                    phone: "123456789",
                    street1: "Test St",
                    zipCode: "12345",
                    type: "SHIPPING",
                    countryId: country.id
                }
            });
            addressId = newAddr.id;
            console.log(`Created address for user ${user.email}`);
        }
        const currencyId = currencies[order.currencyCode] || currencies['SAR'];
        const existing = await prisma.order.findUnique({ where: { orderNumber: order.orderNumber } });
        if (existing) {
            console.log(`Order ${order.orderNumber} already exists. Skipping.`);
            continue;
        }
        // Create ERP sync log with multiple attempts
        const erpSyncLog = createSyncLog(order.syncStatus, order.orderNumber, order.syncAttempts);
        // CHANGED: Always assign ERP ID regardless of sync status
        const erpOrderId = `ERP-${order.orderNumber}`;
        await prisma.order.create({
            data: {
                orderNumber: order.orderNumber,
                userId: user.id,
                addressId: addressId,
                totalAmount: order.total,
                taxAmount: order.tax,
                shippingAmount: 0,
                currencyId: currencyId,
                status: order.status,
                erpOrderId: erpOrderId,
                erpSyncStatus: order.syncStatus,
                erpSyncLog: erpSyncLog.length > 0 ? erpSyncLog : undefined, // Store as JSON array
                createdAt: order.date,
                updatedAt: order.date,
                items: {
                    create: [
                        {
                            productId: product.id,
                            quantity: 1,
                            price: order.total,
                            sku: "MOCK-" + order.orderNumber,
                        }
                    ]
                }
            }
        });
        console.log(`Created order ${order.orderNumber} with ${erpSyncLog.length} sync attempts`);
    }
    console.log('\n✅ Order seeding complete!');
    console.log('Test data coverage:');
    console.log('- Status filter: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED');
    console.log('- Date range: Last 30 days with various timestamps');
    console.log('- ERP Sync: SUCCESS, FAILED, PENDING with multiple attempts');
    console.log('- Search: Various users with different emails for testing');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
