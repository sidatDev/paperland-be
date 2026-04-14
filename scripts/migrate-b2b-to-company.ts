
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting data migration: B2B to Companies...');

  // 1. Fetch all B2B Profile details with User and B2BProfile info
  const b2bDetails = await prisma.b2BCompanyDetails.findMany({
      include: {
          user: {
              include: {
                  b2bProfile: true
              }
          }
      }
  });
  console.log(`Found ${b2bDetails.length} B2B company detail records.`);

  // 2. Group by company name (Case-insensitive)
  const companyGroups = new Map<string, any[]>();
  for (const detail of b2bDetails) {
    const key = detail.companyName.trim().toLowerCase();
    if (!companyGroups.has(key)) {
      companyGroups.set(key, []);
    }
    companyGroups.get(key)!.push(detail);
  }

  console.log(`Unique companies identified: ${companyGroups.size}`);

  for (const [name, records] of companyGroups.entries()) {
    const lead = records[0];
    console.log(`Migrating company: ${lead.companyName} (${records.length} user associations)`);

    // 3. Create Company
    const company = await prisma.company.create({
      data: {
        name: lead.companyName,
        registrationCountry: lead.registrationCountry,
        taxId: lead.taxId,
        registrationDate: lead.registrationDate,
        companyAddress: lead.companyAddress,
        registrationProofUrls: lead.registrationProofUrls ?? [],
        doingBusinessAs: lead.doingBusinessAs,
        primaryContactName: lead.primaryContactName,
        jobTitle: lead.jobTitle,
        contactPhone: lead.contactPhone,
        contactCountryCode: lead.contactCountryCode,
        billingEmail: lead.billingEmail,
        shippingAddress: lead.shippingAddress,
        apContactName: lead.apContactName,
        apPhone: lead.apPhone,
        apCountryCode: lead.apCountryCode,
        authorizedRepresentativeEmail: lead.authorizedRepresentativeEmail,
        authorizedRepresentativeName: lead.authorizedRepresentativeName,
        registeredLegalEntity: lead.registeredLegalEntity,
      }
    });

    // 4. Update Users and B2BProfiles
    const userIds = records.map(r => r.userId);
    const b2bProfileIds = records.map(r => r.user?.b2bProfileId).filter(Boolean) as string[];

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { companyId: company.id }
    });

    if (b2bProfileIds.length > 0) {
        await prisma.b2BProfile.updateMany({
            where: { id: { in: b2bProfileIds } },
            data: { companyId: company.id }
        });
    }

    console.log(`  - Assigned companyId ${company.id} to ${userIds.length} users and ${b2bProfileIds.length} profiles.`);
  }

  console.log('Data migration completed successfully.');
}

migrate()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
