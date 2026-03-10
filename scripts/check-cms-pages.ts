import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const pages = await prisma.cMSPage.findMany();
    console.log('Total Pages:', pages.length);
    console.log(JSON.stringify(pages, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
