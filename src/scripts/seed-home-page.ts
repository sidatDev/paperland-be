import { PrismaClient } from '@prisma/client';
import { getTemplateBySlug } from '../data/cms-templates';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Seeding Home Page CMS Data ---');

  const pageSlug = 'home';
  const template = getTemplateBySlug(pageSlug);

  if (!template) {
    console.error(`ERROR: Template not found for slug '${pageSlug}'`);
    process.exit(1);
  }

  try {
    const existing = await prisma.cMSPage.findUnique({
      where: { slug: pageSlug }
    });

    if (existing) {
      console.log(`Found existing '${pageSlug}' page. Updating schema and default content...`);
      await prisma.cMSPage.update({
        where: { id: existing.id },
        data: {
          schema: JSON.stringify(template.schema),
          title: template.title,
          // Only update content if it's currently empty or user wants a reset
          // For now, let's update it to ensure our new fields exist
          content: JSON.stringify(template.defaultContent),
          contentJson: template.defaultContent as any,
        }
      });
      console.log(`Updated '${pageSlug}' successfully.`);
    } else {
      console.log(`Creating new '${pageSlug}' page...`);
      await prisma.cMSPage.create({
        data: {
          slug: pageSlug,
          title: template.title,
          schema: JSON.stringify(template.schema),
          content: JSON.stringify(template.defaultContent),
          contentJson: template.defaultContent as any,
          isActive: true
        }
      });
      console.log(`Created '${pageSlug}' successfully.`);
    }

    console.log('--- Seeding Complete ---');

  } catch (e: any) {
    console.error("Seeding Error:");
    console.error(e.message);
    process.exit(1);
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
