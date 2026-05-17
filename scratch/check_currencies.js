const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrencies() {
    try {
        const currencies = await prisma.currency.findMany();
        console.log("Currencies in DB:");
        console.table(currencies.map(c => ({ id: c.id, code: c.code, name: c.name, isActive: c.isActive })));
    } catch (error) {
        console.error("Error checking currencies:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCurrencies();
