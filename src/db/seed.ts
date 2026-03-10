import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Seeding database...');

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
    const adminEmail = 'admin@filtersexpert.com';
    const adminExists = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!adminExists) {
      console.log('Creating Super Admin...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword,
          firstName: 'System',
          lastName: 'Admin',
          roleId: superAdminRole.id,
          licenseNumber: 'SYS-ADMIN-001'
        } as any
      });
      console.log('Super Admin created.');
    } else {
      console.log('Super Admin already exists.');
    }

    // 3. Mock Regional Admin
    const regEmail = 'regional@filtersexpert.com';
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
          licenseNumber: 'REG-ADMIN-001'
        } as any
      });
      console.log('Regional Admin created.');
    }

    // ... (Categories/Brands/Currency/Permissions omitted)



    // 4. Create Default Categories
    const categories = [
      { name: 'Air Filter', slug: 'air-filter' },
      { name: 'Oil Filter', slug: 'oil-filter' },
      { name: 'Fuel Filter', slug: 'fuel-filter' },
      { name: 'Hydraulic Filter', slug: 'hydraulic-filter' },
      { name: 'Cabin Air Filter', slug: 'cabin-air-filter' }
    ];

    for (const cat of categories) {
      await prisma.category.upsert({
        where: { name: cat.name },
        update: {},
        create: cat
      });
    }
    console.log('Categories created.');

    // 5. Create Default Brands
    const brands = [
      { name: 'Donaldson', logoUrl: null },
      { name: 'Parker', logoUrl: null },
      { name: 'Fleetguard', logoUrl: null },
      { name: 'Baldwin', logoUrl: null },
      { name: 'Mann Filter', logoUrl: null },
      { name: 'Bosch', logoUrl: null }
    ];

    for (const brand of brands) {
      await prisma.brand.upsert({
        where: { name: brand.name },
        update: {},
        create: brand
      });
    }
    console.log('Brands created.');

    // 5. Create Default Currency (SAR)
    const sarCurrency = await prisma.currency.upsert({
      where: { code: 'SAR' },
      update: {},
      create: {
        code: 'SAR',
        name: 'Saudi Riyal',
        symbol: '﷼',
        decimalPlaces: 2,
        isActive: true
      }
    });
    console.log('Default currency created.');

    // 6. Create Default Countries
    await prisma.country.upsert({
        where: { code: 'KSA' },
        update: {},
        create: {
            code: 'KSA',
            name: 'Saudi Arabia',
            currencyId: sarCurrency.id,
            taxRate: 15
        }
    });
    console.log('Country KSA created.');

    // 7. Seed Permissions
    const permissions = [
      // User Management
      { title: 'View Users', key: 'user_view' },
      { title: 'Create Users', key: 'user_create' },
      { title: 'Edit Users', key: 'user_edit' },
      { title: 'Delete Users', key: 'user_delete' },
      
      // Role Management
      { title: 'View Roles', key: 'role_view' },
      { title: 'Create Roles', key: 'role_create' },
      { title: 'Edit Roles', key: 'role_edit' },
      { title: 'Delete Roles', key: 'role_delete' },
      
      // Logs
      { title: 'View Logs', key: 'log_view' },
      { title: 'Export Logs', key: 'log_export' },

      // System / Backup
      { title: 'Manage System Backup', key: 'system_backup' },
      { title: 'Manage Global Settings', key: 'system_settings' },

      // Product Management
      { title: 'View Products', key: 'product_view' },
      { title: 'Create Products', key: 'product_create' },
      { title: 'Edit Products', key: 'product_edit' },
      { title: 'Delete Products', key: 'product_delete' },

      // Order Management
      { title: 'View Orders', key: 'order_view' },
      { title: 'Manage Orders', key: 'order_manage' },

      // Customer/B2B Management
      { title: 'View B2B Profiles', key: 'b2b_view' },
      { title: 'Manage B2B Profiles', key: 'b2b_manage' },

      // Regional Management
      { title: 'View Regions', key: 'region_view' },
      { title: 'Manage Regions', key: 'region_manage' },

      // CMS Management
      { title: 'View CMS Pages', key: 'cms_view' },
      { title: 'Manage CMS Content', key: 'cms_manage' },

      // Blog Management
      { title: 'View Blog Posts', key: 'blog_view' },
      { title: 'Manage Blog Posts', key: 'blog_manage' },

      // Analytics
      { title: 'View Reports', key: 'analytics_view' },
      { title: 'Export Analytics', key: 'analytics_export' },

      // SEO Management
      { title: 'View SEO Settings', key: 'seo_view' },
      { title: 'Manage SEO Settings', key: 'seo_manage' },

      // Homepage Management
      { title: 'View Homepage Design', key: 'homepage_view' },
      { title: 'Manage Homepage Design', key: 'homepage_manage' },

      // Customer Management
      { title: 'View Customer Data', key: 'customer_view' },
      { title: 'Manage Customers', key: 'customer_manage' },
    ];

    console.log('Seeding permissions...');
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

    // 8. Create Sample Customer
    const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if(customerRole) {
        await prisma.user.upsert({
            where: { email: 'customer@example.com' },
            update: {},
            create: {
                email: 'customer@example.com',
                passwordHash: await bcrypt.hash('customer123', 10),
                firstName: 'Ali',
                lastName: 'Khan',
                companyName: 'Global Logistics SA',
                phoneNumber: '+966500000000',
                roleId: customerRole.id,
                licenseNumber: 'CUST-001'
            } as any
        });
        console.log('Sample Customer created.');
    }

    // 9. Create Sample Products
    const airFilter = await prisma.category.findFirst({ where: { slug: 'air-filter' } });
    const donaldson = await prisma.brand.findFirst({ where: { name: 'Donaldson' } });
    // Use the sarCurrency defined earlier or find it again if needed in a different scope
    // const sarCurrency = await prisma.currency.findUnique({ where: { code: 'SAR' } });

    // Create a default warehouse
    const defaultWarehouse = await prisma.warehouse.upsert({
      where: { code: 'MAIN-01' },
      update: {},
      create: {
        code: 'MAIN-01',
        name: 'Main Warehouse',
        city: 'Default City',
        country: 'SA',
        isDefault: true
      }
    });

    if (airFilter && donaldson && sarCurrency) {
        
        // Product 1
        const p1 = await prisma.product.upsert({
            where: { sku: 'P181050' },
            update: {},
            create: {
                name: 'Donaldson Air Filter P181050',
                sku: 'P181050',
                description: 'High efficiency air filter for heavy duty trucks.',
                categoryId: airFilter.id,
                brandId: donaldson.id,
                isActive: true,
                isFeatured: true
            } as any
        });

        // Price for P1
        const price1 = await prisma.price.findFirst({ where: { productId: p1.id, currencyId: sarCurrency.id }});
        if (!price1) {
            await prisma.price.create({
                data: {
                    productId: p1.id,
                    currencyId: sarCurrency.id,
                    priceRetail: 150.00,
                    priceWholesale: 120.00,
                    isActive: true
                } as any
            });
        }

        // Stock for P1
        await prisma.stock.upsert({
            where: { productId_warehouseId: { productId: p1.id, warehouseId: defaultWarehouse.id } },
            update: { qty: 100 },
            create: {
                productId: p1.id,
                warehouseId: defaultWarehouse.id,
                qty: 100
            } as any
        });

        // Product 2
        const p2 = await prisma.product.upsert({
             where: { sku: 'P182000' },
             update: {},
             create: {
                 name: 'Donaldson Lube Filter',
                 sku: 'P182000',
                 description: 'Premium lube filter.',
                 categoryId: airFilter.id,
                 brandId: donaldson.id,
                 isActive: true,
                 isFeatured: false
             } as any
        });

        // Price for P2
        const price2 = await prisma.price.findFirst({ where: { productId: p2.id, currencyId: sarCurrency.id }});
        if (!price2) {
            await prisma.price.create({
                data: {
                    productId: p2.id,
                    currencyId: sarCurrency.id,
                    priceRetail: 75.50,
                    priceWholesale: 60.00,
                    isActive: true
                } as any
            });
        }

        // Stock for P2
        await prisma.stock.upsert({
            where: { productId_warehouseId: { productId: p2.id, warehouseId: defaultWarehouse.id } },
            update: { qty: 250 },
            create: {
                productId: p2.id,
                warehouseId: defaultWarehouse.id,
                qty: 250
            } as any
        });

        console.log('Sample Products (with Prices and Stock) created.');
    }

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
