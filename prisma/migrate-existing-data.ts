import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting data migration for existing records...');

  // 1. Get IDs for SAR and SA
  const sarCurrency = await prisma.currency.findUnique({
    where: { code: 'SAR' }
  });

  const saCountry = await prisma.country.findUnique({
    where: { code: 'SA' }
  });

  if (!sarCurrency || !saCountry) {
    throw new Error('❌ SAR currency or SA country not found. Please ensure Step 2 (seeding) was successful.');
  }

  console.log(`📍 Found IDs: SAR(${sarCurrency.id}), SA(${saCountry.id})`);

  // 2. Update Prices
  console.log('💰 Updating Prices...');
  const priceUpdate = await prisma.$executeRawUnsafe(
    `UPDATE prices SET currency_id = '${sarCurrency.id}' WHERE currency_id IS NULL`
  );
  console.log(`✅ Updated ${priceUpdate} prices`);

  // 3. Update Orders
  console.log('📦 Updating Orders...');
  const orderUpdate = await prisma.$executeRawUnsafe(
    `UPDATE orders SET currency_id = '${sarCurrency.id}' WHERE currency_id IS NULL`
  );
  console.log(`✅ Updated ${orderUpdate} orders`);

  // 4. Update Transactions
  console.log('💳 Updating Transactions...');
  const transactionUpdate = await prisma.$executeRawUnsafe(
    `UPDATE transactions SET currency_id = '${sarCurrency.id}' WHERE currency_id IS NULL`
  );
  console.log(`✅ Updated ${transactionUpdate} transactions`);

  // 5. Update Addresses
  console.log('🏠 Updating Addresses...');
  const addressUpdate = await prisma.$executeRawUnsafe(
    `UPDATE addresses SET country_id = '${saCountry.id}' WHERE country_id IS NULL`
  );
  console.log(`✅ Updated ${addressUpdate} addresses`);

  // 6. Update ShippingZones
  console.log('🚚 Updating Shipping Zones...');
  const zoneUpdate = await prisma.$executeRawUnsafe(
    `UPDATE shipping_zones SET country_id = '${saCountry.id}' WHERE country_id IS NULL`
  );
  console.log(`✅ Updated ${zoneUpdate} shipping zones`);

  console.log('🎉 Data migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
