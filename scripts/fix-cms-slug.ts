import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const slug = 'about-us';
    console.log(`Deleting page with slug: ${slug}`);
    
    // Check if it exists (including deleted)
    const page = await prisma.cMSPage.findUnique({ where: { slug } });
    
    if (page) {
        // Hard delete
        await prisma.cMSPage.delete({ where: { id: page.id } });
        console.log(`Successfully hard deleted page: ${page.title} (${page.id})`);
    } else {
        console.log(`Page with slug ${slug} not found.`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
