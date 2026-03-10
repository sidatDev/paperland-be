const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreBackup() {
  try {
    console.log('🔄 Starting INTELLIGENT database restore...');
    
    // 1. Create Default Placeholders for missing dependencies
    console.log('🛠️  Creating Placeholders for missing dependencies...');
    
    // Country Placeholder
    let defaultCountry = await prisma.country.findFirst({ where: { code: 'DEF' } });
    if (!defaultCountry) {
        defaultCountry = await prisma.country.create({
            data: {
                name: 'Default Country',
                code: 'DEF',
                dialCode: '+000',
                isActive: true
            }
        });
        console.log('  ✅ Created Default Country');
    }

    // Industry Placeholder
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

    const backupFile = 'backups/backup-before-blog-migration-2026-02-06T12-29-50-088Z.json';
    const filePath = path.join(__dirname, backupFile);
    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // --- RESTORE LOGIC ---

    // ... (Users, Roles, Permissions, Categories, Brands, GlobalSettings - already restored or skipped)

    // 7. Products (Retry with Industry Fix)
    if (backupData.products) {
        console.log('\\n📝 Restoring Products (Smart Mode)...');
        for (const product of backupData.products) {
            try {
                // If Industry missing, set to default
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

    // 8. Orders (With Dummy Address Creation)
    if (backupData.orders) {
        console.log('\\n📝 Restoring Orders (With Dummy Addresses)...');
        for (const order of backupData.orders) {
            try {
                // Check/Create Address
                if (order.addressId) {
                    const addr = await prisma.address.findUnique({ where: { id: order.addressId } });
                    if (!addr) {
                        // Create Dummy Address
                        await prisma.address.create({
                            data: {
                                id: order.addressId, // KEEP ORIGINAL ID
                                userId: order.userId,
                                firstName: 'Restored',
                                lastName: 'User',
                                street1: 'Address Data Lost in Migration',
                                city: 'Unknown',
                                state: 'Unknown',
                                zipCode: '00000',
                                countryId: defaultCountry.id,
                                phone: '0000000000'
                            }
                        });
                        console.log(`  ➕ Created Dummy Address for Order ${order.orderNumber}`);
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
    
    console.log('\\n✅ Intelligent restore completed!');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

restoreBackup();
