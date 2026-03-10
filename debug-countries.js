const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const countries = await prisma.country.findMany();
  console.log("Countries in DB:", JSON.stringify(countries, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
