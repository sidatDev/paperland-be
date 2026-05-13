const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const permissions = [
    { key: 'kb_view', title: 'View Knowledge Base' },
    { key: 'kb_manage', title: 'Manage Knowledge Base' }
  ];

  console.log('Seeding KB permissions...');

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: p,
      create: p
    });
    console.log(`- Permission ${p.key} ensured.`);
  }

  // Assign to Super Admin role if it exists
  const superAdmin = await prisma.role.findFirst({
    where: { 
      OR: [
        { name: 'Super Admin' },
        { name: 'super_admin' },
        { name: 'Admin' }
      ]
    }
  });

  if (superAdmin) {
    console.log(`Found admin role: ${superAdmin.name}`);
    for (const p of permissions) {
      const perm = await prisma.permission.findUnique({
        where: { key: p.key }
      });

      if (perm) {
        const existing = await prisma.rolePermission.findFirst({
          where: {
            roleId: superAdmin.id,
            permissionId: perm.id
          }
        });

        if (!existing) {
          await prisma.rolePermission.create({
            data: {
              roleId: superAdmin.id,
              permissionId: perm.id
            }
          });
          console.log(`- Assigned ${p.key} to ${superAdmin.name}.`);
        }
      }
    }
  }

  console.log('KB permissions seeding completed.');
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
