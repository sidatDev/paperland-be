require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const userId = "29e255a3-ee99-4e1e-ba0b-3db4d2cc9187"; // Using the user ID related to previous debugging
  const addresses = await prisma.address.findMany({
    where: { userId: userId },
    include: { country: true },
  });
  console.log("User Addresses:", JSON.stringify(addresses, null, 2));
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
