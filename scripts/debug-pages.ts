import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listPages() {
    try {
        const careerPage = await (prisma as any).cMSPage.findUnique({
            where: { slug: 'career' }
        });
        console.log("\nCareer Page Openings:");
        console.log(JSON.stringify(careerPage?.contentJson?.openings, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

listPages();
