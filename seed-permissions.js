const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// New fine-grained permission keys needed for sub-item sidebar filtering
const newPermissions = [
  { key: 'category_view', title: 'View Categories' },
  { key: 'category_manage', title: 'Manage Categories' },
  { key: 'brand_view', title: 'View Brands' },
  { key: 'brand_manage', title: 'Manage Brands' },
  { key: 'industry_view', title: 'View Industries' },
  { key: 'industry_manage', title: 'Manage Industries' },
  { key: 'inventory_view', title: 'View Inventory' },
  { key: 'inventory_manage', title: 'Manage Inventory' },
  { key: 'relation_view', title: 'View Product Relations' },
  { key: 'relation_manage', title: 'Manage Product Relations' },
  { key: 'system_manage', title: 'Manage System Settings' },
];

async function main() {
  console.log('Seeding new permissions...');
  for (const perm of newPermissions) {
    const existing = await prisma.permission.findUnique({ where: { key: perm.key } });
    if (existing) {
      console.log(`  SKIP (already exists): ${perm.key}`);
    } else {
      await prisma.permission.create({ data: perm });
      console.log(`  CREATED: ${perm.key}`);
    }
  }
  console.log('\nDone! All permissions seeded.');
  
  // Verify complete list
  const all = await prisma.permission.findMany({ orderBy: { key: 'asc' } });
  console.log(`\nTotal permissions in DB: ${all.length}`);
  console.log(all.map(p => p.key).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
