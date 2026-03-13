
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const warehouse = await prisma.warehouse.findFirst({
    where: {
      OR: [
        { id: 'default-main-warehouse' },
        { code: 'default-main-warehouse' }
      ]
    }
  });
  console.log(JSON.stringify(warehouse, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
