
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- B2B Catalog Assignment Script ---');

  // 1. Get first active catalog
  const catalog = await prisma.catalog.findFirst({
    where: { isActive: true, deletedAt: null }
  });

  if (!catalog) {
    console.error('Error: No active catalog found. Please create one in Admin Portal first.');
    return;
  }

  // 2. Get first company (B2B Customer)
  const company = await prisma.company.findFirst();

  if (!company) {
    console.error('Error: No B2B Company found in database.');
    return;
  }

  console.log(`Mapping Catalog "${catalog.name}" (${catalog.id}) to Company "${company.companyName}" (${company.id})...`);

  // 3. Create mapping
  await prisma.companyCatalog.upsert({
    where: {
      companyId_catalogId: {
        companyId: company.id,
        catalogId: catalog.id
      }
    },
    create: {
      companyId: company.id,
      catalogId: catalog.id,
      priority: 10
    },
    update: {
      priority: 10
    }
  });

  console.log('✅ Success! Catalog assigned to company.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
