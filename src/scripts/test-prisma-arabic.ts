import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const pageSlug = 'test-slug';
    await prisma.cMSPage.upsert({
      where: { slug: pageSlug },
      update: {},
      create: {
        slug: pageSlug,
        title: 'Test Page',
        contentJson: { textAr: "الأحد - الخميس: 8:00 صباحاً - 6:00 مساءً" } as any,
        isActive: true
      }
    });
    console.log('Success');
  } catch (e: any) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
