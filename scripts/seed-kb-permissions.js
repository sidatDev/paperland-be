/**
 * Seed Knowledge Base permissions into the permissions table.
 * Usage: node scripts/seed-kb-permissions.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KB_PERMISSIONS = [
  { title: 'Knowledge Base - View', key: 'kb_view' },
  { title: 'Knowledge Base - Manage', key: 'kb_manage' },
];

async function seed() {
  console.log('🔑 Seeding Knowledge Base permissions...');

  for (const perm of KB_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { key: perm.key },
    });

    if (existing) {
      console.log(`  ✅ Already exists: ${perm.key}`);
    } else {
      await prisma.permission.create({ data: perm });
      console.log(`  ✅ Created: ${perm.key}`);
    }
  }

  console.log('✅ Knowledge Base permissions seeded successfully.');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
