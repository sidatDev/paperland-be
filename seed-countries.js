require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const countries = [
  { name: "Saudi Arabia", code: "SA", phoneCode: "+966" },
  { name: "United Arab Emirates", code: "AE", phoneCode: "+971" },
  { name: "Pakistan", code: "PK", phoneCode: "+92" },
];

async function main() {
  for (const country of countries) {
    const existing = await prisma.country.findFirst({
      where: { name: { equals: country.name, mode: "insensitive" } },
    });

    if (!existing) {
      console.log(`Creating country: ${country.name}`);
      await prisma.country.create({
        data: {
          name: country.name,
          code: country.code,
          phoneCode: country.phoneCode,
        },
      });
    } else {
      console.log(`Country exists: ${country.name}`);
    }
  }
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
