import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ===== CURRENCIES =====
  console.log('📊 Seeding currencies...');
  
  const sarCurrency = await prisma.currency.upsert({
    where: { code: 'SAR' },
    update: {},
    create: {
      code: 'SAR',
      name: 'Saudi Riyal',
      symbol: '﷼',
      decimalPlaces: 2,
      isActive: true,
    },
  });

  const pkrCurrency = await prisma.currency.upsert({
    where: { code: 'PKR' },
    update: {},
    create: {
      code: 'PKR',
      name: 'Pakistani Rupee',
      symbol: '₨',
      decimalPlaces: 2,
      isActive: true,
    },
  });

  const aedCurrency = await prisma.currency.upsert({
    where: { code: 'AED' },
    update: {},
    create: {
      code: 'AED',
      name: 'UAE Dirham',
      symbol: 'د.إ',
      decimalPlaces: 2,
      isActive: true,
    },
  });

  const usdCurrency = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      isActive: true,
    },
  });

  console.log('✅ Currencies seeded');

  // ===== COUNTRIES =====
  console.log('🌍 Seeding countries...');

  const saudiArabia = await prisma.country.upsert({
    where: { code: 'SA' },
    update: {},
    create: {
      code: 'SA',
      name: 'Saudi Arabia',
      currencyId: sarCurrency.id,
      taxRate: 15.00, // 15% VAT
      isActive: true,
    },
  });

  const pakistan = await prisma.country.upsert({
    where: { code: 'PK' },
    update: {},
    create: {
      code: 'PK',
      name: 'Pakistan',
      currencyId: pkrCurrency.id,
      taxRate: 17.00, // 17% GST
      isActive: true,
    },
  });

  const uae = await prisma.country.upsert({
    where: { code: 'AE' },
    update: {},
    create: {
      code: 'AE',
      name: 'United Arab Emirates',
      currencyId: aedCurrency.id,
      taxRate: 5.00, // 5% VAT
      isActive: true,
    },
  });

  console.log('✅ Countries seeded');

  // ===== EXCHANGE RATES =====
  console.log('💱 Seeding exchange rates...');

  const validFrom = new Date('2024-01-01');

  // SAR to PKR
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyId_toCurrencyId_validFrom: {
        fromCurrencyId: sarCurrency.id,
        toCurrencyId: pkrCurrency.id,
        validFrom: validFrom,
      },
    },
    update: {},
    create: {
      fromCurrencyId: sarCurrency.id,
      toCurrencyId: pkrCurrency.id,
      rate: 74.50, // 1 SAR = 74.50 PKR (approximate)
      validFrom: validFrom,
    },
  });

  // SAR to AED
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyId_toCurrencyId_validFrom: {
        fromCurrencyId: sarCurrency.id,
        toCurrencyId: aedCurrency.id,
        validFrom: validFrom,
      },
    },
    update: {},
    create: {
      fromCurrencyId: sarCurrency.id,
      toCurrencyId: aedCurrency.id,
      rate: 0.98, // 1 SAR = 0.98 AED (approximate)
      validFrom: validFrom,
    },
  });

  // SAR to USD
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyId_toCurrencyId_validFrom: {
        fromCurrencyId: sarCurrency.id,
        toCurrencyId: usdCurrency.id,
        validFrom: validFrom,
      },
    },
    update: {},
    create: {
      fromCurrencyId: sarCurrency.id,
      toCurrencyId: usdCurrency.id,
      rate: 0.27, // 1 SAR = 0.27 USD (approximate)
      validFrom: validFrom,
    },
  });

  // PKR to SAR
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyId_toCurrencyId_validFrom: {
        fromCurrencyId: pkrCurrency.id,
        toCurrencyId: sarCurrency.id,
        validFrom: validFrom,
      },
    },
    update: {},
    create: {
      fromCurrencyId: pkrCurrency.id,
      toCurrencyId: sarCurrency.id,
      rate: 0.0134, // 1 PKR = 0.0134 SAR (approximate)
      validFrom: validFrom,
    },
  });

  // AED to SAR
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrencyId_toCurrencyId_validFrom: {
        fromCurrencyId: aedCurrency.id,
        toCurrencyId: sarCurrency.id,
        validFrom: validFrom,
      },
    },
    update: {},
    create: {
      fromCurrencyId: aedCurrency.id,
      toCurrencyId: sarCurrency.id,
      rate: 1.02, // 1 AED = 1.02 SAR (approximate)
      validFrom: validFrom,
    },
  });

  console.log('✅ Exchange rates seeded');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
