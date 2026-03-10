const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreBackup() {
  try {
    console.log('🔄 Starting database restore...');
    
    const backupFile = 'backups/backup-before-blog-migration-2026-02-06T12-29-50-088Z.json';
    const filePath = path.join(__dirname, backupFile);
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Backup file not found!');
      process.exit(1);
    }
    
    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    console.log('📊 Backup contains:');
    console.log(`  - Users: ${backupData.users?.length || 0}`);
    console.log(`  - Roles: ${backupData.roles?.length || 0}`);
    console.log(`  - Categories: ${backupData.categories?.length || 0}`);
    console.log(`  - Brands: ${backupData.brands?.length || 0}`);
    console.log(`  - Products: ${backupData.products?.length || 0}`);
    console.log(`  - Orders: ${backupData.orders?.length || 0}`);
    console.log(`  - CMS Pages: ${backupData.cmsPages?.length || 0}`);
    
    // Restore in order (respecting foreign keys)
    
    // 1. Global Settings
    if (backupData.globalSettings && backupData.globalSettings.length > 0) {
      console.log('\\n📝 Restoring Global Settings...');
      for (const setting of backupData.globalSettings) {
        try {
          await prisma.globalSettings.upsert({
            where: { id: setting.id },
            update: setting,
            create: setting
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${setting.id}`);
        }
      }
    }
    
    // 2. Roles
    if (backupData.roles && backupData.roles.length > 0) {
      console.log('\\n📝 Restoring Roles...');
      for (const role of backupData.roles) {
        try {
          await prisma.role.upsert({
            where: { id: role.id },
            update: role,
            create: role
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${role.name}`);
        }
      }
    }
    
    // 3. Permissions
    if (backupData.permissions && backupData.permissions.length > 0) {
      console.log('\\n📝 Restoring Permissions...');
      for (const permission of backupData.permissions) {
        try {
          await prisma.permission.upsert({
            where: { id: permission.id },
            update: permission,
            create: permission
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${permission.key}`);
        }
      }
    }
    
    // 4. Users
    if (backupData.users && backupData.users.length > 0) {
      console.log('\\n📝 Restoring Users...');
      for (const user of backupData.users) {
        try {
          await prisma.user.upsert({
            where: { id: user.id },
            update: user,
            create: user
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${user.email}`);
        }
      }
    }
    
    // 5. Categories
    if (backupData.categories && backupData.categories.length > 0) {
      console.log('\\n📝 Restoring Categories...');
      for (const category of backupData.categories) {
        try {
          await prisma.category.upsert({
            where: { id: category.id },
            update: category,
            create: category
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${category.name}`);
        }
      }
    }
    
    // 6. Brands
    if (backupData.brands && backupData.brands.length > 0) {
      console.log('\\n📝 Restoring Brands...');
      for (const brand of backupData.brands) {
        try {
          await prisma.brand.upsert({
            where: { id: brand.id },
            update: brand,
            create: brand
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${brand.name}`);
        }
      }
    }
    
    // 7. Products
    if (backupData.products && backupData.products.length > 0) {
      console.log('\\n📝 Restoring Products...');
      for (const product of backupData.products) {
        try {
          await prisma.product.upsert({
            where: { id: product.id },
            update: product,
            create: product
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${product.sku}`);
        }
      }
    }
    
    // 8. Orders
    if (backupData.orders && backupData.orders.length > 0) {
      console.log('\\n📝 Restoring Orders...');
      for (const order of backupData.orders) {
        try {
          await prisma.order.upsert({
            where: { id: order.id },
            update: order,
            create: order
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${order.orderNumber}`);
        }
      }
    }
    
    // 9. CMS Pages
    if (backupData.cmsPages && backupData.cmsPages.length > 0) {
      console.log('\\n📝 Restoring CMS Pages...');
      for (const page of backupData.cmsPages) {
        try {
          await prisma.cMSPage.upsert({
            where: { id: page.id },
            update: page,
            create: page
          });
        } catch (e) {
          console.log(`  ⚠️  Skipped duplicate: ${page.slug}`);
        }
      }
    }
    
    console.log('\\n✅ Database restore completed successfully!');
    console.log('📊 All data has been restored from backup.');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

restoreBackup();
