"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const counts = await Promise.all([
        prisma.$queryRawUnsafe('SELECT COUNT(*) FROM prices'),
        prisma.$queryRawUnsafe('SELECT COUNT(*) FROM orders'),
        prisma.$queryRawUnsafe('SELECT COUNT(*) FROM transactions'),
        prisma.$queryRawUnsafe('SELECT COUNT(*) FROM addresses'),
    ]);
    console.log('📊 Current Record Counts:');
    console.log('Prices:', counts[0]);
    console.log('Orders:', counts[1]);
    console.log('Transactions:', counts[2]);
    console.log('Addresses:', counts[3]);
}
main().finally(() => prisma.$disconnect());
