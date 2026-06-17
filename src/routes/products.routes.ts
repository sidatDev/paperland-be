
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';
import crypto from 'crypto';
import { featureFlags } from '../config/feature-flags';

export default async function productRoutes(fastify: FastifyInstance) {
  
  // Helper to resolve Category/Brand ID by ID or Name
  const resolveEntityId = async (model: string, idOrName: string) => {
    if (!idOrName) return null;
    
    // Check if it's a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);
    
    if (isUuid) {
      const exists = await (fastify.prisma as any)[model].findUnique({ where: { id: idOrName } });
      if (exists) return exists.id;
    }
    
    // Try find by Name
    const byName = await (fastify.prisma as any)[model].findFirst({
      where: { name: { equals: idOrName, mode: 'insensitive' } }
    });
    if (byName) return byName.id;
    
    return null;
  };

  const slugify = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

  const generateUniqueSlug = async (name: string, partNo: string, sku: string, excludeId?: string) => {
      const parts = [name];
      if (partNo) parts.push(partNo);
      if (sku && sku.trim().toLowerCase() !== partNo.trim().toLowerCase()) parts.push(sku);
      
      let slug = slugify(parts.join('-'));
      
      let counter = 0;
      while (true) {
          const checkSlug = counter === 0 ? slug : `${slug}-${counter}`;
          const existing = await (fastify.prisma as any).product.findFirst({ where: { slug: checkSlug } });
          if (!existing || (excludeId && existing.id === excludeId)) return checkSlug;
          counter++;
      }
  };

  // Helper to normalize SKU (remove symbols/spaces)
  const normalizeSKU = (sku: string) => {
    return sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  };

  // Helper to map Prisma Product to Typesense Document
  const mapToTypesenseDocument = (p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug || '',
      sku: p.sku,
      normalized_sku: normalizeSKU(p.sku),
      part_no: (p.specifications as any)?.partNo || '',
      normalized_part_no: (p.specifications as any)?.partNo ? normalizeSKU((p.specifications as any).partNo) : '',
      description: p.description || '',
      brand: p.brand?.name || 'Unknown',
      category: p.category?.name || 'Uncategorized',
      price: Number(p.prices?.[0]?.priceRetail || p.price || 0),
      currency: p.prices?.[0]?.currency?.code || 'PKR',
      image_url: p.imageUrl || '',
      industry: p.industries?.map((i: any) => i.industry.name) || [],
      created_at: Math.floor(new Date(p.createdAt).getTime() / 1000),
      is_featured: p.isFeatured || false,
      isActive: p.isActive,
      status: p.status || (p.isActive ? 'Active' : 'Draft'),
  });

  // Helper to transform Prisma Product to API JSON
  const transformProduct = (p: any) => {
    const specs = p.specifications || {};
    
    return {
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      isFeatured: p.isFeatured || false,
      sku: p.sku,
      slug: p.slug, 
      groupNumber: p.groupNumber,
      groupId: p.groupId,
      status: (() => {
        const baseStock = p.stocks?.reduce((acc: number, s: any) => acc + (s.qty || 0), 0) || 0;
        const variantsStock = p.variants?.reduce((acc: number, v: any) => 
            acc + (v.stocks?.reduce((a: number, s: any) => a + (s.qty || 0), 0) || 0), 0) || 0;
        const totalStock = p.variants?.length > 0 ? variantsStock : baseStock;

        const baseThreshold = p.stocks?.reduce((acc: number, s: any) => acc + (s.reorderLevel || 0), 0) || 0;
        const variantsThreshold = p.variants?.reduce((acc: number, v: any) => 
            acc + (v.stocks?.reduce((a: number, s: any) => a + (s.reorderLevel || 0), 0) || 0), 0) || 0;
        const effectiveThreshold = p.variants?.length > 0 ? variantsThreshold : baseThreshold;

        if (totalStock > effectiveThreshold) {
            if (p.status === "Out of Stock") return "Active";
            return p.status || (p.isActive ? "Active" : "Draft");
        } else {
            if (p.status === "Active" || (!p.status && p.isActive)) return "Out of Stock";
            return p.status || "Out of Stock";
        }
      })(),
      price: Number(p.price || 0),
      relatedProductsCount: 0, 

      // Added top-level fields for Edit/View Form mapping
      brand: { id: p.brandId, name: p.brand?.name },
      category: { id: p.categoryId, name: p.category?.name },
      description: p.description || "",
      width: p.width || "",
      length: p.length || "",
      weight: p.weight || "",
      volume: p.volume || "",
      specs: specs.technical || [],

      generalInformation: [
        { key: "brand", title: "Brand", value: p.brand?.name, id: p.brandId, order: 2 },
        { key: "category", title: "Category", value: p.category?.name, id: p.categoryId, order: 3 },
        { key: "groupNumber", title: "Group Number", value: p.groupNumber, order: 5 },
        { key: "subCategory", title: "Sub Category", value: specs.subCategory || "N/A", order: 6 },
        { key: "description", title: "Description", value: p.description, order: 9 },
        { key: "fullDescription", title: "Full Description", value: p.fullDescription, order: 10 },
        { key: "status", title: "Status", value: p.status, order: 11 }
      ],

      // Stock & Availability Calculations
      hasOutOfStockVariants: p.variants?.some((v: any) => {
          const vStock = v.stocks?.reduce((acc: number, s: any) => acc + (s.qty || 0), 0) || 0;
          return vStock <= 0;
      }) || false,

      effectiveThreshold: (() => {
        const base = p.stocks?.reduce((acc: number, s: any) => acc + (s.reorderLevel || 0), 0) || 0;
        const variants = p.variants?.reduce((acc: number, v: any) => 
            acc + (v.stocks?.reduce((a: number, s: any) => a + (s.reorderLevel || 0), 0) || 0), 0) || 0;
        return p.variants?.length > 0 ? variants : base;
      })(),

      technicalSpecifications: [
        { key: "width", title: "Width", value: p.width, unit: "mm", order: 1 },
        { key: "length", title: "Length", value: p.length, unit: "mm", order: 2 },
        { key: "weight", title: "Weight", value: p.weight, unit: "kg", order: 3 },
        { key: "volume", title: "Volume", value: p.volume, unit: "m³", order: 4 },
        ...(specs.technical || []).map((t: any) => ({
            key: t.key || t.label,
            title: t.title || t.label,
            value: t.value,
            unit: t.unit,
            order: t.order || 99
        }))
      ],

      attributes: [],

      industries: p.industries?.map((pi: any) => ({
        id: pi.industry.id,
        name: pi.industry.name
      })) ?? [],

      pricing: (() => {
        const supported = ['PKR'];
        const results = p.prices?.map((price: any) => ({
           currency: price.currency?.code,
           basePrice: Number(price.priceRetail),
           wholesalePrice: Number(price.priceWholesale),
           promotionalPrice: Number(price.priceSpecial)
        })) ?? [];
        
        const existingCodes = results.map((r: any) => r.currency);
        const pkrPrice = results.find((r: any) => r.currency === 'PKR');
        const pkrBase = pkrPrice ? pkrPrice.basePrice : Number(p.price || 0);

        supported.forEach(code => {
            if (!existingCodes.includes(code)) {
                results.push({
                    currency: code,
                    basePrice: Number(pkrBase.toFixed(2)),
                    wholesalePrice: Number((pkrBase * 0.9).toFixed(2))
                });
            }
        });
        return results;
      })(),

      imageUrl: p.imageUrl || (p.images && p.images.length > 0 ? p.images[0] : null),

      inventory: p.stocks?.filter((s: any) => !s.deletedAt).map((stock: any) => ({
         warehouseId: stock.warehouseId,
         locationId: stock.locationId, // Keep for backward compat
         physicalQty: stock.qty,
         reservedQty: stock.reservedQty || 0,
         quantityAvailable: Math.max(0, stock.qty - (stock.reservedQty || 0)),
         warehouse: stock.warehouse ? {
           id: stock.warehouse.id,
           code: stock.warehouse.code,
           name: stock.warehouse.name
         } : null
      })) ?? [],
      totalPhysicalStock: p.variants && p.variants.length > 0 
        ? p.variants.reduce((acc: number, v: any) => acc + (v.stocks?.reduce((sAcc: number, s: any) => sAcc + (s.qty || 0), 0) || 0), 0)
        : p.stocks?.reduce((acc: number, s: any) => acc + (s.qty || 0), 0) || 0,
      totalReservedStock: p.variants && p.variants.length > 0
        ? p.variants.reduce((acc: number, v: any) => acc + (v.stocks?.reduce((sAcc: number, s: any) => sAcc + (s.reservedQty || 0), 0) || 0), 0)
        : p.stocks?.reduce((acc: number, s: any) => acc + (s.reservedQty || 0), 0) || 0,
      totalStock: p.variants && p.variants.length > 0
        ? p.variants.reduce((acc: number, v: any) => acc + Math.max(0, v.stocks?.reduce((sAcc: number, s: any) => sAcc + (s.qty - (s.reservedQty || 0)), 0) || 0), 0)
        : Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
      
      wholesalePrice: Number(p.prices?.find((pr: any) => pr.isActive)?.priceWholesale || p.prices?.[0]?.priceWholesale || 0),
      promotionalPrice: Number(p.prices?.find((pr: any) => pr.isActive)?.priceSpecial || p.prices?.[0]?.priceSpecial || 0),

      media: (p.images && p.images.length > 0)
        ? p.images.map((url: string, index: number) => ({ type: 'image', url, label: index === 0 ? 'Main' : `Image ${index + 1}` }))
        : (p.imageUrl ? [{ type: 'image', url: p.imageUrl, label: 'Main' }] : []),

      seo: (p.specifications as any)?.seo || {}, // Return SEO from specifications
      isVisibleOnEcommerce: p.isVisibleOnEcommerce,
      fullDescription: p.fullDescription, // Return fullDescription
      specifications: p.specifications || {}, // Return specifications for raw access
      costPrice: p.costPrice ? Number(p.costPrice) : 0,

      // Variants
      parentId: p.parentId,
      variantOptions: p.variantOptions,
      variantAttributes: p.variantAttributes,
      variants: p.variants ? p.variants.map(transformProduct) : [],

      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  };

  // Products Search (Lightweight for Autocomplete)
  fastify.get('/admin/products/search', {
    schema: {
        description: 'Search products by name, brand, or SKU for autocomplete',
        tags: ['Catalog'],
        querystring: {
            type: 'object',
            properties: {
                q: { type: 'string' }
            }
        }
    }
  }, async (request: any, reply) => {
      const { q } = request.query;
      try {
          // If query is empty, return default active products from Prisma
          if (!q || q.trim() === '') {
              const products = await (fastify.prisma as any).product.findMany({
                  where: {
                      deletedAt: null,
                      isActive: true,
                      parentId: null
                  },
                  select: {
                      id: true,
                      name: true,
                      sku: true,
                      price: true,
                      imageUrl: true,
                      brand: { select: { name: true } },
                      prices: {
                          where: { isActive: true },
                          include: { currency: true }
                      },
                      stocks: true
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 20
              });

              const transformed = products.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  sku: p.sku,
                  price: Number(p.price || p.prices?.[0]?.priceRetail || 0),
                  brand: p.brand?.name || 'Unknown',
                  currency: p.prices?.[0]?.currency?.code || 'PKR',
                  currentStock: p.stocks?.reduce((acc: number, stock: any) => acc + stock.qty, 0) || 0,
                  image_url: p.imageUrl
              }));

              return createResponse(transformed, "Default products retrieved");
          }

          // Try Typesense search first
          if (fastify.typesense) {
              try {
                  const searchParameters = {
                      q: q,
                      query_by: 'name,brand,sku,category',
                      filter_by: 'isActive:true',
                      per_page: 20
                  };
                  const result = await fastify.typesense.collections('products').documents().search(searchParameters);
                  
                  const transformed = result.hits?.map((hit: any) => {
                      const doc = hit.document;
                      return {
                          id: doc.id,
                          name: doc.name,
                          sku: doc.sku,
                          price: Number(doc.price || 0),
                          brand: doc.brand || 'Unknown',
                          currency: doc.currency || 'PKR',
                          currentStock: 0,
                          image_url: doc.image_url
                      };
                  }) || [];

                  // Populate stock count for Typesense hits from Prisma
                  if (transformed.length > 0) {
                      const productIds = transformed.map((t: any) => t.id);
                      const stocks = await (fastify.prisma as any).stock.findMany({
                          where: { productId: { in: productIds } }
                      });
                      transformed.forEach((t: any) => {
                          const pStocks = stocks.filter((s: any) => s.productId === t.id);
                          t.currentStock = pStocks.reduce((acc: number, s: any) => acc + s.qty, 0) || 0;
                      });
                  }

                  return createResponse(transformed, "Search successful via Typesense");
              } catch (tsErr) {
                  fastify.log.error(tsErr, "Typesense search failed, falling back to Prisma");
              }
          }

          // Prisma Fallback Search (searching name, sku, brand name, and category name)
          const products = await (fastify.prisma as any).product.findMany({
              where: {
                  deletedAt: null,
                  isActive: true,
                  OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { sku: { contains: q, mode: 'insensitive' } },
                      { brand: { name: { contains: q, mode: 'insensitive' } } },
                      { category: { name: { contains: q, mode: 'insensitive' } } }
                  ]
              },
              select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  imageUrl: true,
                  brand: { select: { name: true } },
                  prices: {
                      where: { isActive: true },
                      include: { currency: true }
                  },
                  stocks: true
              },
              take: 20
          });

          const transformedFallback = products.map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              price: Number(p.price || p.prices?.[0]?.priceRetail || 0),
              brand: p.brand?.name || 'Unknown',
              currency: p.prices?.[0]?.currency?.code || 'PKR',
              currentStock: p.stocks?.reduce((acc: number, stock: any) => acc + stock.qty, 0) || 0,
              image_url: p.imageUrl
          }));

          return createResponse(transformedFallback, "Search successful via Prisma");
      } catch (err) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Search Failed'));
      }
  });

  // List all products
  fastify.get('/admin/products', {
    schema: { description: 'List all products with filters', tags: ['Catalog'] }
  }, async (request: any, reply) => {
    const { 
        page = 1, limit = 10, search, 
        categoryId, categoryIds,
        brandId, brandIds,
        industryIds,
        minPrice, maxPrice,
        isActive, status,
        country, locationId, warehouseId,
        includeVariants, stockStatus,
        groupedView, parentId: parentIdFilter,
        ...dynamicFilters 
    } = request.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    fastify.log.info({ query: request.query }, "Admin list products filters");
    try {
      let productIdsFromSearch: string[] | undefined = undefined;

      if (search && search.trim() !== '') {
        if (fastify.typesense) {
          try {
            const searchParameters = {
              q: search,
              query_by: 'name,brand,sku,category',
              per_page: 250
            };
            const result = await fastify.typesense.collections('products').documents().search(searchParameters);
            productIdsFromSearch = result.hits?.map((hit: any) => hit.document.id) || [];
          } catch (tsErr) {
            fastify.log.error(tsErr, "Typesense query failed in admin list, falling back to Prisma search");
          }
        }
      }

      const parseFilterArray = (val: any) => {
        if (!val || val === 'all') return undefined;
        const arr = Array.isArray(val) ? val : val.split(',').filter(Boolean);
        const filtered = arr.filter((v: string) => v !== 'all' && v !== '');
        return filtered.length > 0 ? filtered : undefined;
      };

      const cIds = parseFilterArray(categoryIds);
      const bIds = parseFilterArray(brandIds);
      const iIds = parseFilterArray(industryIds);

      // Status Classification Logic (Simplified to use top-level field)
      const where: any = {
        deletedAt: null, 
        AND: [
          productIdsFromSearch !== undefined ? { id: { in: productIdsFromSearch } } : (
            search ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ]
            } : {}
          ),
          
          // Status Filter
          status && status !== 'all' ? { status } : {},
          
          // Category Filters
          categoryId && categoryId !== 'all' ? { categoryId } : {},
          cIds ? { categoryId: { in: cIds } } : {},
          
          // Brand Filters
          brandId && brandId !== 'all' ? { brandId } : {},
          bIds ? { brandId: { in: bIds } } : {},

          // Industry Filters
          iIds ? { industries: { some: { industryId: { in: iIds } } } } : {},

          // Price Filters
          minPrice !== undefined && minPrice !== "" ? { price: { gte: Number(minPrice) } } : {},
          maxPrice !== undefined && maxPrice !== "" ? { price: { lte: Number(maxPrice) } } : {},

          // Only Base Products (Hide Variants unless explicitly requested)
          String(includeVariants) === 'true' || groupedView === 'variants' ? {} : { parentId: null },

          // Parent Filter (Task 2.2)
          parentIdFilter !== undefined ? (parentIdFilter === 'null' ? { parentId: null } : { parentId: parentIdFilter }) : {},

          // Grouped View (Task 2.2)
          groupedView === 'parents' ? { parentId: null } : {},
          groupedView === 'variants' ? { parentId: { not: null } } : {},

          isActive !== undefined && isActive !== 'all' ? { isActive: isActive === 'true' || isActive === true } : {},

          // Warehouse/Location Filter
          (warehouseId || locationId) && (warehouseId !== 'all' && locationId !== 'all') 
            ? { stocks: { some: { OR: [ { warehouseId: warehouseId || locationId }, { locationId: warehouseId || locationId } ] } } } 
            : {},

          // Stock Status Filter
          stockStatus === 'outOfStock' ? {
              OR: [
                  { stocks: { none: { qty: { gt: 0 } } } },
                  (warehouseId || locationId) ? { stocks: { some: { 
                      OR: [ { warehouseId: warehouseId || locationId }, { locationId: warehouseId || locationId } ],
                      qty: { lte: 0 } 
                  } } } : {}
              ]
          } : {},

          stockStatus === 'inStock' ? {
              stocks: { some: { 
                  qty: { gt: 0 },
                  ...( (warehouseId || locationId) ? { OR: [ { warehouseId: warehouseId || locationId }, { locationId: warehouseId || locationId } ] } : {} )
              } }
          } : {},

          stockStatus === 'lowStock' ? {
              stocks: { some: { 
                  // Assuming low stock means qty > 0 but qty <= 10 (or reorderLevel)
                  // For simplicity at Prisma level, we'll check qty <= 10 if we can't compare reorderLevel easily
                  qty: { lte: 10, gt: 0 },
                  ...( (warehouseId || locationId) ? { OR: [ { warehouseId: warehouseId || locationId }, { locationId: warehouseId || locationId } ] } : {} )
              } }
          } : {},
        ]
      };

      fastify.log.error({ 
        includeVariants, 
        receivedType: typeof includeVariants,
        willInclude: (includeVariants === 'true' || includeVariants === true)
      }, "DEBUG: Variant Filter check");

      if (dynamicFilters.groupNumber) {
        where.AND.push({ groupNumber: { contains: dynamicFilters.groupNumber, mode: 'insensitive' } });
      }

      const include: any = { 
        category: true, 
        brand: true, 
        prices: {
            where: country && country !== 'all' ? { currency: { countries: { some: { code: country } } } } : undefined,
            include: { currency: true }
        },
        stocks: {
            where: (warehouseId || locationId) && (warehouseId !== 'all' && locationId !== 'all') 
              ? { OR: [ { warehouseId: warehouseId || locationId }, { locationId: warehouseId || locationId } ] } 
              : undefined
        },
        industries: {
            include: { industry: true }
        }
      };

      if (String(includeVariants) === 'true' || groupedView === 'variants') {
        include.variants = {
            where: { deletedAt: null },
            include: {
                prices: true,
                stocks: true
            }
        };
      }

      const [products, total] = await Promise.all([
        (fastify.prisma as any).product.findMany({
          where,
          include,
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        (fastify.prisma as any).product.count({ where })
      ]);

      const transformed = products.map(transformProduct);

      return createResponse(transformed, 'Products retrieved', {
          page: Number(page),
          limit: Number(limit),
          total
      });

    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // Product Response Schema (Reusable)
  const ProductResponseSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      sku: { type: 'string' },
      isActive: { type: 'boolean' },
      groupNumber: { type: 'string', nullable: true },
      groupId: { type: 'string', nullable: true },
      status: { type: 'string' },
      brand: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } }, additionalProperties: true, nullable: true },
      category: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } }, additionalProperties: true, nullable: true },
      fullDescription: { type: 'string', nullable: true },
      generalInformation: { type: 'array', items: { type: 'object', additionalProperties: true } },
      technicalSpecifications: { type: 'array', items: { type: 'object', additionalProperties: true } },
      attributes: { type: 'array', items: { type: 'object', additionalProperties: true } },
      pricing: { type: 'array', items: { type: 'object', additionalProperties: true } },
      inventory: { type: 'array', items: { type: 'object', additionalProperties: true } },
      media: { type: 'array', items: { type: 'object', additionalProperties: true } },
      seo: { type: 'object', additionalProperties: true },
      isFeatured: { type: 'boolean' },
      isVisibleOnEcommerce: { type: 'boolean' },
      industries: { type: 'array', items: { type: 'object', additionalProperties: true } },
      specifications: { type: 'object', additionalProperties: true },
      costPrice: { type: 'number' },
      
      // Variants
      parentId: { type: 'string', nullable: true },
      variantOptions: { type: 'array', nullable: true, items: { type: 'object', additionalProperties: true } },
      variantAttributes: { type: 'object', nullable: true, additionalProperties: true },
      variants: { type: 'array', items: { type: 'object', additionalProperties: true } },

      createdAt: { type: 'string' },
      updatedAt: { type: 'string' }
    }
  };

  const CreateProductBodySchema = {
    type: 'object',
    required: ['name', 'sku'],
    properties: {
        name: { type: 'string' },
        sku: { type: 'string' },
        description: { type: 'string' },
        fullDescription: { type: 'string' },
        categoryId: { type: 'string' },
        brandId: { type: 'string' },
        groupNumber: { type: 'string' },
        groupId: { type: 'string' },
        isActive: { type: 'boolean' },
        status: { type: 'string' },
        salesPrice: { type: 'number' },
        currency: { type: 'string' },
        stock: { type: 'number' },
        costPrice: { type: 'number' },
        
        // Tech Specs (Dimensions/Weight now in model)
        weight: { type: 'string' },
        width: { type: 'string' },
        length: { type: 'string' },
        volume: { type: 'string' },
        
        specifications: { type: 'object', additionalProperties: true },
        specs: { type: 'array', items: { type: 'object', additionalProperties: true } },
        isFeatured: { type: 'boolean' },
        isVisibleOnEcommerce: { type: 'boolean' },
        industries: { type: 'array', items: { type: 'string' } },
        media: { 
            type: 'array', 
            items: { 
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    variantId: { type: 'string', nullable: true },
                    label: { type: 'string', nullable: true }
                },
                required: ['url'],
                additionalProperties: true
            } 
        },
        seo: { type: 'object', additionalProperties: true },

        // Variants
        promotionalPrice: { type: 'number' },
        tierPricing: {
            type: 'object',
            properties: {
                retail: { type: 'number' },
                wholesale: { type: 'number' },
                special: { type: 'number' }
            },
            additionalProperties: true
        },
        parentId: { type: 'string' },
        variantOptions: { type: 'array', items: { type: 'object', additionalProperties: true } },
        variantAttributes: { type: 'object', additionalProperties: true },
        variants: { type: 'array', items: { type: 'object', additionalProperties: true } }
    }
  };

  // Error Response Schema
  const ErrorResponseSchema = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: { type: 'null' }
    }
  };

  // Get Single Product
  fastify.get('/admin/products/:id', {
      schema: {
          description: 'Get Product Details by ID',
          tags: ['Catalog'],
          querystring: {
              type: 'object',
              properties: {
                  country: { type: 'string', description: 'Filter prices by country code (e.g. PK)' }
              }
          },
          params: {
              type: 'object',
              properties: {
                  id: { type: 'string', description: 'Product ID' }
              }
          },
          response: {
              200: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: ProductResponseSchema
                  }
              },
              404: ErrorResponseSchema,
              500: ErrorResponseSchema
          }
      }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { country } = request.query;
    fastify.log.info(`GET Product request for ID: ${id}, Country: ${country}`);
    try {
      const product = await (fastify.prisma as any).product.findFirst({
        where: { id, deletedAt: null }, // Filter soft-deleted
        include: { 
            category: true, 
            brand: true, 
            prices: { 
                where: country && country !== 'all' ? { currency: { countries: { some: { code: country } } } } : undefined,
                include: { currency: true } 
            }, 
            stocks: true,
            industries: {
                include: { industry: true }
            },
            variants: {
                where: { deletedAt: null },
                include: {
                    prices: true,
                    stocks: true
                }
            }
        }
      });
      if (!product) {
          fastify.log.warn(`Product NOT FOUND for ID: ${id}`);
          return reply.status(404).send(createErrorResponse('Product not found'));
      }
      
      fastify.log.info(`Product FOUND: ${product.name}`);
      return createResponse(transformProduct(product));
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // Create Product
  fastify.post('/admin/products', {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
          description: 'Create a new Product',
          tags: ['Catalog'],
          body: CreateProductBodySchema,
          response: {
              200: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: ProductResponseSchema
                  }
              },
              400: ErrorResponseSchema,
              500: ErrorResponseSchema
          }
      }
  }, async (request: any, reply) => {
    const data: any = request.body;
    try {
        const { 
            name, sku: bodySku, description, groupNumber, groupId, isActive: bodyIsActive,
            categoryId: bodyCategoryId, brandId: bodyBrandId,
            category: bodyCategory, brand: bodyBrand, partNo: bodyPartNo, status = "Draft",
            salesPrice = 0, currency = "PKR", stock = 0, costPrice = 0, specifications = {}, specs = [],
            promotionalPrice = 0, tierPricing = {},
            weight, width, length, volume,
            media, seo, 
            isFeatured = false, 
            isVisibleOnEcommerce = true, 
            fullDescription, 
            industries = [],
            parentId,
            variantOptions,
            variantAttributes,
            variants = []
        } = data;

        console.log('Create Product Body:', JSON.stringify(data, null, 2));

        const resolvedCategoryId = await resolveEntityId('category', bodyCategoryId || bodyCategory);
        const resolvedBrandId = await resolveEntityId('brand', bodyBrandId || bodyBrand);
        const resolvedSku = bodySku || bodyPartNo || data.partNo;

        if (!resolvedCategoryId) return reply.status(400).send(createErrorResponse('Valid Category ID or Name is required'));
        if (!resolvedBrandId) return reply.status(400).send(createErrorResponse('Valid Brand ID or Name is required'));
        if (!resolvedSku) return reply.status(400).send(createErrorResponse('SKU is required'));

        let finalCategoryId = resolvedCategoryId;
        let finalBrandId = resolvedBrandId;

        if (parentId) {
            const parent = await (fastify.prisma as any).product.findUnique({ where: { id: parentId } });
            if (parent) {
                finalCategoryId = parent.categoryId;
                finalBrandId = parent.brandId;
            }
        }

        const resolvedIsActive = bodyIsActive !== undefined ? (bodyIsActive === 'true' || bodyIsActive === true) : true;
        
        const mediaUrls = (media || []).map((m: any) => typeof m === 'string' ? m : m.url);
        const resolvedImageUrl = (mediaUrls.length > 0) ? mediaUrls[0] : (data.imageUrl || null);

        let currencyRec = await (fastify.prisma as any).currency.findUnique({ where: { code: currency } });
        if (!currencyRec) {
             currencyRec = await (fastify.prisma as any).currency.findFirst({ where: { code: 'PKR' } });
        }

        const defaultWarehouse = await (fastify.prisma as any).warehouse.findFirst({
            where: { isDefault: true, isActive: true },
            select: { id: true }
        });
        const defaultWarehouseId = defaultWarehouse?.id ?? null;

        const partNum = bodyPartNo || "";
        const skuVal = bodySku || "";
        
        const slug = await generateUniqueSlug(name, partNum, skuVal);

        // Prepare variants with unique slugs
        const variantsWithSlugs = await Promise.all(variants.map(async (v: any) => {
            const variantHash = v.variantAttributes ? crypto.createHash('md5').update(JSON.stringify(Object.entries(v.variantAttributes).sort())).digest('hex') : null;
            const vSlug = await generateUniqueSlug(v.name || name, "", v.sku);
            return {
                name: v.name,
                slug: vSlug,
                sku: v.sku,
                price: Number(v.price || v.salesPrice || 0),
                costPrice: Number(v.costPrice || 0),
                isActive: v.isActive !== undefined ? v.isActive : true,
                variantAttributes: v.variantAttributes,
                specifications: variantHash ? { variantHash } : {},
                category: { connect: { id: finalCategoryId } },
                brand: { connect: { id: finalBrandId } },
                imageUrl: v.imageUrl || null,
                prices: {
                    create: {
                        currencyId: currencyRec.id,
                        priceRetail: Number(v.price || v.salesPrice || 0),
                        isActive: true
                    }
                },
                stocks: {
                    create: { warehouseId: defaultWarehouseId, locationId: 'DEFAULT', qty: v.stock || 0 }
                }
            };
        }));

        const productCreated = await (fastify.prisma as any).product.create({
            data: {
                name,
                slug,
                sku: resolvedSku,
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
                length: length?.toString(),
                width: width?.toString(),
                weight: weight?.toString(),
                volume: volume?.toString(),
                specifications: {
                    ...specifications,
                    technical: specs || [],
                    seo: seo || {}
                },
                prices: {
                   create: { 
                     currencyId: currencyRec.id, 
                     priceRetail: Number(salesPrice || 0), 
                     priceWholesale: Number(tierPricing?.wholesale || 0),
                     priceSpecial: Number(promotionalPrice || 0),
                     isActive: true 
                   }
                },
                stocks: {
                    create: { warehouseId: defaultWarehouseId, locationId: 'DEFAULT', qty: stock }
                },
                // Create industry relations
                industries: industries.length > 0 ? {
                    create: industries.map((industryId: string) => ({
                        industry: { connect: { id: industryId } }
                    }))
                } : undefined,
                parent: parentId ? { connect: { id: parentId } } : undefined,
                variantOptions,
                variantAttributes,
                variants: variantsWithSlugs.length > 0 ? {
                    create: variantsWithSlugs
                } : undefined
            },
            include: { 
                category: true, 
                brand: true, 
                prices: { include: {currency: true} }, 
                stocks: true, 
                industries: { include: { industry: true } },
                variants: { include: { prices: true, stocks: true } }
            }
        });

        // Audit Log
        await logActivity(fastify, {
            entityType: 'PRODUCT',
            entityId: productCreated.id,
            action: 'CREATE',
            performedBy: (request.user as any)?.id || 'unknown',
            details: { name, sku: resolvedSku },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        // Invalidate Cache for listings and homepage
        try {
            await fastify.cache.invalidateShopCache('products');
            await fastify.cache.invalidateShopCache('home');
        } catch (cacheErr) {
            fastify.log.error(cacheErr, 'Failed to invalidate cache on create');
        }

        // Sync to Typesense (Async via Queue)
        try {
            if ((fastify as any).queues?.search) {
                await (fastify as any).queues.search.add('product-sync', {
                    type: 'product',
                    action: 'upsert',
                    data: mapToTypesenseDocument(productCreated)
                });
            }
        } catch (tsErr: any) {
            fastify.log.error(tsErr, 'Failed to queue product for Typesense');
        }

        return createResponse(transformProduct(productCreated), "Product Created");
    } catch (err: any) {
        if (err.code === 'P2002') return reply.status(400).send(createErrorResponse('SKU already exists'));
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Create Failed: ' + err.message));
    }
  });

  // Update Product
  fastify.put('/admin/products/:id', {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
          description: 'Update Product Details',
          tags: ['Catalog'],
          params: {
              type: 'object',
              properties: {
                  id: { type: 'string', description: 'Product ID' }
              }
          },
          body: {
              ...CreateProductBodySchema,
              required: [] // No required fields for update
          },
          response: {
              200: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: ProductResponseSchema
                  }
              },
              400: ErrorResponseSchema,
              404: ErrorResponseSchema,
              409: ErrorResponseSchema,
              500: ErrorResponseSchema
          }
      }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const data: any = request.body;
    try {
        const existing = await (fastify.prisma as any).product.findUnique({where:{id}});
        if(!existing) return reply.status(404).send(createErrorResponse("Not found"));

        if (data.updatedAt) {
            const clientTime = new Date(data.updatedAt).getTime();
            const serverTime = new Date(existing.updatedAt).getTime();
            if (Math.abs(clientTime - serverTime) > 2000) { // 2s tolerance
                return reply.status(409).send(createErrorResponse("Product was modified by another user. Please refresh."));
            }
        }

        const { 
            name, sku: bodySku, description, groupNumber, groupId, isActive: bodyIsActive,
            categoryId: bodyCategoryId, brandId: bodyBrandId,
            category: bodyCategory, brand: bodyBrand, partNo: bodyPartNo, status,
            salesPrice, stock, costPrice, specifications, specs,
            promotionalPrice, tierPricing,
            weight, width, length, volume,
            media, seo, 
            isFeatured, isVisibleOnEcommerce, isEcommerceVisible, fullDescription, industries,
            parentId, variantOptions, variantAttributes
        } = data;

        let finalStatus = status;
        let finalIsActive = bodyIsActive !== undefined ? (bodyIsActive === 'true' || bodyIsActive === true) : undefined;

        if (stock !== undefined) {
            const numericStock = Number(stock);
            if (!isNaN(numericStock)) {
                const thresholdVal = data.threshold !== undefined 
                    ? Number(data.threshold) 
                    : (existing.stocks?.reduce((acc: number, s: any) => acc + (s.reorderLevel || 0), 0) || 10);
                
                const currentStatus = status !== undefined ? status : existing.status;
                if (numericStock > thresholdVal) {
                    if (currentStatus === 'Out of Stock') {
                        finalStatus = 'Active';
                        finalIsActive = true;
                    }
                } else {
                    if (currentStatus === 'Active' || (!currentStatus && (bodyIsActive === true || existing.isActive))) {
                        finalStatus = 'Out of Stock';
                    }
                }
            }
        }

        const defaultWarehouse = await (fastify.prisma as any).warehouse.findFirst({
            where: { isDefault: true, isActive: true },
            select: { id: true }
        });
        const defaultWarehouseId = defaultWarehouse?.id ?? null;

        const resolvedIsVisible = isVisibleOnEcommerce !== undefined ? isVisibleOnEcommerce : isEcommerceVisible;

        let finalCategoryId = await resolveEntityId('category', bodyCategoryId || bodyCategory) || existing.categoryId;
        let finalBrandId = await resolveEntityId('brand', bodyBrandId || bodyBrand) || existing.brandId;

        const actualParentId = parentId !== undefined ? parentId : existing.parentId;
        if (actualParentId) {
             const parent = await (fastify.prisma as any).product.findUnique({ where: { id: actualParentId } });
             if (parent) {
                 finalCategoryId = parent.categoryId;
                 finalBrandId = parent.brandId;
             }
        }
        
        // Variables moved closer to usage
        
        const mediaUrls = media !== undefined ? (media || []).map((m: any) => typeof m === 'string' ? m : m.url) : undefined;
        const resolvedImageUrl = (mediaUrls && mediaUrls.length > 0) ? mediaUrls[0] : (data.imageUrl || undefined);

        const updateData: any = {};
        
        if ((name !== undefined && name !== existing.name) || (bodySku !== undefined && bodySku !== existing.sku)) {
             const newName = name || existing.name;
             const newSku = bodySku !== undefined ? bodySku : existing.sku;
             updateData.slug = await generateUniqueSlug(newName, "", newSku, id);
        }

        if (name !== undefined) updateData.name = name;
        if (bodySku !== undefined) {
            const skuExists = await (fastify.prisma as any).product.findFirst({
                where: { sku: bodySku, id: { not: id }, deletedAt: null }
            });
            if (skuExists) {
                return reply.status(400).send(createErrorResponse(`SKU "${bodySku}" already exists for product: ${skuExists.name}`));
            }
            updateData.sku = bodySku;
        }
        if (description !== undefined) updateData.description = description;
        if (fullDescription !== undefined) updateData.fullDescription = fullDescription;
        if (groupNumber !== undefined) updateData.groupNumber = groupNumber;
        if (groupId !== undefined) updateData.groupId = groupId;
        if (finalStatus !== undefined) updateData.status = finalStatus;
        if (costPrice !== undefined) updateData.costPrice = Number(costPrice);
        if (resolvedImageUrl !== undefined) updateData.imageUrl = resolvedImageUrl;
        if (mediaUrls !== undefined) updateData.images = mediaUrls;
        
        if (finalCategoryId) updateData.category = { connect: { id: finalCategoryId } };
        if (finalBrandId) updateData.brand = { connect: { id: finalBrandId } };
        
        if (length !== undefined) updateData.length = length?.toString();
        if (width !== undefined) updateData.width = width?.toString();
        if (weight !== undefined) updateData.weight = weight?.toString();
        if (volume !== undefined) updateData.volume = volume?.toString();
        
        if (salesPrice !== undefined || costPrice !== undefined || promotionalPrice !== undefined || tierPricing !== undefined) {
            const numericPrice = salesPrice !== undefined ? Number(salesPrice) : undefined;
            const numericCostPrice = costPrice !== undefined ? Number(costPrice) : undefined;
            const priceUpdateData: any = {};
            
            if (numericPrice !== undefined) priceUpdateData.priceRetail = numericPrice;
            if (promotionalPrice !== undefined) priceUpdateData.priceSpecial = Number(promotionalPrice);
            if (tierPricing?.wholesale !== undefined) priceUpdateData.priceWholesale = Number(tierPricing.wholesale);
            
            if (numericPrice !== undefined) updateData.price = numericPrice;
            
            // Check if an active price record exists
            const existingPrice = await (fastify.prisma as any).price.findFirst({
                where: { productId: id, isActive: true }
            });

            // Capture price changes for logging
            const priceLogs: any[] = [];
            const user = (request.user as any);
            let cachedUserName: string | null = null;

            const logPriceChange = async (type: string, oldVal: number, newVal: number) => {
                if (oldVal !== newVal) {
                    if (!cachedUserName && user?.id) {
                        const dbUser = await (fastify.prisma as any).user.findUnique({
                            where: { id: user.id },
                            select: { firstName: true, lastName: true, email: true }
                        });
                        if (dbUser) {
                            cachedUserName = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email;
                        }
                    }

                    priceLogs.push({
                        productId: id,
                        productName: existing.name,
                        sku: existing.sku,
                        priceType: type,
                        oldPrice: oldVal,
                        newPrice: newVal,
                        performedBy: user?.id || 'unknown',
                        userName: cachedUserName || 'Unknown',
                        reason: 'Manual Update'
                    });
                }
            };

            if (numericPrice !== undefined) await logPriceChange('RETAIL', Number(existing.price || 0), numericPrice);
            if (numericCostPrice !== undefined) await logPriceChange('COST', Number(existing.costPrice || 0), numericCostPrice);
            if (promotionalPrice !== undefined) await logPriceChange('SPECIAL', Number(existingPrice?.priceSpecial || 0), Number(promotionalPrice));
            if (tierPricing?.wholesale !== undefined) await logPriceChange('WHOLESALE', Number(existingPrice?.priceWholesale || 0), Number(tierPricing.wholesale));

            if (existingPrice) {
                updateData.prices = {
                    update: [
                        {
                            where: { id: existingPrice.id },
                            data: priceUpdateData
                        }
                    ]
                };
            } else {
                let currencyRec = await (fastify.prisma as any).currency.findFirst({ where: { code: 'PKR' } });
                updateData.prices = {
                    create: {
                        currencyId: currencyRec?.id || 'PKR', // Fallback
                        priceRetail: numericPrice || Number(existing.price || 0),
                        priceWholesale: tierPricing?.wholesale !== undefined ? Number(tierPricing.wholesale) : (numericPrice ? Number(numericPrice) * 0.9 : 0),
                        priceSpecial: promotionalPrice !== undefined ? Number(promotionalPrice) : undefined,
                        isActive: true
                    }
                };
            }

            // Save price logs if any
            if (priceLogs.length > 0) {
                await (fastify.prisma as any).priceUpdateLog.createMany({
                    data: priceLogs
                });
            }
        }
        const resolvedIsActive = finalIsActive !== undefined 
            ? finalIsActive
            : (finalStatus === "Draft" ? false : (finalStatus === "Active" ? true : undefined));

        if (resolvedIsActive !== undefined) updateData.isActive = resolvedIsActive;
        if (isFeatured !== undefined) updateData.isFeatured = (isFeatured === 'true' || isFeatured === true);
        if (resolvedIsVisible !== undefined) updateData.isVisibleOnEcommerce = (resolvedIsVisible === 'true' || resolvedIsVisible === true);

        if (industries !== undefined && Array.isArray(industries)) {
            updateData.industries = {
                deleteMany: {},
                create: industries.map((industryId: string) => ({
                    industry: { connect: { id: industryId } }
                }))
            };
        }

        if (specifications || specs || seo) {
            updateData.specifications = {
                ...(existing.specifications as object || {}),
                ...specifications,
                ...(specs && { technical: specs }),
                ...(seo && { seo })
            };
        }

        if (parentId !== undefined) {
            if (parentId && parentId !== "") {
                updateData.parent = { connect: { id: parentId } };
            } else {
                updateData.parent = { disconnect: true };
            }
        }
        if (variantOptions !== undefined) updateData.variantOptions = variantOptions;
        if (variantAttributes !== undefined) updateData.variantAttributes = variantAttributes;

        if (stock !== undefined && stock !== null) {
            const numericStock = Number(stock);
            if (!isNaN(numericStock)) {
                updateData.stocks = {
                    upsert: {
                        where: { productId_warehouseId: { productId: id, warehouseId: defaultWarehouseId || '' } },
                        create: { qty: numericStock, locationId: 'DEFAULT', warehouseId: defaultWarehouseId },
                        update: { qty: numericStock }
                    }
                };
            }
        }

        if (data.variants !== undefined && Array.isArray(data.variants)) {
            const variantsInRequest = data.variants;
            
            // 1. Sync Existing: Soft-delete variants that are in DB but not in request
            const existingInDb = await (fastify.prisma as any).product.findMany({
                where: { parentId: id, deletedAt: null },
                select: { id: true, sku: true }
            });

            const requestVariantIds = variantsInRequest.filter((v: any) => v.id).map((v: any) => v.id);
            const variantsToDelete = existingInDb.filter((v: any) => !requestVariantIds.includes(v.id));

            if (variantsToDelete.length > 0) {
                for (const v of variantsToDelete) {
                    await (fastify.prisma as any).product.update({
                        where: { id: v.id },
                        data: { 
                            deletedAt: new Date(), 
                            isActive: false,
                            sku: `${v.sku}_del_${Date.now()}`,
                            slug: v.slug ? `${v.slug}_del_${Date.now()}` : undefined
                        }
                    });
                }
                fastify.log.info(`Soft-deleted ${variantsToDelete.length} variants for product ${id}`);
            }

            // 2. Update Existing: Update variants that have an ID
            const variantsToUpdate = variantsInRequest.filter((v: any) => v.id);
            for (const v of variantsToUpdate) {
                // Pre-check SKU for update if it changed
                const current = existingInDb.find((ex: any) => ex.id === v.id);
                if (current && current.sku !== v.sku) {
                    const skuConflict = await (fastify.prisma as any).product.findFirst({
                        where: { sku: v.sku, id: { not: v.id }, deletedAt: null }
                    });
                    if (skuConflict) {
                        return reply.status(400).send(createErrorResponse(`SKU ${v.sku} already exists for another product/variant`));
                    }
                }

                const variantHash = v.variantAttributes ? crypto.createHash('md5').update(JSON.stringify(Object.entries(v.variantAttributes).sort())).digest('hex') : null;

                const vPriceRetail = Number(v.salesPrice || v.price || 0);
                const vPriceWholesale = Number(v.wholesalePrice || (vPriceRetail * 0.9));
                const vPriceSpecial = Number(v.promotionalPrice || 0);

                // Ensure price record exists for variant
                const vExistingPrice = await (fastify.prisma as any).price.findFirst({
                    where: { productId: v.id, isActive: true }
                });

                const variantPriceData: any = {};
                if (vExistingPrice) {
                    variantPriceData.update = [
                        {
                            where: { id: vExistingPrice.id },
                            data: {
                                priceRetail: vPriceRetail,
                                priceWholesale: vPriceWholesale,
                                priceSpecial: vPriceSpecial
                            }
                        }
                    ];
                } else {
                    let currencyRec = await (fastify.prisma as any).currency.findFirst({ where: { code: 'PKR' } });
                    variantPriceData.create = {
                        currencyId: currencyRec?.id || 'PKR',
                        priceRetail: vPriceRetail,
                        priceWholesale: vPriceWholesale,
                        priceSpecial: vPriceSpecial,
                        isActive: true
                    };
                }

                await (fastify.prisma as any).product.update({
                    where: { id: v.id },
                    data: {
                        name: v.name,
                        sku: v.sku,
                        slug: await generateUniqueSlug(v.name, "", v.sku, v.id),
                        price: vPriceRetail,
                        costPrice: Number(v.costPrice || 0),
                        variantAttributes: v.variantAttributes,
                        ...(variantHash ? {
                            specifications: {
                                ...(current?.specifications as object || {}),
                                variantHash
                            }
                        } : {}),
                        prices: variantPriceData,
                        stocks: {
                            upsert: {
                                where: { productId_warehouseId: { productId: v.id, warehouseId: defaultWarehouseId || '' } },
                                create: { qty: v.stock || 0, locationId: 'DEFAULT', warehouseId: defaultWarehouseId },
                                update: { qty: v.stock || 0 }
                            }
                        }
                    }
                });
            }

            // 3. New Variants: Handle creation
            const newVariants = variantsInRequest.filter((v: any) => !v.id);
            if (newVariants.length > 0) {
                // Pre-check for SKU uniqueness in new variants
                const newVariantSkus = newVariants.map((v: any) => v.sku).filter(Boolean);
                
                // Check duplicates within the request
                const uniqueNewSkus = new Set(newVariantSkus);
                if (uniqueNewSkus.size !== newVariantSkus.length) {
                    return reply.status(400).send(createErrorResponse('Duplicate SKUs found within new variants'));
                }

                // Check against database
                const existingVariantSkus = await (fastify.prisma as any).product.findMany({
                    where: { sku: { in: newVariantSkus }, deletedAt: null }
                });
                if (existingVariantSkus.length > 0) {
                    return reply.status(400).send(createErrorResponse(`One or more variant SKUs already exist (e.g. ${existingVariantSkus[0].sku})`));
                }

                // Get default currency for variants
                const currencyRec = await (fastify.prisma as any).currency.findFirst({ where: { code: 'PKR' } });
                
                const newVariantsWithSlugs = await Promise.all(newVariants.map(async (v: any) => {
                    const variantHash = v.variantAttributes ? crypto.createHash('md5').update(JSON.stringify(Object.entries(v.variantAttributes).sort())).digest('hex') : null;
                    const vSlug = await generateUniqueSlug(v.name || name || existing.name, "", v.sku);
                    return {
                        name: v.name,
                        slug: vSlug,
                        sku: v.sku,
                        price: Number(v.price || v.salesPrice || 0),
                        costPrice: Number(v.costPrice || 0),
                        isActive: v.isActive !== undefined ? v.isActive : true,
                        variantAttributes: v.variantAttributes,
                        specifications: variantHash ? { variantHash } : {},
                        category: { connect: { id: finalCategoryId } },
                        brand: { connect: { id: finalBrandId } },
                        imageUrl: v.imageUrl || null,
                        prices: {
                            create: {
                                currencyId: currencyRec.id,
                                priceRetail: Number(v.price || v.salesPrice || 0),
                                priceWholesale: Number(v.wholesalePrice || (Number(v.price || v.salesPrice || 0) * 0.9)),
                                priceSpecial: Number(v.promotionalPrice || 0),
                                isActive: true
                            }
                        },
                        stocks: {
                            create: { warehouseId: defaultWarehouseId, locationId: 'DEFAULT', qty: v.stock || 0 }
                        }
                    };
                }));

                updateData.variants = {
                    create: newVariantsWithSlugs
                };
            }
        }

        const updated = await (fastify.prisma as any).product.update({
             where: { id },
             data: updateData,
             include: { 
                 category: true, 
                 brand: true, 
                 prices: { include: { currency: true } }, 
                 stocks: true, 
                 industries: { include: { industry: true } },
                 variants: {
                     where: { deletedAt: null },
                     include: { prices: true, stocks: true }
                 }
             }
        });

        // Task 4.2: Variant Status Sync (both directions)
        if (!existing.parentId && resolvedIsActive !== undefined) {
             if (resolvedIsActive === false) {
                 // Deactivate all variants when parent is deactivated
                 await (fastify.prisma as any).product.updateMany({
                     where: { parentId: id, deletedAt: null },
                     data: { isActive: false }
                 });
             } else if (resolvedIsActive === true && existing.isActive === false) {
                 // Re-activate all variants when parent is re-activated
                 await (fastify.prisma as any).product.updateMany({
                     where: { parentId: id, deletedAt: null },
                     data: { isActive: true }
                 });
             }
             // Refresh variants
             const refreshedVariants = await (fastify.prisma as any).product.findMany({
                 where: { parentId: id, deletedAt: null },
                 include: { prices: true, stocks: true }
             });
             updated.variants = refreshedVariants;
        }

        // Audit Log
        await logActivity(fastify, {
            entityType: 'PRODUCT',
            entityId: updated.id,
            action: 'UPDATE',
            performedBy: (request.user as any)?.id || 'unknown',
            details: { name: updated.name, sku: updated.sku, fields: Object.keys(updateData) },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        // Invalidate Cache
        try {
            await fastify.cache.invalidateShopCache('products');
            await fastify.cache.invalidateShopCache('home');
            if (updated.slug) await fastify.cache.clearPattern(`product:${updated.slug}:*`);
            // Also invalidate the old slug if it changed
            if (existing.slug && existing.slug !== updated.slug) {
                await fastify.cache.clearPattern(`product:${existing.slug}:*`);
            }
        } catch (cacheErr) {
            fastify.log.error(cacheErr, 'Failed to invalidate cache on update');
        }

        // Sync to Typesense (Async via Queue)
        try {
            if ((fastify as any).queues?.search) {
                await (fastify as any).queues.search.add('product-sync', {
                    type: 'product',
                    action: 'upsert',
                    data: mapToTypesenseDocument(updated)
                });
            }
        } catch (tsErr: any) {
            fastify.log.error(tsErr, 'Failed to queue product update for Typesense');
        }

        return createResponse(transformProduct(updated), "Product Updated");
    } catch (err: any) {
        if (err.code === 'P2002') {
            const target = err.meta?.target ? err.meta.target.join(', ') : 'unknown field';
            fastify.log.error(`P2002 Error: Unique constraint violation on ${target}`, err);
            return reply.status(400).send(createErrorResponse(`Unique constraint violation on field(s): ${target}`));
        }
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Update Failed: ' + err.message));
    }
  });

  // Delete Product
  fastify.delete('/admin/products/:id', {
      schema: {
          description: 'Delete Product (Soft Delete)',
          tags: ['Catalog'],
          params: {
              type: 'object',
              properties: {
                  id: { type: 'string', description: 'Product ID' }
              }
          },
          response: {
              200: {
                  type: 'object',
                  properties: {
                      status: { type: 'string' },
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      data: { type: 'null' }
                  }
              },
              400: ErrorResponseSchema,
              500: ErrorResponseSchema
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          const product = await (fastify.prisma as any).product.findUnique({ where: { id } });
          
        // Perform Soft Delete (Cascade to variants)
          await (fastify.prisma as any).product.update({ 
            where: { id },
            data: { 
                deletedAt: new Date(),
                isActive: false,
                sku: `${product.sku}_del_${Date.now()}`,
                slug: product.slug ? `${product.slug}_del_${Date.now()}` : undefined
            }
          });

          // Fetch variants to delete to dynamically update their SKUs
          const variantsToDelete = await (fastify.prisma as any).product.findMany({
            where: { parentId: id }
          });

          for (const v of variantsToDelete) {
            await (fastify.prisma as any).product.update({
                where: { id: v.id },
                data: {
                    deletedAt: new Date(),
                    isActive: false,
                    sku: `${v.sku}_del_${Date.now()}`,
                    slug: v.slug ? `${v.slug}_del_${Date.now()}` : undefined
                }
            });
          }

          // Invalidate Cache
          try {
              await fastify.cache.invalidateShopCache('products');
              await fastify.cache.invalidateShopCache('home');
              if (product.slug) await fastify.cache.clearPattern(`product:${product.slug}:*`);
          } catch (cacheErr) {
              fastify.log.error(cacheErr, 'Failed to invalidate cache on delete');
          }

          // Audit Log
          await logActivity(fastify, {
            entityType: 'PRODUCT',
            entityId: id,
            action: 'DELETE',
            performedBy: (request.user as any)?.id || 'unknown',
            details: { type: 'SOFT_DELETE' },
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          // Sync to Typesense (Remove)
          try {
              await fastify.typesense.collections('products').documents(id).delete();
              // Also remove variants from Typesense? Yes, if they are synced.
              const variants = await (fastify.prisma as any).product.findMany({ where: { parentId: id }, select: { id: true } });
              for (const v of variants) {
                  await fastify.typesense.collections('products').documents(v.id).delete();
              }
          } catch (tsErr: any) {
              fastify.log.warn(`Failed to remove product ${id} or variants from Typesense: ${tsErr.message}`);
          }

          return createResponse(null, "Product Deleted (Soft)");
      } catch (err: any) {
          fastify.log.error(`[ProductDelete] Error deleting product ${id}: ${err.message}`);
          return reply.status(500).send(createErrorResponse('Delete Failed: ' + (err.message || 'Unknown error')));
      }
  });

  // Get Deactivated Products
  fastify.get('/admin/products/deactivated', {
    schema: {
        description: 'Get all deactivated products',
        tags: ['Catalog'],
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                sku: { type: 'string' },
                                deletedAt: { type: 'string' }
                            }
                        }
                    }
                }
            },
            500: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    success: { type: 'boolean' }
                }
            }
        }
    }
  }, async (request, reply) => {
    try {
        const products = await (fastify.prisma as any).product.findMany({
            where: { NOT: { deletedAt: null } },
            orderBy: { deletedAt: 'desc' },
            select: { id: true, name: true, sku: true, deletedAt: true }
        });
        return createResponse(products);
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to fetch deactivated products'));
    }
  });

  // Restore Product
  fastify.patch('/admin/products/:id/restore', {
    schema: {
        description: 'Restore a deactivated product',
        tags: ['Catalog'],
        params: {
            type: 'object',
            properties: { id: { type: 'string' } }
        },
        response: {
            500: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    success: { type: 'boolean' }
                }
            }
        }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
        await (fastify.prisma as any).product.update({
            where: { id },
            data: { deletedAt: null, isActive: true }
        });

        // Restore variants
        await (fastify.prisma as any).product.updateMany({
            where: { parentId: id },
            data: { deletedAt: null, isActive: true }
        });

        // Invalidate Cache for main product
        const restored = await (fastify.prisma as any).product.findUnique({ where: { id } });
        if (restored?.slug) {
            await fastify.cache.del(`product:${restored.slug}`);
            await fastify.cache.del('shop:home');
            await fastify.cache.clearPattern('shop:products:*');
        }

        // Re-sync to Typesense
        if (restored) {
            try {
                // Fetch full product for sync
                const full = await (fastify.prisma as any).product.findUnique({
                    where: { id },
                    include: { category: true, brand: true, industries: { include: { industry: true } }, prices: { include: { currency: true } }, stocks: true }
                });
                await fastify.typesense.collections('products').documents().upsert(mapToTypesenseDocument(full));
                
                // Also variants
                const variants = await (fastify.prisma as any).product.findMany({
                    where: { parentId: id },
                    include: { category: true, brand: true, industries: { include: { industry: true } }, prices: { include: { currency: true } }, stocks: true }
                });
                for (const v of variants) {
                    await fastify.typesense.collections('products').documents().upsert(mapToTypesenseDocument(v));
                }
            } catch (tsErr) {
                fastify.log.error(tsErr, 'Typesense sync error on restore');
            }
        }

        return createResponse(null, "Product Restored");
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to restore product'));
    }
  });

  // Permanent Delete
  fastify.delete('/admin/products/:id/permanent', {
    schema: {
        description: 'Permanently delete a product',
        tags: ['Catalog'],
        params: {
            type: 'object',
            properties: { id: { type: 'string' } }
        },
        response: {
            500: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    success: { type: 'boolean' }
                }
            }
        }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
        // Find all variant IDs first
        const variants = await (fastify.prisma as any).product.findMany({
            where: { parentId: id },
            select: { id: true }
        });
        const allIds = [id, ...variants.map((v: any) => v.id)];

        // 1. Delete Stock records for all (stocks table doesn't have cascade)
        await (fastify.prisma as any).stock.deleteMany({
            where: { productId: { in: allIds } }
        });

        // 2. Delete entries in other tables that might not have cascade (just in case)
        // Prices, Industries, Batches, Grades usually have cascade in schema, but we can be explicit if needed.
        // Reviews, Wishlist, Cart might also have links.
        await (fastify.prisma as any).review.deleteMany({ where: { productId: { in: allIds } } });
        await (fastify.prisma as any).wishlistItem.deleteMany({ where: { productId: { in: allIds } } });
        await (fastify.prisma as any).cartItem.deleteMany({ where: { productId: { in: allIds } } });

        // 3. Delete Variants
        await (fastify.prisma as any).product.deleteMany({
            where: { parentId: id }
        });

        // 4. Then delete parent
        await (fastify.prisma as any).product.delete({
            where: { id }
        });

        return createResponse(null, "Product Permanently Deleted");
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to permanently delete product'));
    }
  });

  // Bulk Permanent Delete
  fastify.post('/admin/products/bulk-permanent-delete', {
    schema: {
        description: 'Permanently delete multiple products',
        tags: ['Catalog'],
        body: {
            type: 'object',
            required: ['ids'],
            properties: {
                ids: { type: 'array', items: { type: 'string' } }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' }
                }
            },
            500: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    success: { type: 'boolean' }
                }
            }
        }
    }
  }, async (request: any, reply) => {
    const { ids } = request.body;
    try {
        // Find all variants for all selected parents
        const variants = await (fastify.prisma as any).product.findMany({
            where: { parentId: { in: ids } },
            select: { id: true }
        });
        const variantIds = variants.map((v: any) => v.id);
        const allIds = [...ids, ...variantIds];

        // 1. Delete Stock records for all
        await (fastify.prisma as any).stock.deleteMany({
            where: { productId: { in: allIds } }
        });

        // 2. Delete entries in other tables
        await (fastify.prisma as any).review.deleteMany({ where: { productId: { in: allIds } } });
        await (fastify.prisma as any).wishlistItem.deleteMany({ where: { productId: { in: allIds } } });
        await (fastify.prisma as any).cartItem.deleteMany({ where: { productId: { in: allIds } } });

        // 3. Delete Products (Variants first, then parents)
        // We can use a single deleteMany since we have allIds
        await (fastify.prisma as any).product.deleteMany({
            where: { id: { in: allIds } }
        });

        return createResponse(null, `${ids.length} products permanently deleted`);
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to bulk permanently delete products'));
    }
  });
  
  // Export Products (CSV/Excel)
  fastify.get('/admin/products/export', {
    schema: { 
        description: 'Export products to CSV or Excel', 
        tags: ['Catalog'],
        querystring: {
            type: 'object',
            properties: {
                format: { type: 'string', enum: ['csv', 'excel'], default: 'csv' },
                search: { type: 'string' },
                categoryIds: { type: 'string' },
                brandIds: { type: 'string' },
                industryIds: { type: 'string' },
                minPrice: { type: 'number' },
                maxPrice: { type: 'number' },
                isActive: { type: 'string' }
            }
        }
    }
  }, async (request: any, reply) => {
    const { 
        format = 'csv', search, 
        categoryIds, brandIds, industryIds,
        minPrice, maxPrice, isActive 
    } = request.query;

    try {
      const parseFilterArray = (val: any) => {
        if (!val) return undefined;
        if (Array.isArray(val)) return val;
        return val.split(',').filter(Boolean);
      };

      const cIds = parseFilterArray(categoryIds);
      const bIds = parseFilterArray(brandIds);
      const iIds = parseFilterArray(industryIds);

      const where: any = {
        deletedAt: null,
        AND: [
          search ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              // Note: partNo is in specifications JSON, Prisma search on JSON is limited 
              // for insensitive contains. SKU is typically used as Part Number.
            ]
          } : {},
          cIds ? { categoryId: { in: cIds } } : {},
          bIds ? { brandId: { in: bIds } } : {},
          iIds ? { industries: { some: { industryId: { in: iIds } } } } : {},
          minPrice !== undefined && minPrice !== "" ? { price: { gte: Number(minPrice) } } : {},
          maxPrice !== undefined && maxPrice !== "" ? { price: { lte: Number(maxPrice) } } : {},
          isActive !== undefined && isActive !== 'all' ? { isActive: isActive === 'true' } : {},
        ]
      };

      // We use a stream to handle potentially large datasets
      const products = await (fastify.prisma as any).product.findMany({
        where,
        include: { 
          category: true, 
          brand: true, 
          prices: { include: { currency: true } },
          stocks: true,
          industries: { include: { industry: true } }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const fileName = `products_export_${new Date().toISOString().split('T')[0]}`;

      const getPriceByCurrency = (p: any, currCode: string, type: 'retail' | 'wholesale') => {
          const pr = p.prices?.find((price: any) => price.currency?.code === currCode);
          let priceValue: number | null = null;

          if (pr) {
            priceValue = type === 'retail' ? Number(pr.priceRetail) : Number(pr.priceWholesale);
          }
          
          if (!priceValue || priceValue === 0) {
            const sarBase = Number(p.price || 0);
            const rates: Record<string, number> = { 'PKR': 1.0, 'SAR': 0.013, 'AED': 0.013 };
            const rate = rates[currCode.toUpperCase()] || 1.0;
            const converted = sarBase * rate;
            priceValue = type === 'retail' ? converted : (converted * 0.9);
          }
          return (priceValue && priceValue > 0) ? Number(priceValue.toFixed(2)) : 0;
      };

      const columns = [
          { header: 'SKU / Part Number', key: 'sku' },
          { header: 'Product Name', key: 'name' },
          { header: 'Brand', key: 'brand' },
          { header: 'Category', key: 'category' },
          { header: 'Sub-Category', key: 'subCategory' },
          { header: 'Industry', key: 'industry' },
          { header: 'Status', key: 'status' },
          { header: 'Base Price (PKR)', key: 'basePrice' },
          { header: 'PKR Retail', key: 'pkrRetail' },
          { header: 'PKR Wholesale', key: 'pkrWholesale' },
          { header: 'Total Stock', key: 'totalStock' },
          { header: 'SEO Title', key: 'seoTitle' },
          { header: 'SEO Description', key: 'seoDescription' },
          { header: 'SEO Keywords', key: 'seoKeywords' },
          { header: 'Created At', key: 'createdAt' },
          { header: 'Updated At', key: 'updatedAt' },
      ];

      const rows = products.map((p: any) => {
          const specs = p.specifications || {};
          const seo = p.seo || {};
          return {
              sku: p.sku,
              name: p.name,
              brand: p.brand?.name || "N/A",
              category: p.category?.name || "N/A",
              subCategory: specs.subCategory || "N/A",
              industry: p.industries?.map((i: any) => i.industry?.name).filter(Boolean).join(', ') || "N/A",
              status: p.isActive ? "Active" : "Inactive",
              basePrice: Number(p.price || 0),
              pkrRetail: getPriceByCurrency(p, 'PKR', 'retail'),
              pkrWholesale: getPriceByCurrency(p, 'PKR', 'wholesale'),
              totalStock: Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
              seoTitle: seo.title || "",
              seoDescription: seo.description || "",
              seoKeywords: seo.keywords || "",
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString()
          };
      });

      if (format === 'excel') {
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Products');
          worksheet.columns = columns.map(c => ({ header: c.header, key: c.key }));
          worksheet.addRows(rows);
          
          reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          reply.header('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
          
          const buffer = await workbook.xlsx.writeBuffer();
          return reply.send(buffer);
      } else {
          reply.header('Content-Type', 'text/csv; charset=utf-8');
          reply.header('Content-Disposition', `attachment; filename=${fileName}.csv`);
          
          // Add UTF-8 BOM for Excel compatibility
          const BOM = '\ufeff';
          const csvString = await new Promise<string>((resolve, reject) => {
              stringify(rows, { header: true, columns: columns.reduce((acc, c) => ({ ...acc, [c.key]: c.header }), {}) }, (err, output) => {
                  if (err) reject(err);
                  else resolve(output);
              });
          });
          
          return reply.send(BOM + csvString);
      }
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Export Failed'));
    }
  });

  // POST /admin/products/bulk-price-update
  fastify.post('/admin/products/bulk-price-update', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Bulk Price and Rate Update',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['actionType', 'field', 'value'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          brandIds: { type: 'array', items: { type: 'string' } },
          categoryIds: { type: 'array', items: { type: 'string' } },
          actionType: { type: 'string', enum: ['SET_SAME', 'INC_FIXED', 'DEC_FIXED', 'INC_PERCENT', 'DEC_PERCENT', 'COPY_PRODUCT'] },
          field: { type: 'string', enum: ['RETAIL', 'WHOLESALE', 'SPECIAL'] },
          value: { type: 'number' },
          copyFromProductId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { ids, actionType, field, value, copyFromProductId, brandIds, categoryIds } = request.body;
    const prisma = fastify.prisma as any;
    const user = request.user as any;

    try {
      if ((!ids || ids.length === 0) && (!brandIds || brandIds.length === 0) && (!categoryIds || categoryIds.length === 0)) {
        return reply.status(400).send(createErrorResponse('No products, brands, or categories selected'));
      }

      let resolvedIds = ids || [];
      if (resolvedIds.length === 0 && ((brandIds && brandIds.length > 0) || (categoryIds && categoryIds.length > 0))) {
        const filters: any = { deletedAt: null, parentId: null };
        if (brandIds && brandIds.length > 0) {
          filters.brandId = { in: brandIds };
        }
        if (categoryIds && categoryIds.length > 0) {
          filters.categoryId = { in: categoryIds };
        }
        const matchingProducts = await prisma.product.findMany({
          where: filters,
          select: { id: true }
        });
        resolvedIds = matchingProducts.map((p: any) => p.id);
      }

      if (resolvedIds.length === 0) {
        return reply.status(404).send(createErrorResponse('No products found matching selection'));
      }

      // Generate a single batch ID for this bulk action
      const batchId = crypto.randomUUID();

      // Fetch target products and variants
      const targets = await prisma.product.findMany({
        where: { id: { in: resolvedIds }, deletedAt: null },
        include: {
          prices: { where: { isActive: true } },
          variants: {
            where: { deletedAt: null },
            include: { prices: { where: { isActive: true } } }
          }
        }
      });

      if (targets.length === 0) {
        return reply.status(404).send(createErrorResponse('No valid target products found'));
      }

      // Collect all individual items (standalone, parents, and child variants) to update
      const itemsMap = new Map<string, any>();
      for (const t of targets) {
        itemsMap.set(t.id, t);
        if (t.variants && t.variants.length > 0) {
          for (const v of t.variants) {
            itemsMap.set(v.id, {
              ...v,
              parentSku: t.sku
            });
          }
        }
      }

      const allItems = Array.from(itemsMap.values());

      // Fetch source product if action is COPY_PRODUCT
      let sourceProduct: any = null;
      if (actionType === 'COPY_PRODUCT') {
        if (!copyFromProductId) {
          return reply.status(400).send(createErrorResponse('copyFromProductId is required for COPY_PRODUCT'));
        }
        sourceProduct = await prisma.product.findUnique({
          where: { id: copyFromProductId },
          include: {
            prices: { where: { isActive: true } },
            variants: {
              where: { deletedAt: null },
              include: { prices: { where: { isActive: true } } }
            }
          }
        });
        if (!sourceProduct) {
          return reply.status(404).send(createErrorResponse('Source product to copy from not found'));
        }
      }

      // Helper to get matching variant by attributes
      const findMatchingVariant = (sourceVariants: any[], targetAttributes: any) => {
        if (!sourceVariants || !targetAttributes) return null;
        return sourceVariants.find(sv => {
          const svAttrs = sv.variantAttributes || {};
          const targetAttrs = targetAttributes || {};
          const svKeys = Object.keys(svAttrs);
          const targetKeys = Object.keys(targetAttrs);
          if (svKeys.length !== targetKeys.length) return false;
          return svKeys.every(k => String(svAttrs[k]).toLowerCase() === String(targetAttrs[k]).toLowerCase());
        });
      };

      // Resolve admin user display name
      let userName = 'System';
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { firstName: true, lastName: true, email: true }
        });
        if (dbUser) {
          userName = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email;
        }
      }

      const defaultWarehouse = await prisma.warehouse.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true }
      });
      const defaultWarehouseId = defaultWarehouse?.id ?? null;

      const currencyRec = await prisma.currency.findFirst({
        where: { code: 'PKR' }
      }) || { id: 'PKR' };

      const updates: any[] = [];
      const logsToCreate: any[] = [];

      for (const item of allItems) {
        const activePriceObj = item.prices?.[0];
        let oldPrice = 0;

        if (field === 'RETAIL') {
          oldPrice = Number(item.price || 0);
        } else if (field === 'WHOLESALE') {
          oldPrice = Number(activePriceObj?.priceWholesale || Number(item.price || 0) * 0.9);
        } else if (field === 'SPECIAL') {
          oldPrice = Number(activePriceObj?.priceSpecial || 0);
        }

        let newPrice = oldPrice;

        if (actionType === 'SET_SAME') {
          newPrice = Number(value);
        } else if (actionType === 'INC_FIXED') {
          newPrice = oldPrice + Number(value);
        } else if (actionType === 'DEC_FIXED') {
          newPrice = Math.max(0, oldPrice - Number(value));
        } else if (actionType === 'INC_PERCENT') {
          newPrice = oldPrice * (1 + Number(value) / 100);
        } else if (actionType === 'DEC_PERCENT') {
          newPrice = Math.max(0, oldPrice * (1 - Number(value) / 100));
        } else if (actionType === 'COPY_PRODUCT') {
          let sourceItem = sourceProduct;
          if (item.parentId && sourceProduct.variants && sourceProduct.variants.length > 0) {
            const matchedVariant = findMatchingVariant(sourceProduct.variants, item.variantAttributes);
            if (matchedVariant) {
              sourceItem = matchedVariant;
            }
          }
          
          const srcPriceObj = sourceItem.prices?.[0];
          if (field === 'RETAIL') {
            newPrice = Number(sourceItem.price || 0);
          } else if (field === 'WHOLESALE') {
            newPrice = Number(srcPriceObj?.priceWholesale || Number(sourceItem.price || 0) * 0.9);
          } else if (field === 'SPECIAL') {
            newPrice = Number(srcPriceObj?.priceSpecial || 0);
          }
        }

        newPrice = Number(newPrice.toFixed(2));

        if (newPrice !== oldPrice) {
          logsToCreate.push({
            productId: item.id,
            productName: item.name,
            sku: item.sku,
            priceType: field,
            oldPrice,
            newPrice,
            performedBy: user?.id || null,
            userName,
            reason: `Bulk Update (${actionType})`,
            batchId
          });

          updates.push({
            itemId: item.id,
            field,
            newPrice,
            activePriceObj
          });
        }
      }

      if (updates.length === 0) {
        return createResponse(null, "No price changes were necessary");
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.priceUpdateLog.createMany({ data: logsToCreate });

        for (const up of updates) {
          const updateData: any = {};
          if (up.field === 'RETAIL') {
            updateData.price = up.newPrice;
          }

          if (up.activePriceObj) {
            const priceFields: any = {};
            if (up.field === 'RETAIL') priceFields.priceRetail = up.newPrice;
            if (up.field === 'WHOLESALE') priceFields.priceWholesale = up.newPrice;
            if (up.field === 'SPECIAL') priceFields.priceSpecial = up.newPrice;

            await tx.price.update({
              where: { id: up.activePriceObj.id },
              data: priceFields
            });
          } else {
            const priceRetail = up.field === 'RETAIL' ? up.newPrice : 0;
            const priceWholesale = up.field === 'WHOLESALE' ? up.newPrice : (priceRetail * 0.9);
            const priceSpecial = up.field === 'SPECIAL' ? up.newPrice : null;

            await tx.price.create({
              data: {
                productId: up.itemId,
                currencyId: currencyRec.id,
                priceRetail,
                priceWholesale,
                priceSpecial,
                isActive: true
              }
            });
          }

          if (Object.keys(updateData).length > 0) {
            await tx.product.update({
              where: { id: up.itemId },
              data: updateData
            });
          }
        }
      });

      const updatedProducts = await prisma.product.findMany({
        where: { id: { in: updates.map(u => u.itemId) } },
        include: {
          category: true,
          brand: true,
          prices: { include: { currency: true } },
          stocks: true,
          industries: { include: { industry: true } },
          variants: {
            where: { deletedAt: null },
            include: { prices: true, stocks: true }
          }
        }
      });

      for (const p of updatedProducts) {
        try {
          if (fastify.queues?.search) {
            await fastify.queues.search.add('product-sync', {
              type: 'product',
              action: 'upsert',
              data: mapToTypesenseDocument(p)
            });
          }
        } catch (tsErr) {
          fastify.log.error(tsErr, `Failed to queue typesense sync for ${p.id}`);
        }
      }

      await logActivity(fastify, {
        entityType: 'PRODUCT',
        entityId: batchId,
        action: 'BULK_UPDATE_PRICE',
        performedBy: user?.id || 'unknown',
        details: { count: updates.length, field, actionType, batchId },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return createResponse({ batchId, count: updates.length }, "Bulk pricing update completed successfully");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(`Bulk update failed: ${err.message}`));
    }
  });

  // POST /admin/products/bulk-inline-price-update
  fastify.post('/admin/products/bulk-inline-price-update', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Bulk Save Manual Inline Price Updates',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['updates'],
        properties: {
          updates: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'priceRetail', 'priceWholesale'],
              properties: {
                id: { type: 'string' },
                priceRetail: { type: 'number' },
                priceWholesale: { type: 'number' },
                priceSpecial: { type: 'number', nullable: true }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    const { updates } = request.body;
    const prisma = fastify.prisma as any;
    const user = request.user as any;

    try {
      if (!updates || updates.length === 0) {
        return reply.status(400).send(createErrorResponse('No updates provided'));
      }

      // Generate a batch ID for this manual batch
      const batchId = crypto.randomUUID();

      // Resolve user name
      let userName = 'System';
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { firstName: true, lastName: true, email: true }
        });
        if (dbUser) {
          userName = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email;
        }
      }

      const currencyRec = await prisma.currency.findFirst({
        where: { code: 'PKR' }
      }) || { id: 'PKR' };

      // Fetch all targets to be updated
      const productIds = updates.map((u: any) => u.id);
      const targetProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        include: {
          prices: { where: { isActive: true } }
        }
      });

      const productsMap = new Map<string, any>(targetProducts.map((p: any) => [p.id, p]));

      const logsToCreate: any[] = [];
      const dbUpdates: any[] = [];

      for (const u of updates) {
        const product = productsMap.get(u.id);
        if (!product) continue;

        const activePriceObj = product.prices?.[0];
        
        // Old values
        const oldRetail = Number(product.price || 0);
        const oldWholesale = Number(activePriceObj?.priceWholesale || oldRetail * 0.9);
        const oldSpecial = activePriceObj?.priceSpecial !== null && activePriceObj?.priceSpecial !== undefined ? Number(activePriceObj.priceSpecial) : null;

        // New values from payload
        const newRetail = Number(u.priceRetail);
        const newWholesale = Number(u.priceWholesale);
        const newSpecial = u.priceSpecial !== null && u.priceSpecial !== undefined && String(u.priceSpecial).trim() !== '' ? Number(u.priceSpecial) : null;

        // Perform comparison and construct logs
        const logField = (field: 'RETAIL' | 'WHOLESALE' | 'SPECIAL', oldVal: number, newVal: number) => {
          logsToCreate.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            priceType: field,
            oldPrice: oldVal,
            newPrice: newVal,
            performedBy: user?.id || null,
            userName,
            reason: 'Manual Inline Edit',
            batchId
          });
        };

        let changed = false;
        if (newRetail !== oldRetail) {
          logField('RETAIL', oldRetail, newRetail);
          changed = true;
        }
        if (newWholesale !== oldWholesale) {
          logField('WHOLESALE', oldWholesale, newWholesale);
          changed = true;
        }
        // Special comparison: handle null vs 0 vs existing
        const oldSpecialCompare = oldSpecial !== null ? oldSpecial : 0;
        const newSpecialCompare = newSpecial !== null ? newSpecial : 0;
        if (newSpecialCompare !== oldSpecialCompare) {
          logField('SPECIAL', oldSpecialCompare, newSpecialCompare);
          changed = true;
        }

        if (changed) {
          dbUpdates.push({
            id: product.id,
            priceRetail: newRetail,
            priceWholesale: newWholesale,
            priceSpecial: newSpecial,
            activePriceObj
          });
        }
      }

      if (dbUpdates.length === 0) {
        return createResponse(null, "No price changes detected");
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.priceUpdateLog.createMany({ data: logsToCreate });

        for (const item of dbUpdates) {
          // Update product price if Retail price changed
          await tx.product.update({
            where: { id: item.id },
            data: { price: item.priceRetail }
          });

          if (item.activePriceObj) {
            await tx.price.update({
              where: { id: item.activePriceObj.id },
              data: {
                priceRetail: item.priceRetail,
                priceWholesale: item.priceWholesale,
                priceSpecial: item.priceSpecial
              }
            });
          } else {
            await tx.price.create({
              data: {
                productId: item.id,
                currencyId: currencyRec.id,
                priceRetail: item.priceRetail,
                priceWholesale: item.priceWholesale,
                priceSpecial: item.priceSpecial,
                isActive: true
              }
            });
          }
        }
      });

      // Fetch updated details for Typesense sync
      const updatedProducts = await prisma.product.findMany({
        where: { id: { in: dbUpdates.map(u => u.id) } },
        include: {
          category: true,
          brand: true,
          prices: { include: { currency: true } },
          stocks: true,
          industries: { include: { industry: true } },
          variants: {
            where: { deletedAt: null },
            include: { prices: true, stocks: true }
          }
        }
      });

      for (const p of updatedProducts) {
        try {
          if (fastify.queues?.search) {
            await fastify.queues.search.add('product-sync', {
              type: 'product',
              action: 'upsert',
              data: mapToTypesenseDocument(p)
            });
          }
        } catch (tsErr) {
          fastify.log.error(tsErr, `Failed to queue typesense sync for ${p.id}`);
        }
      }

      await logActivity(fastify, {
        entityType: 'PRODUCT',
        entityId: batchId,
        action: 'BULK_UPDATE_PRICE',
        performedBy: user?.id || 'unknown',
        details: { count: dbUpdates.length, batchId, mode: 'INLINE_EDIT' },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return createResponse({ batchId, count: dbUpdates.length }, "Inline pricing updates completed successfully");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(`Inline pricing updates failed: ${err.message}`));
    }
  });

  // POST /admin/products/bulk-price-undo
  fastify.post('/admin/products/bulk-price-undo', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Undo/Revert price adjustments',
      tags: ['Finance'],
      body: {
        type: 'object',
        properties: {
          batchId: { type: 'string' },
          logId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { batchId, logId } = request.body;
    const prisma = fastify.prisma as any;
    const user = request.user as any;

    try {
      if (!batchId && !logId) {
        return reply.status(400).send(createErrorResponse('Either batchId or logId is required'));
      }

      const whereClause: any = {};
      if (batchId) whereClause.batchId = batchId;
      else whereClause.id = logId;

      const logs = await prisma.priceUpdateLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      if (logs.length === 0) {
        return reply.status(404).send(createErrorResponse('No matching price update logs found to revert'));
      }

      const undoBatchId = crypto.randomUUID();

      let userName = 'System';
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { firstName: true, lastName: true, email: true }
        });
        if (dbUser) {
          userName = `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || dbUser.email;
        }
      }

      const productIdsToSync = new Set<string>();
      const reversionLogs: any[] = [];

      await prisma.$transaction(async (tx: any) => {
        for (const log of logs) {
          productIdsToSync.add(log.productId);

          const activePrice = await tx.price.findFirst({
            where: { productId: log.productId, isActive: true }
          });

          if (log.priceType === 'RETAIL') {
            await tx.product.update({
              where: { id: log.productId },
              data: { price: log.oldPrice }
            });
            if (activePrice) {
              await tx.price.update({
                where: { id: activePrice.id },
                data: { priceRetail: log.oldPrice }
              });
            }
          } else if (log.priceType === 'WHOLESALE') {
            if (activePrice) {
              await tx.price.update({
                where: { id: activePrice.id },
                data: { priceWholesale: log.oldPrice }
              });
            }
          } else if (log.priceType === 'SPECIAL') {
            if (activePrice) {
              await tx.price.update({
                where: { id: activePrice.id },
                data: { priceSpecial: log.oldPrice }
              });
            }
          } else if (log.priceType === 'COST') {
            await tx.product.update({
              where: { id: log.productId },
              data: { costPrice: log.oldPrice }
            });
          }

          reversionLogs.push({
            productId: log.productId,
            productName: log.productName,
            sku: log.sku,
            priceType: log.priceType,
            oldPrice: log.newPrice,
            newPrice: log.oldPrice,
            performedBy: user?.id || null,
            userName,
            reason: `Undo Revert of ${batchId ? 'Batch ' + batchId : 'Log ' + logId}`,
            batchId: undoBatchId
          });
        }

        await tx.priceUpdateLog.createMany({ data: reversionLogs });
      });

      const updatedProducts = await prisma.product.findMany({
        where: { id: { in: Array.from(productIdsToSync) } },
        include: {
          category: true,
          brand: true,
          prices: { include: { currency: true } },
          stocks: true,
          industries: { include: { industry: true } },
          variants: {
            where: { deletedAt: null },
            include: { prices: true, stocks: true }
          }
        }
      });

      for (const p of updatedProducts) {
        try {
          if (fastify.queues?.search) {
            await fastify.queues.search.add('product-sync', {
              type: 'product',
              action: 'upsert',
              data: mapToTypesenseDocument(p)
            });
          }
        } catch (tsErr) {
          fastify.log.error(tsErr, `Failed to queue typesense revert sync for ${p.id}`);
        }
      }

      await logActivity(fastify, {
        entityType: 'PRODUCT',
        entityId: undoBatchId,
        action: 'UNDO_PRICE_UPDATE',
        performedBy: user?.id || 'unknown',
        details: { revertedBatchId: batchId || null, revertedLogId: logId || null, undoBatchId },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return createResponse({ undoBatchId, count: logs.length }, "Price reversion completed successfully");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(`Undo failed: ${err.message}`));
    }
  });

  // POST /admin/products/bulk-status-update
  fastify.post('/admin/products/bulk-status-update', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Bulk Status Update for Products',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['ids', 'status'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['Active', 'Draft', 'Out of Stock'] }
        }
      }
    }
  }, async (request: any, reply) => {
    const { ids, status } = request.body;
    const prisma = fastify.prisma as any;
    const user = request.user as any;

    try {
      if (!ids || ids.length === 0) {
        return reply.status(400).send(createErrorResponse('No products selected'));
      }

      // Fetch all targets and variants
      const targets = await prisma.product.findMany({
        where: { id: { in: ids }, deletedAt: null },
        include: {
          variants: { where: { deletedAt: null } }
        }
      });

      if (targets.length === 0) {
        return reply.status(404).send(createErrorResponse('No valid products found'));
      }

      const itemsMap = new Map<string, any>();
      for (const t of targets) {
        itemsMap.set(t.id, t);
        if (t.variants && t.variants.length > 0) {
          for (const v of t.variants) {
            itemsMap.set(v.id, v);
          }
        }
      }

      const allIds = Array.from(itemsMap.keys());
      const isActive = status === 'Active' || status === 'Out of Stock';

      await prisma.product.updateMany({
        where: { id: { in: allIds } },
        data: { status, isActive }
      });

      // Fetch updated details for Typesense sync
      const updatedProducts = await prisma.product.findMany({
        where: { id: { in: allIds } },
        include: {
          category: true,
          brand: true,
          prices: { include: { currency: true } },
          stocks: true,
          industries: { include: { industry: true } },
          variants: {
            where: { deletedAt: null },
            include: { prices: true, stocks: true }
          }
        }
      });

      for (const p of updatedProducts) {
        try {
          if (fastify.queues?.search) {
            await fastify.queues.search.add('product-sync', {
              type: 'product',
              action: 'upsert',
              data: mapToTypesenseDocument(p)
            });
          }
        } catch (tsErr) {
          fastify.log.error(tsErr, `Failed to queue typesense sync on bulk status update for ${p.id}`);
        }
      }

      await logActivity(fastify, {
        entityType: 'PRODUCT',
        entityId: ids[0],
        action: 'BULK_UPDATE_STATUS',
        performedBy: user?.id || 'unknown',
        details: { count: allIds.length, status },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return createResponse({ count: allIds.length, status }, "Bulk status update completed successfully");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(`Bulk status update failed: ${err.message}`));
    }
  });
}
