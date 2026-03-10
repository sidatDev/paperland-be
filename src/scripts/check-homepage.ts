
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Homepage Sections...');
    const sections = await prisma.homepageSection.findMany({
        where: { isActive: true },
        include: { items: true }
    });

    console.log(`Found ${sections.length} active sections.`);
    const hasCategories = sections.some(s => s.type === 'categories');
    console.log(`Has 'categories' section: ${hasCategories}`);

    if (!hasCategories) {
        console.log('Checking for fallback products...');
        const productNames = [
            'PSG - Roof and ceiling mounted ESP mist collector',
            'Fleetguard filter',
            'Neville Hoffman',
            'Jamal Nieves'
        ];

        const products = await prisma.product.findMany({
            where: {
                name: { in: productNames },
                isActive: true,
                deletedAt: null
            },
            select: { name: true, id: true }
        });

        console.log(`Found ${products.length} fallback products:`);
        products.forEach(p => console.log(`- ${p.name}`));
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
