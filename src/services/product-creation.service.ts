import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { logActivity } from '../utils/audit';

export const slugifyText = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeSKU = (sku: string): string =>
  sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export async function resolveEntityId(
  prisma: any,
  model: 'category' | 'brand',
  idOrName?: string | null,
  autoCreate = false
): Promise<string | null> {
  if (!idOrName) return null;
  const trimmed = String(idOrName).trim();
  if (!trimmed) return null;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    );

  if (isUuid) {
    const exists = await prisma[model].findUnique({ where: { id: trimmed } });
    if (exists) return exists.id;
  }

  const normalized = trimmed.toLowerCase();
  const byName = await prisma[model].findFirst({
    where: {
      OR: [
        { name: { equals: trimmed, mode: 'insensitive' } },
        { normalizedName: normalized },
      ],
    },
  });
  if (byName) return byName.id;

  if (autoCreate) {
    const baseSlug = slugifyText(trimmed) || `${model}-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;
    while (await prisma[model].findFirst({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const created = await prisma[model].create({
      data: {
        name: trimmed,
        normalizedName: normalized,
        slug,
        isActive: true,
      },
    });
    return created.id;
  }

  return null;
}

export async function generateUniqueProductSlug(
  prisma: any,
  name: string,
  partNo: string,
  sku: string,
  excludeId?: string
): Promise<string> {
  const parts = [name];
  if (partNo) parts.push(partNo);
  if (sku && sku.trim().toLowerCase() !== partNo.trim().toLowerCase()) {
    parts.push(sku);
  }

  const baseSlug = slugifyText(parts.join('-')) || `product-${Date.now()}`;
  let counter = 0;

  while (true) {
    const checkSlug = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    const existing = await prisma.product.findFirst({
      where: { slug: checkSlug },
    });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return checkSlug;
    }
    counter++;
  }
}

export function mapProductToTypesenseDocument(p: any) {
  const pkr =
    p.prices?.find((pr: any) => pr.isActive && pr.currency?.code === 'PKR') ||
    p.prices?.[0];
  const retailPrice = pkr ? Number(pkr.priceRetail) : Number(p.price || 0);
  const specialPrice = pkr ? Number(pkr.priceSpecial || 0) : 0;

  let finalPrice = retailPrice;
  let originalPrice = 0;

  if (specialPrice > 0 && specialPrice < retailPrice) {
    finalPrice = specialPrice;
    originalPrice = retailPrice;
  }

  return {
    id: p.id,
    name: p.name,
    slug: p.slug || '',
    sku: p.sku,
    normalized_sku: normalizeSKU(p.sku),
    part_no: (p.specifications as any)?.partNo || p.barcode || '',
    normalized_part_no:
      (p.specifications as any)?.partNo || p.barcode
        ? normalizeSKU((p.specifications as any)?.partNo || p.barcode)
        : '',
    description: p.description || '',
    brand: p.brand?.name || 'Unknown',
    category: p.category?.name || 'Uncategorized',
    price: finalPrice,
    original_price: originalPrice,
    currency: p.prices?.[0]?.currency?.code || 'PKR',
    image_url: p.imageUrl || '',
    industry: p.industries?.map((i: any) => i.industry.name) || [],
    created_at: Math.floor(new Date(p.createdAt).getTime() / 1000),
    is_featured: p.isFeatured || false,
    isActive: p.isActive,
    status: p.status || (p.isActive ? 'Active' : 'Draft'),
  };
}

export interface CreateLiveProductOptions {
  autoCreateEntities?: boolean;
  performedBy?: string;
  ip?: string;
  userAgent?: string;
  auditAction?: string;
  auditExtra?: Record<string, any>;
}

/**
 * DRY shared product creation pipeline used by both POST /admin/products
 * and Product Analyzer approval flow.
 */
export async function createLiveProduct(
  fastify: FastifyInstance,
  data: any,
  options: CreateLiveProductOptions = {}
) {
  const prisma = fastify.prisma as any;
  const {
    name,
    sku: bodySku,
    barcode,
    description,
    groupNumber,
    groupId,
    isActive: bodyIsActive,
    categoryId: bodyCategoryId,
    brandId: bodyBrandId,
    category: bodyCategory,
    brand: bodyBrand,
    partNo: bodyPartNo,
    status = 'Draft',
    salesPrice = 0,
    currency = 'PKR',
    stock = 0,
    threshold = 10,
    costPrice = 0,
    specifications = {},
    specs = [],
    tierPricing = {},
    weight,
    width,
    length,
    volume,
    media,
    seo,
    isFeatured = false,
    isVisibleOnEcommerce = true,
    fullDescription,
    industries = [],
    parentId,
    variantOptions,
    variantAttributes,
    variants = [],
  } = data;

  const promotionalPrice = undefined;
  const autoCreate = options.autoCreateEntities === true;

  const resolvedCategoryId = await resolveEntityId(
    prisma,
    'category',
    bodyCategoryId || bodyCategory,
    autoCreate
  );
  const resolvedBrandId = await resolveEntityId(
    prisma,
    'brand',
    bodyBrandId || bodyBrand,
    autoCreate
  );
  const resolvedSku = (bodySku || bodyPartNo || data.partNo || '').trim();

  if (!name || !String(name).trim()) {
    throw Object.assign(new Error('Product Name is required'), { statusCode: 400 });
  }
  if (!resolvedCategoryId) {
    throw Object.assign(new Error('Valid Category ID or Name is required'), {
      statusCode: 400,
    });
  }
  if (!resolvedBrandId) {
    throw Object.assign(new Error('Valid Brand ID or Name is required'), {
      statusCode: 400,
    });
  }
  if (!resolvedSku) {
    throw Object.assign(new Error('SKU is required'), { statusCode: 400 });
  }

  let finalCategoryId = resolvedCategoryId;
  let finalBrandId = resolvedBrandId;

  if (parentId) {
    const parent = await prisma.product.findUnique({ where: { id: parentId } });
    if (parent) {
      finalCategoryId = parent.categoryId;
      finalBrandId = parent.brandId;
    }
  }

  const resolvedIsActive =
    bodyIsActive !== undefined
      ? bodyIsActive === 'true' || bodyIsActive === true
      : true;

  const mediaUrls = (media || [])
    .map((m: any) => (typeof m === 'string' ? m : m?.url))
    .filter(Boolean);
  const resolvedImageUrl =
    mediaUrls.length > 0 ? mediaUrls[0] : data.imageUrl || null;

  let currencyRec = await prisma.currency.findUnique({
    where: { code: currency },
  });
  if (!currencyRec) {
    currencyRec = await prisma.currency.findFirst({ where: { code: 'PKR' } });
  }
  if (!currencyRec) {
    currencyRec = await prisma.currency.findFirst();
  }

  const defaultWarehouse = await prisma.warehouse.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  const defaultWarehouseId = defaultWarehouse?.id ?? null;

  const partNum = bodyPartNo || '';
  const slug = await generateUniqueProductSlug(prisma, name, partNum, resolvedSku);

  const variantsWithSlugs = await Promise.all(
    variants.map(async (v: any) => {
      const variantHash = v.variantAttributes
        ? crypto
            .createHash('md5')
            .update(JSON.stringify(Object.entries(v.variantAttributes).sort()))
            .digest('hex')
        : null;
      const vSlug = await generateUniqueProductSlug(
        prisma,
        v.name || name,
        '',
        v.sku
      );
      return {
        name: v.name,
        slug: vSlug,
        sku: v.sku,
        price: Number(v.price || v.salesPrice || 0),
        costPrice: Number(v.costPrice || 0),
        isActive: v.isActive !== undefined ? v.isActive : true,
        status: v.stock && Number(v.stock) > 0 ? 'Active' : 'Out of Stock',
        variantAttributes: v.variantAttributes,
        specifications: variantHash ? { variantHash } : {},
        category: { connect: { id: finalCategoryId } },
        brand: { connect: { id: finalBrandId } },
        imageUrl: v.imageUrl || null,
        prices: currencyRec
          ? {
              create: {
                currencyId: currencyRec.id,
                priceRetail: Number(v.price || v.salesPrice || 0),
                isActive: true,
              },
            }
          : undefined,
        stocks: {
          create: {
            warehouseId: defaultWarehouseId,
            locationId: 'DEFAULT',
            qty: Number(v.stock || 0),
            reorderLevel: Number(v.threshold ?? 10),
          },
        },
      };
    })
  );

  const productCreated = await prisma.product.create({
    data: {
      name: String(name).trim(),
      slug,
      sku: resolvedSku,
      barcode: barcode ? String(barcode).trim() : null,
      price: Number(salesPrice || 0),
      costPrice: Number(costPrice || 0),
      description,
      fullDescription,
      status,
      groupNumber,
      groupId,
      isActive: resolvedIsActive,
      isFeatured,
      isVisibleOnEcommerce,
      imageUrl: resolvedImageUrl,
      images: mediaUrls,
      category: { connect: { id: finalCategoryId } },
      brand: { connect: { id: finalBrandId } },
      length: length ? String(length) : undefined,
      width: width ? String(width) : undefined,
      weight: weight ? String(weight) : undefined,
      volume: volume ? String(volume) : undefined,
      specifications: {
        ...specifications,
        ...(barcode ? { barcode: String(barcode).trim() } : {}),
        technical: specs || [],
        seo: seo || {},
      },
      prices: currencyRec
        ? {
            create: {
              currencyId: currencyRec.id,
              priceRetail: Number(salesPrice || 0),
              priceWholesale: Number(tierPricing?.wholesale || 0),
              priceSpecial: Number(promotionalPrice || 0),
              isActive: true,
            },
          }
        : undefined,
      stocks: {
        create: {
          warehouseId: defaultWarehouseId,
          locationId: 'DEFAULT',
          qty: Number(stock || 0),
          reorderLevel: Number(threshold ?? 10),
        },
      },
      industries:
        industries.length > 0
          ? {
              create: industries.map((industryId: string) => ({
                industry: { connect: { id: industryId } },
              })),
            }
          : undefined,
      parent: parentId ? { connect: { id: parentId } } : undefined,
      variantOptions,
      variantAttributes,
      variants:
        variantsWithSlugs.length > 0
          ? { create: variantsWithSlugs }
          : undefined,
    },
    include: {
      category: true,
      brand: true,
      prices: { include: { currency: true } },
      stocks: true,
      industries: { include: { industry: true } },
      variants: { include: { prices: true, stocks: true } },
    },
  });

  // Audit Log
  await logActivity(fastify, {
    entityType: 'PRODUCT',
    entityId: productCreated.id,
    action: options.auditAction || 'CREATE',
    performedBy: options.performedBy || 'unknown',
    details: {
      name: productCreated.name,
      sku: resolvedSku,
      barcode: barcode || undefined,
      ...(options.auditExtra || {}),
    },
    ip: options.ip,
    userAgent: options.userAgent,
  });

  // Invalidate Cache
  try {
    await (fastify as any).cache?.invalidateProductCache?.(productCreated);
  } catch (cacheErr) {
    fastify.log.error(cacheErr, 'Failed to invalidate cache on create');
  }

  // Sync to Typesense (Async via Queue if available)
  try {
    if ((fastify as any).queues?.search) {
      await (fastify as any).queues.search.add('product-sync', {
        type: 'product',
        action: 'upsert',
        data: mapProductToTypesenseDocument(productCreated),
      });
    }
  } catch (tsErr: any) {
    fastify.log.error(tsErr, 'Failed to queue product for Typesense');
  }

  return productCreated;
}
