import { PrismaClient } from '@prisma/client';
import { Client } from 'typesense';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const rawHost = process.env.TYPESENSE_HOST || 'localhost';
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
const port = parseInt(process.env.TYPESENSE_PORT || '80');

const host = rawHost
  .replace('http://', '')
  .replace('https://', '')
  .replace(/\/$/, '')
  .split(':')[0];

console.log(`🔌 Connecting to Typesense at: ${protocol}://${host}:${port}`);

const typesense = new Client({
  nodes: [
    {
      host: host,
      port: port,
      protocol: protocol,
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 60,
});

const COLLECTION_NAME = 'products';

// Function to normalize SKU (remove symbols/spaces)
const normalizeSKU = (sku: string) => {
  return sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

async function syncProducts() {
  console.log('🚀 Starting Typesense Sync...');

  try {
    // 1. Define Collection Schema
    const schema: any = {
      name: COLLECTION_NAME,
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'slug', type: 'string', facet: false, optional: true },
        { name: 'sku', type: 'string', facet: false },
        { name: 'normalized_sku', type: 'string', facet: false }, // For typo-tolerant SKU search
        { name: 'part_no', type: 'string', facet: false, optional: true },
        { name: 'normalized_part_no', type: 'string', facet: false, optional: true },
        { name: 'description', type: 'string', optional: true },
        { name: 'brand', type: 'string', facet: true },
        { name: 'category', type: 'string', facet: true },
        { name: 'sub_category', type: 'string', facet: true, optional: true },
        { name: 'price', type: 'float', facet: true },
        { name: 'currency', type: 'string', facet: true },
        { name: 'image_url', type: 'string', facet: false, optional: true },
        { name: 'industry', type: 'string[]', facet: true },
        { name: 'created_at', type: 'int64', facet: false },
        { name: 'is_featured', type: 'bool', facet: true },
        { name: 'isActive', type: 'bool', facet: true },
        { name: 'status', type: 'string', facet: true, optional: true },
      ],
      default_sorting_field: 'created_at',
    };

    // 2. Check if collection exists, delete if it does (for clean re-indexing)
    try {
      await typesense.collections(COLLECTION_NAME).delete();
      console.log('🗑️ Deleted existing collection');
    } catch (e) {
      // Ignore if doesn't exist
    }

    await typesense.collections().create(schema);
    console.log('📁 Created new collection');

    // 3. Fetch Products from Prisma
    // NOTE: We fetch ALL products (even inactive) so we can index them with specific flags if needed, 
    // but typically we only want to search active ones.
    // However, the prompt implies "Draft" products *are* in the index and showing up.
    // So we will fetch them but filter them out in the query.
    // To ensure "Draft" products are indexed (so they *could* be searched by admin later if needed),
    // we should remove the 'where' clause that filters strictly by isActive: true if we want to handle it via search filters.
    // BUT the current code ALREADY filters `isActive: true`.
    // Wait, if the current code filters `isActive: true` (lines 68-71), then "Draft" products (which are `isActive: false`)
    // SHOULD NOT BE IN THE INDEX at all.
    // The user says "Draft hojaiga to wo phr... me suggestion me nai ana chaiye abhi waha per".
    // This implies they ARE appearing.
    // If they are appearing, either:
    // a) They are `isActive: true` but have `status: "Draft"` in specs?
    // b) The sync script wasn't run since they were changed to Draft?
    // c) The `where` clause in this script is wrong?
    
    // I will inspect the `where` clause in the original file. 
    // It says: `where: { isActive: true, deletedAt: null }`.
    // If a product is "Draft", does it have `isActive: true`?
    // In `products.routes.ts`: `status: status || (resolvedIsActive ? "Active" : "Draft")`.
    // It seems "Draft" maps to `isActive: false`.
    // If so, the existing sync script *excludes* them.
    // So why are they showing up?
    // User said "abhi waha per [aa rahay hain]".
    // Perhaps Typesense doesn't delete documents when they are removed from Prisma query?
    // The sync script deletes the ENTIRE collection and re-creates it (lines 57-63).
    // So if the script runs, they should be gone.
    // Unless... the "Draft" products *are* `isActive: true` in the DB?
    // Or the real-time update in `products.routes.ts` does NOT delete them from Typesense?
    // `products.routes.ts` only does `fastify.cache.del`, it does NOT seem to update Typesense on create/update!
    // AND there is no automatic periodic sync mentioned.
    // So if a product was Active (indexed), then changed to Draft (DB updated), 
    // typesense is NOT notified. The document remains in Typesense as "Active" (based on old snapshot).
    //
    // SOLUTION:
    // 1. We should Index ALL products (including Draft) so we can filter them by status/isActive dynamically.
    //    This allows "Draft" products to exist in Typesense but be hidden from public search.
    // 2. OR we realize that we rely on full re-syncs.
    // 
    // If I change the sync script to index *all* products (remove `isActive: true` filter),
    // and then add `isActive` field to schema, 
    // then I can filter `filter_by: isActive:=true` in search.
    // This is more robust.
    
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null, // Only exclude deleted
      },
      include: {
        brand: true,
        category: {
          include: {
            parent: true,
          },
        },
        industries: {
          include: {
            industry: true,
          },
        },
        prices: {
          take: 1, // Default price
          include: {
            currency: true,
          },
        },
      },
    });

    console.log(`📦 Found ${products.length} products to index`);

    // 4. Map and Index
    const documents = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug || '',
      sku: p.sku,
      normalized_sku: normalizeSKU(p.sku),
      part_no: (p.specifications as any)?.partNo || '',
      normalized_part_no: (p.specifications as any)?.partNo ? normalizeSKU((p.specifications as any).partNo) : '',
      description: p.description || '',
      brand: p.brand?.name || 'Unknown',
      category: p.category?.parent ? p.category.parent.name : (p.category?.name || 'Uncategorized'),
      sub_category: p.category?.parent ? p.category.name : '',
      price: Number(p.prices[0]?.priceRetail || 0),
      currency: p.prices[0]?.currency?.code || 'SAR',
      image_url: p.imageUrl || '',
      industry: p.industries.map((i) => i.industry.name),
      created_at: Math.floor(new Date(p.createdAt).getTime() / 1000),
      is_featured: p.isFeatured,
      isActive: p.isActive,
      status: (p.specifications as any)?.status || (p.isActive ? 'Active' : 'Draft'),
    }));
    
    // Import in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await typesense.collections(COLLECTION_NAME).documents().import(batch, { action: 'upsert' });
      console.log(`✅ Indexed ${i + batch.length}/${documents.length} products`);
    }

    console.log('✨ Sync Completed Successfully!');
  } catch (error) {
    console.error('❌ Sync Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncProducts();
