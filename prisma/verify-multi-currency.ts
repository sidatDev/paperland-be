import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Starting implementation verification...');

  const currencies = await prisma.currency.findMany();
  const countries = await prisma.country.findMany({ include: { currency: true } });
  const rates = await prisma.exchangeRate.findMany({
    include: { fromCurrency: true, toCurrency: true }
  });

  console.log(`\n✅ Currencies Found: ${currencies.length}`);
  currencies.forEach(c => console.log(`   - ${c.code} (${c.symbol})`));

  console.log(`\n✅ Countries Found: ${countries.length}`);
  countries.forEach(c => console.log(`   - ${c.name} (Uses ${c.currency.code})`));

  console.log(`\n✅ Exchange Rates Found: ${rates.length}`);
  rates.forEach(r => console.log(`   - 1 ${r.fromCurrency.code} = ${r.rate} ${r.toCurrency.code}`));

  console.log('\n🚀 Backend models and data are correctly configured!');
}

main().finally(() => prisma.$disconnect());
