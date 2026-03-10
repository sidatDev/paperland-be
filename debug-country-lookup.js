require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Testing Country Lookup...");

  const input = "Pakistan";
  const countryData = await prisma.country.findFirst({
    where: { name: { equals: input, mode: "insensitive" } },
  });
  console.log(`Input: "${input}"`);
  console.log("Found:", JSON.stringify(countryData, null, 2));

  const input2 = "Saudi Arabia";
  const countryData2 = await prisma.country.findFirst({
    where: { name: { equals: input2, mode: "insensitive" } },
  });
  console.log(`Input: "${input2}"`);
  console.log("Found:", JSON.stringify(countryData2, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
