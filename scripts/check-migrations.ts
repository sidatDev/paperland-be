import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations`;
  console.log(JSON.stringify(migrations, null, 2));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
