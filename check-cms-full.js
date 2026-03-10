const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCms() {
  try {
    const page = await prisma.cMSPage.findUnique({
      where: { slug: 'company' },
      select: {
        contentJson: true
      }
    });

    if (page) {
      console.log(JSON.stringify(page.contentJson, null, 2));
    } else {
      console.log('Page not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCms();
