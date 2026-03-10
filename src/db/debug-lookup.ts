import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const countries = await prisma.country.findMany();
    const currencies = await prisma.currency.findMany();
    console.log('Countries:', JSON.stringify(countries, null, 2));
    console.log('Currencies:', JSON.stringify(currencies, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
