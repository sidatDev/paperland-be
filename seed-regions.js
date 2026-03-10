require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const currencies = [
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", decimalPlaces: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimalPlaces: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimalPlaces: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
];

const countries = [
  { name: "Saudi Arabia", code: "SA", currencyCode: "SAR", phoneCode: "+966" },
  { name: "Pakistan", code: "PK", currencyCode: "PKR", phoneCode: "+92" },
  {
    name: "United Arab Emirates",
    code: "AE",
    currencyCode: "AED",
    phoneCode: "+971",
  },
];

async function main() {
  console.log("Seeding Currencies...");
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    console.log(`Ensured Currency: ${c.code}`);
  }

  console.log("Seeding Countries...");
  for (const c of countries) {
    const currency = await prisma.currency.findUnique({
      where: { code: c.currencyCode },
    });
    if (!currency) {
      console.error(`Currency ${c.currencyCode} not found for ${c.name}`);
      continue;
    }

    await prisma.country.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        currencyId: currency.id,
      },
      create: {
        name: c.name,
        code: c.code,
        currencyId: currency.id,
      },
    });
    console.log(`Ensured Country: ${c.name}`);
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
