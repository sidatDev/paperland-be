import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Seeding Dynamic Secondary Promotions Section ---');

  try {
    // 1. Find or create the HomepageSection
    let section = await prisma.homepageSection.findFirst({
      where: { type: 'SECONDARY_PROMO' }
    });

    if (!section) {
      console.log('Creating new Secondary Promo Section...');
      const lastSection = await prisma.homepageSection.findFirst({
        orderBy: { sortOrder: 'desc' }
      });
      const nextOrder = (lastSection?.sortOrder || 0) + 1;

      section = await prisma.homepageSection.create({
        data: {
          internalName: 'SECONDARY_PROMO',
          displayTitle: 'Promotions Collection',
          subtitle: 'Featured collections and deals',
          type: 'SECONDARY_PROMO',
          sortOrder: nextOrder,
          isActive: true,
        }
      });
      console.log(`Created section with ID: ${section.id}`);
    } else {
      console.log(`Found existing Secondary Promo Section with ID: ${section.id}`);
    }

    // 2. Check and seed items
    const itemsCount = await prisma.homepageSectionItem.count({
      where: { sectionId: section.id }
    });

    // Delete existing items to ensure fresh seed
    if (itemsCount > 0) {
      console.log('Clearing existing items for fresh seed...');
      await prisma.homepageSectionItem.deleteMany({
        where: { sectionId: section.id }
      });
    }

    console.log('Seeding items for the section...');
    
    // Card 1
    await prisma.homepageSectionItem.create({
      data: {
        sectionId: section.id,
        customTitle: 'Premium Brands',
        customSubtitle: 'Shop from top stationery brands',
        customImage: '/home/tech.jpg',
        customLink: '/en/collection/premium-brands',
        customDescription: JSON.stringify({
          buttonText: 'View Collection',
          bgGradientStart: '#E3F2FD',
          bgGradientEnd: '#BBDEFB',
          textColor: '#0A0A0A',
          mobileImage: '',
          pageTitle: 'Premium Brands',
          pageBannerImage: '/home/tech.jpg',
          categorySlug: 'markers-highlighters'
        }),
        sortOrder: 1,
        isActive: true
      }
    });

    // Card 2
    await prisma.homepageSectionItem.create({
      data: {
        sectionId: section.id,
        customTitle: 'Student Essentials',
        customSubtitle: 'Everything you need for success',
        customImage: '/home/backpack.jpg',
        customLink: '/en/collection/student-essentials',
        customDescription: JSON.stringify({
          buttonText: 'Shop Deals',
          bgGradientStart: '#FFFDE7',
          bgGradientEnd: '#FFF9C4',
          textColor: '#0A0A0A',
          mobileImage: '',
          pageTitle: 'Student Essentials',
          pageBannerImage: '/home/backpack.jpg',
          categorySlug: 'school-essentials'
        }),
        sortOrder: 2,
        isActive: true
      }
    });

    console.log('Successfully seeded 2 dynamic promo cards.');

    console.log('--- Seeding Complete ---');
  } catch (error: any) {
    console.error('Error during seeding:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
