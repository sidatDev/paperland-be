import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.globalSettings.findFirst();
  console.log('Global Settings:', JSON.stringify(settings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
