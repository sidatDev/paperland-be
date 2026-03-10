import { PrismaClient, Prisma } from '@prisma/client';
import { getTemplateBySlug } from '../data/cms-templates';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting Company Insights CMS Data Migration ---');

  const pageSlug = 'company';
  const template = getTemplateBySlug(pageSlug);

  if (!template) {
    console.error(`ERROR: Template not found for slug '${pageSlug}'`);
    process.exit(1);
  }

  try {
    const cmsPage = await prisma.cMSPage.findUnique({ where: { slug: pageSlug } });
    
    if (!cmsPage) {
        console.error(`ERROR: CMS Page with slug '${pageSlug}' not found in database.`);
        process.exit(1);
    }

    console.log(`Found existing '${pageSlug}' page. Updating schema and migrating content...`);

    const currentContent = cmsPage.contentJson as any;
    const newSchema = JSON.stringify(template.schema);
    
    // Migrate existing insights data if it exists
    if (currentContent && currentContent.insights && currentContent.insights.items) {
        console.log(`Migrating ${currentContent.insights.items.length} insight items...`);
        
        currentContent.insights.items = currentContent.insights.items.map((item: any) => {
            // Map old keys to new keys if they exist and new keys are missing
            const newItem = { ...item };
            
            if (newItem.title && !newItem.titleEn) {
                newItem.titleEn = newItem.title;
                delete newItem.title;
            }
            if (newItem.description && !newItem.descriptionEn) {
                newItem.descriptionEn = newItem.description;
                delete newItem.description;
            }
            if (newItem.date && !newItem.dateEn) {
                newItem.dateEn = newItem.date;
                delete newItem.date;
            }
            if (newItem.category && !newItem.categoryEn) {
                newItem.categoryEn = newItem.category;
                delete newItem.category;
            }

            // Ensure new fields exist
            if (!newItem.authorEn) newItem.authorEn = "Filters Expert Team";
            if (!newItem.authorAr) newItem.authorAr = "فريق خبراء الفلاتر";
            if (!newItem.readTimeEn) newItem.readTimeEn = "5 min read";
            if (!newItem.readTimeAr) newItem.readTimeAr = "٥ دقائق قراءة";
            if (!newItem.contentEn) newItem.contentEn = newItem.descriptionEn || "";
            if (!newItem.contentAr) newItem.contentAr = newItem.descriptionAr || "";
            
            return newItem;
        });
    } else {
        console.log("No existing insights data found in contentJson, using defaultContent.");
        // If insights section is missing or empty, we can choose to merge it from defaultContent
        // For safety, let's just ensure the insights object exists
        if (!currentContent.insights && template.defaultContent) {
            currentContent.insights = template.defaultContent.insights;
        }
    }

    // Update the database
    await prisma.cMSPage.update({
      where: { id: cmsPage.id },
      data: {
        schema: newSchema,
        contentJson: currentContent as Prisma.InputJsonValue,
        content: JSON.stringify(currentContent),
      }
    });

    console.log(`--- Migration Complete (UPDATED existing '${pageSlug}') ---`);

  } catch (e: any) {
    console.error("Migration Error:");
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
