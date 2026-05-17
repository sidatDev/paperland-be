import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 1);

  // Clear existing hero campaigns to avoid clutter if needed, or just add new ones
  // For safety, we just add new ones with high priority

  // 1. Premium Tools
  await prisma.promotion.create({
    data: {
      name: 'Premium Tools for Everyday Tasks',
      displayTitle: 'Premium Tools',
      displaySubtitle: 'Master Your Craft with Professional Tools. Now 20% Off.',
      discountType: 'PERCENTAGE',
      startDate: now,
      endDate: nextMonth,
      isActive: true,
      priority: 10,
      showOnBanner: true,
      bannerImageDesktop: 'http://localhost:3001/uploads/campaigns/premium-tools.png',
      ctaText: 'Shop Collection',
      ctaLink: '/en/products',
      displayLocations: ['HERO', 'CAROUSEL'],
      campaignType: 'GENERAL',
      slug: 'premium-tools',
      tiers: {
        create: {
          minQuantity: 0,
          discountValue: 20,
          label: 'Standard Discount'
        }
      }
    }
  });

  // 2. Office Essentials
  await prisma.promotion.create({
    data: {
      name: 'Office Essentials 2024',
      displayTitle: 'Office Essentials',
      displaySubtitle: 'Everything You Need for a Productive Workspace. Up to 40% Off.',
      discountType: 'PERCENTAGE',
      startDate: now,
      endDate: nextMonth,
      isActive: true,
      priority: 5,
      showOnBanner: true,
      bannerImageDesktop: 'http://localhost:3001/uploads/campaigns/office-essentials.png',
      ctaText: 'View Essentials',
      ctaLink: '/en/products',
      displayLocations: ['HERO', 'CAROUSEL'],
      campaignType: 'GENERAL',
      slug: 'office-essentials',
      tiers: {
        create: {
          minQuantity: 0,
          discountValue: 40,
          label: 'Special Discount'
        }
      }
    }
  });

  // 3. New Arrivals
  await prisma.promotion.create({
    data: {
      name: 'Latest Arrivals',
      displayTitle: 'New Arrivals',
      displaySubtitle: 'Be the First to Own the Latest Stationery Trends.',
      discountType: 'PERCENTAGE',
      startDate: now,
      endDate: nextMonth,
      isActive: true,
      priority: 2,
      showOnBanner: true,
      bannerImageDesktop: 'http://localhost:3001/uploads/campaigns/new-arrivals.png',
      ctaText: 'Discover More',
      ctaLink: '/en/products?sort=newest',
      displayLocations: ['HERO'],
      campaignType: 'GENERAL',
      slug: 'new-arrivals',
      tiers: {
        create: {
          minQuantity: 0,
          discountValue: 0,
          label: 'New Collection'
        }
      }
    }
  });

  console.log('Campaigns created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
