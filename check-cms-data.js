const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCms() {
  try {
    const page = await prisma.cMSPage.findUnique({
      where: { slug: 'company' },
      select: {
        id: true,
        slug: true,
        title: true,
        isActive: true,
        updatedAt: true,
        contentJson: true
      }
    });

    if (page) {
      console.log('CMS Page Found:');
      console.log('ID:', page.id);
      console.log('Slug:', page.slug);
      console.log('Title:', page.title);
      console.log('Active:', page.isActive);
      console.log('Updated At:', page.updatedAt);
      console.log('Content JSON (Partial):', JSON.stringify(page.contentJson).substring(0, 500) + '...');
    } else {
      console.log('CMS Page with slug "company" NOT found!');
      
      const allPages = await prisma.cMSPage.findMany({
        select: { slug: true, title: true }
      });
      console.log('Available slugs:', allPages.map(p => p.slug));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCms();
