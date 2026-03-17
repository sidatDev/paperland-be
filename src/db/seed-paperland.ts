import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Seeding Paperland database...');

    // 1. Create Default Roles
    const roles = ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'B2B_ADMIN', 'BUSINESS', 'CUSTOMER'];
    
    console.log('Upserting roles...');
    for (const roleName of roles) {
      const r = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: `Default role for ${roleName}`
        }
      });
      console.log(`- Role ${r.name} done.`);
    }
    console.log('✅ Roles created.');

    const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!superAdminRole) throw new Error('Role SUPER_ADMIN not found');

    // 2. Paperland Super Admin
    const adminEmail = 'sidattech@paperland.com';
    const hashedPassword = await bcrypt.hash('sidatTech123', 10);
    
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: hashedPassword,
        roleId: superAdminRole.id,
        isActive: true
      },
      create: {
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: 'Paperland',
        lastName: 'Admin',
        roleId: superAdminRole.id,
        accountStatus: 'APPROVED',
        emailVerified: true
      } as any
    });
    console.log('✅ Paperland Super Admin created/updated.');

    // 3. Default Currency (PKR)
    const pkrCurrency = await prisma.currency.upsert({
      where: { code: 'PKR' },
      update: {},
      create: {
        code: 'PKR',
        name: 'Pakistani Rupee',
        symbol: 'Rs',
        decimalPlaces: 0,
        isActive: true
      }
    });
    console.log('✅ Default currency (PKR) created.');

    // 4. Default Country (Pakistan)
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
    console.log('✅ Country PK (Pakistan) created.');

    // 5. Stationery Categories
    const categories = [
      { name: 'Paper & Notebooks', slug: 'paper-notebooks' },
      { name: 'Writing Instruments', slug: 'writing-instruments' },
      { name: 'Office Supplies', slug: 'office-supplies' },
      { name: 'School Supplies', slug: 'school-supplies' },
      { name: 'Art & Craft', slug: 'art-craft' },
      { name: 'Computers & Accessories', slug: 'computers-accessories' }
    ];

    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat
      });
    }
    console.log('✅ Stationery categories created.');

    // 6. Stationery Brands
    const brands = [
      { name: 'Casio', logoUrl: null },
      { name: 'Dollar', logoUrl: null },
      { name: 'Dux', logoUrl: null },
      { name: 'Piano', slug: 'piano' },
      { name: 'Uni-ball', slug: 'uni-ball' }
    ];

    for (const brand of brands) {
      await prisma.brand.upsert({
        where: { name: brand.name },
        update: {},
        create: brand
      } as any);
    }
    console.log('✅ Stationery brands created.');

    // 7. Initialize Permissions
    const permissions = [
      { title: 'View Users', key: 'user_view' },
      { title: 'Create Users', key: 'user_create' },
      { title: 'Edit Users', key: 'user_edit' },
      { title: 'Delete Users', key: 'user_delete' },
      { title: 'View Roles', key: 'role_view' },
      { title: 'Create Roles', key: 'role_create' },
      { title: 'Edit Roles', key: 'role_edit' },
      { title: 'Delete Roles', key: 'role_delete' },
      { title: 'View Products', key: 'product_view' },
      { title: 'Create Products', key: 'product_create' },
      { title: 'Edit Products', key: 'product_edit' },
      { title: 'Delete Products', key: 'product_delete' },
      { title: 'View Orders', key: 'order_view' },
      { title: 'Manage Orders', key: 'order_manage' },
      { title: 'View CMS Pages', key: 'cms_view' },
      { title: 'Manage CMS Content', key: 'cms_manage' }
    ];

    for (const p of permissions) {
      const permission = await prisma.permission.upsert({
        where: { key: p.key },
        update: { title: p.title },
        create: { title: p.title, key: p.key }
      });

      // Assign to Super Admin Role
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: permission.id }
      });
    }
    console.log('✅ Permissions assigned to SUPER_ADMIN.');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
