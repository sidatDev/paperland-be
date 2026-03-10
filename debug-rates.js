const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const currencies = await prisma.currency.findMany();
  console.log("Currencies:", JSON.stringify(currencies, null, 2));

  const rates = await prisma.exchangeRate.findMany({
    include: {
      fromCurrency: true,
      toCurrency: true,
    },
  });
  console.log("Exchange Rates:", JSON.stringify(rates, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
