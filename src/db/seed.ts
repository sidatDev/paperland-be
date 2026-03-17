import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Seeding database for Paperland (Pakistan)...');

    // 1. Create Default Roles
    const roles = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'B2B_ADMIN', 'BUSINESS', 'CUSTOMER'];
    
    for (const roleName of roles) {
      await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: `Default role for ${roleName}`
        }
      });
    }
    console.log('Roles created.');

    const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    const regionalAdminRole = await prisma.role.findUnique({ where: { name: 'REGIONAL_ADMIN' } });

    if (!superAdminRole || !regionalAdminRole) {
      throw new Error('Failed to retrieve created roles');
    }

    // 2. Super Admin
    const adminEmail = 'admin@paperland.com.pk';
    const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!adminExists) {
      console.log('Creating Super Admin...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword,
          firstName: 'Paperland',
          lastName: 'Admin',
          roleId: superAdminRole.id,
          licenseNumber: 'PL-ADMIN-001'
        } as any
      });
      console.log('Super Admin created.');
    } else {
      console.log('Super Admin already exists.');
    }

    // 3. Mock Regional Admin
    const regEmail = 'regional@paperland.com.pk';
    const regExists = await prisma.user.findUnique({ where: { email: regEmail } });

    if (!regExists) {
      console.log('Creating Regional Admin...');
      const hashedPassword = await bcrypt.hash('regional123', 10);
       await prisma.user.create({
        data: {
          email: regEmail,
          passwordHash: hashedPassword,
          firstName: 'Regional',
          lastName: 'Manager',
          roleId: regionalAdminRole.id,
          licenseNumber: 'PL-REG-001'
        } as any
      });
      console.log('Regional Admin created.');
    }

    // 4. Create Default Categories (Stationery & Office Supplies)
    const categories = [
      { name: 'Paper & Notebooks', slug: 'paper-notebooks' },
      { name: 'Writing Instruments', slug: 'writing-instruments' },
      { name: 'Office Equipment', slug: 'office-equipment' },
      { name: 'Desk Accessories', slug: 'desk-accessories' },
      { name: 'School Supplies', slug: 'school-supplies' },
      { name: 'Art & Craft', slug: 'art-craft' }
    ];

    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat
      });
    }
    console.log('Categories created.');

    // 5. Create Default Brands
    const brands = [
      { name: 'Pelikan', logoUrl: null },
      { name: 'Deli', logoUrl: null },
      { name: 'Faber-Castell', logoUrl: null },
      { name: 'Uni-ball', logoUrl: null },
      { name: 'Dollar', logoUrl: null },
      { name: 'Piano', logoUrl: null }
    ];

    for (const brand of brands) {
      await prisma.brand.upsert({
        where: { name: brand.name },
        update: {},
        create: brand
      });
    }
    console.log('Brands created.');

    // 6. Create Default Currency (PKR)
    const pkrCurrency = await prisma.currency.upsert({
      where: { code: 'PKR' },
      update: {},
      create: {
        code: 'PKR',
        name: 'Pakistani Rupee',
        symbol: 'Rs.',
        decimalPlaces: 2,
        isActive: true
      }
    });
    console.log('Default currency PKR created.');

    // 7. Create Default Countries (Pakistan)
    await prisma.country.upsert({
        where: { code: 'PK' },
        update: {},
        create: {
            code: 'PK',
            name: 'Pakistan',
            currencyId: pkrCurrency.id,
            taxRate: 18
        }
    });
    console.log('Country Pakistan (PK) created with 18% VAT.');

    // 8. Seed Permissions
    const permissions = [
      { title: 'View Users', key: 'user_view' },
      { title: 'Create Users', key: 'user_create' },
      { title: 'Edit Users', key: 'user_edit' },
      { title: 'Delete Users', key: 'user_delete' },
      { title: 'View Roles', key: 'role_view' },
      { title: 'Create Roles', key: 'role_create' },
      { title: 'Edit Roles', key: 'role_edit' },
      { title: 'Delete Roles', key: 'role_delete' },
      { title: 'View Logs', key: 'log_view' },
      { title: 'Export Logs', key: 'log_export' },
      { title: 'Manage System Backup', key: 'system_backup' },
      { title: 'Manage Global Settings', key: 'system_settings' },
      { title: 'View Products', key: 'product_view' },
      { title: 'Create Products', key: 'product_create' },
      { title: 'Edit Products', key: 'product_edit' },
      { title: 'Delete Products', key: 'product_delete' },
      { title: 'View Orders', key: 'order_view' },
      { title: 'Manage Orders', key: 'order_manage' },
      { title: 'View B2B Profiles', key: 'b2b_view' },
      { title: 'Manage B2B Profiles', key: 'b2b_manage' },
      { title: 'View Regions', key: 'region_view' },
      { title: 'Manage Regions', key: 'region_manage' },
      { title: 'View CMS Pages', key: 'cms_view' },
      { title: 'Manage CMS Content', key: 'cms_manage' },
      { title: 'View Blog Posts', key: 'blog_view' },
      { title: 'Manage Blog Posts', key: 'blog_manage' },
      { title: 'View Reports', key: 'analytics_view' },
      { title: 'Export Analytics', key: 'analytics_export' },
      { title: 'View SEO Settings', key: 'seo_view' },
      { title: 'Manage SEO Settings', key: 'seo_manage' },
      { title: 'View Homepage Design', key: 'homepage_view' },
      { title: 'Manage Homepage Design', key: 'homepage_manage' },
      { title: 'View Customer Data', key: 'customer_view' },
      { title: 'Manage Customers', key: 'customer_manage' },
    ];

    for (const p of permissions) {
      await prisma.permission.upsert({
        where: { key: p.key },
        update: { title: p.title },
        create: {
            title: p.title,
            key: p.key
        }
      });
    }
    console.log('Permissions seeded.');

    // 9. Create Sample Customer
    const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if(customerRole) {
        await prisma.user.upsert({
            where: { email: 'customer@example.pk' },
            update: {},
            create: {
                email: 'customer@example.pk',
                passwordHash: await bcrypt.hash('customer123', 10),
                firstName: 'Ali',
                lastName: 'Zafar',
                companyName: 'Paperland Logistics',
                phoneNumber: '+923001234567',
                roleId: customerRole.id,
                licenseNumber: 'PL-CUST-001'
            } as any
        });
        console.log('Sample Customer created.');
    }

    // 10. Create Sample Products
    const paperCat = await prisma.category.findFirst({ where: { slug: 'paper-notebooks' } });
    const dollarBrand = await prisma.brand.findFirst({ where: { name: 'Dollar' } });

    // Create a default warehouse in Pakistan
    const defaultWarehouse = await prisma.warehouse.upsert({
      where: { code: 'PK-KRI-01' },
      update: {},
      create: {
        code: 'PK-KRI-01',
        name: 'Karachi Central Warehouse',
        city: 'Karachi',
        country: 'PK',
        isDefault: true
      }
    });

    if (paperCat && dollarBrand && pkrCurrency) {
        // Product 1
        const p1 = await prisma.product.upsert({
            where: { sku: 'PL-PAPER-A4-80' },
            update: {},
            create: {
                name: 'Dollar Premium A4 Paper 80gsm',
                sku: 'PL-PAPER-A4-80',
                description: 'High quality A4 printer paper, 500 sheets.',
                categoryId: paperCat.id,
                brandId: dollarBrand.id,
                isActive: true,
                isFeatured: true,
                price: 1200.00
            } as any
        });

        // Price for P1
        const existingPrice = await (prisma.price as any).findFirst({
            where: { productId: p1.id, currencyId: pkrCurrency.id }
        });

        if (existingPrice) {
            await (prisma.price as any).update({
                where: { id: existingPrice.id },
                data: { priceRetail: 1200.00, priceWholesale: 1000.00 }
            });
        } else {
            await (prisma.price as any).create({
                data: {
                    productId: p1.id,
                    currencyId: pkrCurrency.id,
                    priceRetail: 1200.00,
                    priceWholesale: 1000.00,
                    isActive: true
                }
            });
        }

        // Stock for P1
        await prisma.stock.upsert({
            where: { productId_warehouseId: { productId: p1.id, warehouseId: defaultWarehouse.id } },
            update: { qty: 500 },
            create: {
                productId: p1.id,
                warehouseId: defaultWarehouse.id,
                qty: 500
            } as any
        });

        console.log('Sample Paperland Products created.');
    }

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
