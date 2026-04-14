import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🚀 Starting B2B Company Link Migration...');

    // 1. Fetch all users who are approved/pending B2B but miss companyId
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { accountStatus: 'APPROVED' },
                { b2bCompanyDetails: { isNot: null } }
            ],
            companyId: null,
            deletedAt: null
        },
        include: {
            b2bCompanyDetails: true,
            b2bProfile: true
        }
    });

    console.log(`Found ${users.length} users needing company linking.`);

    for (const user of users) {
        try {
            const companyName = user.b2bCompanyDetails?.companyName || user.companyName || 'B2B Client';
            
            // Find or create company
            let company = await prisma.company.findFirst({
                where: { name: companyName, deletedAt: null }
            });

            if (!company) {
                console.log(`Creating company: ${companyName}`);
                const details = user.b2bCompanyDetails;
                if (details) {
                    company = await prisma.company.create({
                        data: {
                            name: details.companyName,
                            registrationCountry: details.registrationCountry,
                            taxId: details.taxId,
                            registrationDate: details.registrationDate,
                            companyAddress: details.companyAddress,
                            registrationProofUrls: details.registrationProofUrls,
                            doingBusinessAs: details.doingBusinessAs,
                            primaryContactName: details.primaryContactName,
                            jobTitle: details.jobTitle,
                            contactPhone: details.contactPhone,
                            contactCountryCode: details.contactCountryCode,
                            billingEmail: details.billingEmail,
                            shippingAddress: details.shippingAddress,
                            apContactName: details.apContactName,
                            apPhone: details.apPhone,
                            apCountryCode: details.apCountryCode,
                            authorizedRepresentativeEmail: details.authorizedRepresentativeEmail,
                            authorizedRepresentativeName: details.authorizedRepresentativeName,
                            registeredLegalEntity: details.registeredLegalEntity
                        }
                    });
                } else {
                    company = await prisma.company.create({
                        data: { name: companyName }
                    });
                }
            }

            // Link user
            await prisma.user.update({
                where: { id: user.id },
                data: { companyId: company.id }
            });

            // Link B2B Profile
            if (user.b2bProfileId) {
                await (prisma as any).b2BProfile.update({
                    where: { id: user.b2bProfileId },
                    data: { companyId: company.id }
                });
            }

            console.log(`✅ Linked user ${user.email} to company ${companyName}`);
        } catch (err) {
            console.error(`❌ Failed to link user ${user.email}:`, err);
        }
    }

    console.log('✨ Migration completed.');
}

migrate()
    .catch(err => {
        console.error('Fatal Migration Error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
