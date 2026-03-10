const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreBackup() {
  try {
    console.log('🔄 Starting INTELLIGENT database restore v2...');

    const backupFile = 'backups/backup-before-blog-migration-2026-02-06T12-29-50-088Z.json';
    const filePath = path.join(__dirname, backupFile);
    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // --- 1. RESTORE/CREATE DEPENDENCIES ---
    
    // 1.1 Currency
    // Collect all Currency IDs needed by Orders (and Products/Prices if applicable)
    const neededCurrencyIds = new Set();
    if (backupData.orders) backupData.orders.forEach(o => { if(o.currencyId) neededCurrencyIds.add(o.currencyId); });
    // Also add a default one if set is empty
    if (neededCurrencyIds.size === 0) neededCurrencyIds.add('default-usd');

    console.log(`🛠️  Ensuring ${neededCurrencyIds.size} Currencies exist...`);
    
    let defaultCurrencyId = null;

    for (const curId of neededCurrencyIds) {
        const existing = await prisma.currency.findUnique({ where: { id: curId } });
        if (!existing) {
            await prisma.currency.create({
                data: {
                    id: curId, // Preserve ID
                    code: 'USD', // Placeholder
                    name: 'Restored Currency',
                    symbol: '$',
                    decimalPlaces: 2,
                    isActive: true
                }
            });
            console.log(`  ✅ Created Placeholder Currency: ${curId}`);
        }
        if (!defaultCurrencyId) defaultCurrencyId = curId;
    }

    // 1.2 Country
    // We need at least one country for Addresses
    // Check if any country exists
    let defaultCountry = await prisma.country.findFirst();
    if (!defaultCountry) {
        defaultCountry = await prisma.country.create({
            data: {
                name: 'Default Country',
                code: 'DEF',
                // taxRate: 0, // Default is 0
                isActive: true,
                currencyId: defaultCurrencyId // Link to valid currency
            }
        });
        console.log('  ✅ Created Default Country');
    }

    // 1.3 Industry (Already handled, but check again)
    let defaultIndustry = await prisma.industry.findFirst({ where: { slug: 'default-industry' } });
    if (!defaultIndustry) {
        defaultIndustry = await prisma.industry.create({
            data: {
                name: 'Uncategorized Industry',
                slug: 'default-industry',
                description: 'Placeholder for missing industry'
            }
        });
        console.log('  ✅ Created Default Industry');
    }

    // --- 2. RESTORE DATA ---

    // 2.1 Products
    if (backupData.products) {
        console.log('\\n📝 Restoring Products...');
        for (const product of backupData.products) {
            try {
                if (product.industryId) {
                    const ind = await prisma.industry.findUnique({ where: { id: product.industryId } });
                    if (!ind) product.industryId = defaultIndustry.id;
                }
                
                await prisma.product.upsert({
                    where: { id: product.id },
                    update: product,
                    create: product
                });
            } catch (e) {
                console.log(`  ⚠️  Skipped/Failed Product: ${product.sku} - ${e.message}`);
            }
        }
    }

    // 2.2 Orders
    if (backupData.orders) {
        console.log('\\n📝 Restoring Orders...');
        for (const order of backupData.orders) {
            try {
                // Ensure Address Exists
                if (order.addressId) {
                    const addr = await prisma.address.findUnique({ where: { id: order.addressId } });
                    if (!addr) {
                        try {
                            await prisma.address.create({
                                data: {
                                    id: order.addressId,
                                    userId: order.userId,
                                    firstName: 'Restored',
                                    lastName: 'User',
                                    street1: 'Address Data Lost',
                                    city: 'Unknown',
                                    // state: 'Unknown', // Optional
                                    zipCode: '00000',
                                    phone: '0000000000',
                                    countryId: defaultCountry.id, // REQUIRED
                                    type: 'SHIPPING' // Default
                                }
                            });
                            console.log(`  ➕ Created Dummy Address for Order ${order.orderNumber}`);
                        } catch (addrErr) {
                            console.log(`  ❌ Failed to create address ${order.addressId}: ${addrErr.message}`);
                            // If address creation fails, order creation will fail.
                        }
                    }
                }

                // Ensure Currency Exists (Double check)
                if (order.currencyId) {
                   const cur = await prisma.currency.findUnique({ where: { id: order.currencyId } });
                   if (!cur) {
                       // Should be created above but just in case
                       console.log(`  ⚠️  Currency ${order.currencyId} missing for order ${order.orderNumber}, creating fallback...`);
                       await prisma.currency.create({
                           data: { id: order.currencyId, code: 'UNK', name: 'Unknown', symbol: '?', decimalPlaces: 2 }
                       });
                   }
                }

                await prisma.order.upsert({
                    where: { id: order.id },
                    update: order,
                    create: order
                });
                console.log(`  ✅ Restored Order: ${order.orderNumber}`);
                
            } catch (e) {
                console.log(`  ❌ Failed Order ${order.orderNumber}: ${e.message}`);
            }
        }
    }
    
    console.log('\\n✅ Intelligent restore v2 completed!');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

restoreBackup();
