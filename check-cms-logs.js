const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogs() {
  try {
    const logs = await prisma.cMSLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        page: { select: { slug: true } }
      }
    });

    console.log('Recent CMS Logs:');
    logs.forEach(log => {
      console.log(`Action: ${log.action}, Page: ${log.page?.slug || 'N/A'}, Time: ${log.createdAt}`);
      console.log('Details:', JSON.stringify(log.details).substring(0, 200) + '...');
      console.log('---');
    });

    const page = await prisma.cMSPage.findUnique({
      where: { slug: 'company' },
      select: { schema: true }
    });
    console.log('Company Page Schema (first 500 chars):');
    console.log(page.schema?.substring(0, 500) + '...');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLogs();
