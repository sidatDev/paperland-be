/**
 * Seed script: Create PaperLand category hierarchy and brands
 * This script uses upsert to avoid duplicates and preserve existing data.
 * 
 * Run: npx ts-node prisma/seed-categories-brands.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Category Hierarchy Definition ───────────────────────────────────────────
// Each main category has sub-categories. position controls ordering.
const CATEGORY_HIERARCHY = [
  {
    name: 'Writing Instruments',
    slug: 'writing-instruments',
    description: 'Premium pens, pencils, and writing tools from top global brands',
    position: 1,
    subCategories: [
      { name: 'Fountain Pens', slug: 'fountain-pens', position: 1 },
      { name: 'Ballpoint Pens', slug: 'ballpoint-pens', position: 2 },
      { name: 'Rollerball Pens', slug: 'rollerball-pens', position: 3 },
      { name: 'Gel Pens', slug: 'gel-pens', position: 4 },
      { name: 'Mechanical Pencils', slug: 'mechanical-pencils', position: 5 },
      { name: 'Calligraphy Pens', slug: 'calligraphy-pens', position: 6 },
      { name: 'Multi-Function Pens', slug: 'multi-function-pens', position: 7 },
    ],
  },
  {
    name: 'Markers & Highlighters',
    slug: 'markers-highlighters',
    description: 'Professional markers, highlighters, and board markers',
    position: 2,
    subCategories: [
      { name: 'Markers', slug: 'markers', position: 1 },
      { name: 'Highlighters', slug: 'highlighters', position: 2 },
      { name: 'Board Markers', slug: 'board-markers', position: 3 },
      { name: 'Permanent Markers', slug: 'permanent-markers', position: 4 },
    ],
  },
  {
    name: 'Inks & Refills',
    slug: 'inks-refills',
    description: 'Ink bottles, cartridges, refills, and converters for all pen types',
    position: 3,
    subCategories: [
      { name: 'Fountain Pen Inks', slug: 'fountain-pen-inks', position: 1 },
      { name: 'Ink Cartridges', slug: 'ink-cartridges', position: 2 },
      { name: 'Ballpoint Refills', slug: 'ballpoint-refills', position: 3 },
      { name: 'Rollerball Refills', slug: 'rollerball-refills', position: 4 },
      { name: 'Gel Refills', slug: 'gel-refills', position: 5 },
      { name: 'Converters', slug: 'converters', position: 6 },
    ],
  },
  {
    name: 'Art Supplies',
    slug: 'art-supplies',
    description: 'Art materials, canvas, colors, and creative supplies',
    position: 4,
    subCategories: [],
  },
  {
    name: 'Stationery & Office',
    slug: 'stationery-office',
    description: 'General stationery, office supplies and everyday essentials',
    position: 5,
    subCategories: [],
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Premium cufflinks, card holders, wallets, keyrings, and lifestyle accessories',
    position: 6,
    subCategories: [
      { name: 'Cufflinks', slug: 'cufflinks', position: 1 },
      { name: 'Card Holders', slug: 'card-holders', position: 2 },
      { name: 'Wallets', slug: 'wallets', position: 3 },
      { name: 'Key Rings', slug: 'key-rings', position: 4 },
      { name: 'Eyewear', slug: 'eyewear', position: 5 },
      { name: 'Pen Cases', slug: 'pen-cases', position: 6 },
      { name: 'Bags & Travel', slug: 'bags-travel', position: 7 },
      { name: 'Belts', slug: 'belts', position: 8 },
    ],
  },
];

// ─── Brand Definitions ───────────────────────────────────────────────────────
const BRANDS = [
  // Premium Pen Brands (Penworld)
  { name: 'Cross', slug: 'cross' },
  { name: 'Sheaffer', slug: 'sheaffer' },
  { name: 'Parker', slug: 'parker' },
  { name: 'Montegrappa', slug: 'montegrappa' },
  { name: 'Kaweco', slug: 'kaweco' },
  { name: 'Hugo Boss', slug: 'hugo-boss' },
  { name: 'Lamy', slug: 'lamy' },
  { name: "Caran d'Ache", slug: 'caran-dache' },
  // Everyday Stationery Brands (Estationery)
  { name: 'Pilot', slug: 'pilot' },
  { name: 'Schneider', slug: 'schneider' },
  { name: 'Pelikan', slug: 'pelikan' },
  { name: 'Sharpie', slug: 'sharpie' },
  { name: 'Uniball', slug: 'uniball' },
  { name: 'Stabilo', slug: 'stabilo' },
  { name: 'Dux', slug: 'dux' },
  { name: 'Milan', slug: 'milan' },
  { name: 'Kiku Stationery', slug: 'kiku-stationery' },
  { name: 'FlexOffice', slug: 'flexoffice' },
  { name: 'Olfa', slug: 'olfa' },
  { name: 'Herlitz', slug: 'herlitz' },
  { name: 'Leely', slug: 'leely' },
  { name: 'Paperwork', slug: 'paperwork' },
  { name: 'Telesin', slug: 'telesin' },
  { name: 'Faber Castell', slug: 'faber-castell' },
  // Catch-all for unknown brands
  { name: 'Others', slug: 'others' },
];

async function main() {
  console.log('🏁 Starting category & brand seeding...\n');

  // ─── Step 1: Seed Categories ──────────────────────────────────────────────
  console.log('📂 Seeding categories...');
  let parentCount = 0;
  let subCount = 0;

  for (const cat of CATEGORY_HIERARCHY) {
    // Upsert parent category
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        position: cat.position,
        isActive: true,
        deletedAt: null,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        position: cat.position,
        isActive: true,
      },
    });
    parentCount++;
    console.log(`  ✅ Parent: ${parent.name} (${parent.id})`);

    // Upsert sub-categories
    for (const sub of cat.subCategories) {
      const child = await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {
          name: sub.name,
          position: sub.position,
          parentId: parent.id,
          isActive: true,
          deletedAt: null,
        },
        create: {
          name: sub.name,
          slug: sub.slug,
          position: sub.position,
          parentId: parent.id,
          isActive: true,
        },
      });
      subCount++;
      console.log(`     └─ Sub: ${child.name}`);
    }
  }

  console.log(`\n📊 Categories seeded: ${parentCount} parents, ${subCount} sub-categories\n`);

  // ─── Step 2: Seed Brands ──────────────────────────────────────────────────
  console.log('🏷️  Seeding brands...');
  let brandCount = 0;

  for (const brand of BRANDS) {
    // Check if brand already exists by name
    const existing = await prisma.brand.findUnique({ where: { name: brand.name } });
    if (existing) {
      // Update slug if missing & ensure active
      await prisma.brand.update({
        where: { name: brand.name },
        data: {
          slug: existing.slug || brand.slug,
          isActive: true,
          deletedAt: null,
        },
      });
      console.log(`  🔄 Brand exists, updated: ${brand.name}`);
    } else {
      // Check if slug already taken by another brand
      const slugTaken = brand.slug ? await prisma.brand.findUnique({ where: { slug: brand.slug } }) : null;
      await prisma.brand.create({
        data: {
          name: brand.name,
          slug: slugTaken ? `${brand.slug}-pl` : brand.slug,
          isActive: true,
        },
      });
      console.log(`  ✅ Brand created: ${brand.name}`);
    }
    brandCount++;
  }

  console.log(`\n📊 Brands seeded: ${brandCount}\n`);

  // ─── Step 3: Verify ───────────────────────────────────────────────────────
  const totalCategories = await prisma.category.count({ where: { deletedAt: null } });
  const totalBrands = await prisma.brand.count({ where: { deletedAt: null } });
  console.log(`🔍 Verification:`);
  console.log(`   Total categories in DB: ${totalCategories}`);
  console.log(`   Total brands in DB: ${totalBrands}`);
  console.log('\n✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
