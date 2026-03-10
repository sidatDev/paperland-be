import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const pages = await prisma.cMSPage.findMany({
        where: {
            slug: {
                in: ['contact-us', 'outlets', 'company-contact']
            }
        }
    });
    console.log(JSON.stringify(pages, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
