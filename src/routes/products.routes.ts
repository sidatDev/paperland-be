
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';

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
      status: p.status, 
      isFeatured: p.isFeatured || false,
      sku: p.sku,
      slug: p.slug, 
      groupNumber: p.groupNumber,
      groupId: p.groupId,
      price: Number(p.price || 0),
      relatedProductsCount: 0, 

      // Added top-level fields for Edit/View Form mapping
      brand: p.brandId,
      category: p.categoryId,
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
      totalPhysicalStock: p.stocks?.reduce((acc: number, s: any) => acc + (s.qty || 0), 0) || 0,
      totalReservedStock: p.stocks?.reduce((acc: number, s: any) => acc + (s.reservedQty || 0), 0) || 0,
      totalStock: Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
      
      wholesalePrice: Number(p.prices?.[0]?.priceWholesale || 0),
      promotionalPrice: Number(p.prices?.[0]?.priceSpecial || 0),

      media: (p.images && p.images.length > 0)
        ? p.images.map((url: string, index: number) => ({ type: 'image', url, label: index === 0 ? 'Main' : `Image ${index + 1}` }))
        : (p.imageUrl ? [{ type: 'image', url: p.imageUrl, label: 'Main' }] : []),

      seo: (p.specifications as any)?.seo || {}, // Return SEO from specifications
      isVisibleOnEcommerce: p.isVisibleOnEcommerce,
      fullDescription: p.fullDescription, // Return fullDescription
      specifications: p.specifications || {}, // Return specifications for raw access

      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  };

  // Products Search (Lightweight for Autocomplete)
  fastify.get('/admin/products/search', {
    schema: {
        description: 'Search products by name or SKU for autocomplete',
        tags: ['Catalog'],
        querystring: {
            type: 'object',
            properties: {
                q: { type: 'string', minLength: 2 }
            },
            required: ['q']
        }
    }
  }, async (request: any, reply) => {
      const { q } = request.query;
      try {
          const products = await (fastify.prisma as any).product.findMany({
              where: {
                  deletedAt: null,
                  isActive: true,
                  OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { sku: { contains: q, mode: 'insensitive' } }
                  ]
              },
              select: {
                  id: true,
                  name: true,
                  sku: true,
                  prices: {
                      where: { isActive: true },
                      include: { currency: true }
                  },
                  stocks: true,
                  isVisibleOnEcommerce: true
              },
              take: 20
          });

          const transformed = products.map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              price: Number(p.price || p.prices?.[0]?.priceRetail || 0),
               currency: p.prices?.[0]?.currency?.code || 'PKR',
              currentStock: p.stocks?.reduce((acc: number, stock: any) => acc + stock.qty, 0) || 0,
              isVisibleOnEcommerce: p.isVisibleOnEcommerce
          }));

          return createResponse(transformed, "Search successful");
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
        country, locationId,
        ...dynamicFilters 
    } = request.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    fastify.log.info({ query: request.query }, "Admin list products filters");
    try {
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
          search ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
          } : {},
          
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

          isActive !== undefined && isActive !== 'all' ? { isActive: isActive === 'true' || isActive === true } : {},

          isActive !== undefined && isActive !== 'all' ? { isActive: isActive === 'true' || isActive === true } : {},
        ]
      };

      if (dynamicFilters.groupNumber) {
        where.AND.push({ groupNumber: { contains: dynamicFilters.groupNumber, mode: 'insensitive' } });
      }

      const [products, total] = await Promise.all([
        (fastify.prisma as any).product.findMany({
          where,
          include: { 
            category: true, 
            brand: true, 
            prices: {
                where: country && country !== 'all' ? { currency: { countries: { some: { code: country } } } } : undefined,
                include: { currency: true }
            },
            stocks: {
                where: locationId && locationId !== 'all' ? { locationId } : undefined
            },
            industries: {
                include: { industry: true }
            }
          },
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
        media: { type: 'array', items: { type: 'string' } }, // Array of URLs
        seo: { type: 'object', additionalProperties: true }
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
            salesPrice = 0, currency = "PKR", stock = 0, specifications = {}, specs = [],
            promotionalPrice = 0, tierPricing = {},
            weight, width, length, volume,
            media, seo, 
            isFeatured = false, 
            isVisibleOnEcommerce = true, 
            fullDescription, 
            industries = [] 
        } = data;

        console.log('Create Product Body:', JSON.stringify(data, null, 2));

        const resolvedCategoryId = await resolveEntityId('category', bodyCategoryId || bodyCategory);
        const resolvedBrandId = await resolveEntityId('brand', bodyBrandId || bodyBrand);
        const resolvedSku = bodySku || bodyPartNo || data.partNo;

        if (!resolvedCategoryId) return reply.status(400).send(createErrorResponse('Valid Category ID or Name is required'));
        if (!resolvedBrandId) return reply.status(400).send(createErrorResponse('Valid Brand ID or Name is required'));
        if (!resolvedSku) return reply.status(400).send(createErrorResponse('SKU is required'));

        const resolvedIsActive = bodyIsActive !== undefined ? (bodyIsActive === 'true' || bodyIsActive === true) : true;
        
        const resolvedImageUrl = (media && media.length > 0) ? media[0] : (data.imageUrl || null);

        let currencyRec = await (fastify.prisma as any).currency.findUnique({ where: { code: currency } });
        if (!currencyRec) {
             currencyRec = await (fastify.prisma as any).currency.create({
                 data: { code: currency, name: currency, symbol: currency }
             });
        }

        const partNum = bodyPartNo || "";
        const skuVal = bodySku || "";
        
        const slug = await generateUniqueSlug(name, partNum, skuVal);

        const productCreated = await (fastify.prisma as any).product.create({
            data: {
                name,
                slug,
                sku: resolvedSku,
                price: Number(salesPrice || 0),
                description,
                fullDescription,
                status,
                groupNumber,
                groupId,
                isActive: resolvedIsActive,
                isFeatured,
                isVisibleOnEcommerce,
                imageUrl: resolvedImageUrl,
                images: media || [],
                category: { connect: { id: resolvedCategoryId } },
                brand: { connect: { id: resolvedBrandId } },
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
                    create: { locationId: 'MAIN', qty: stock }
                },
                // Create industry relations
                industries: industries.length > 0 ? {
                    create: industries.map((industryId: string) => ({
                        industry: { connect: { id: industryId } }
                    }))
                } : undefined
            },
            include: { category: true, brand: true, prices: { include: {currency: true} }, stocks: true, industries: { include: { industry: true } } }
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
            await fastify.cache.del('shop:home');
            await fastify.cache.clearPattern('shop:products:*');
        } catch (cacheErr) {
            fastify.log.error(cacheErr, 'Failed to invalidate cache on create');
        }

        // Sync to Typesense
        try {
            await fastify.typesense.collections('products').documents().upsert(mapToTypesenseDocument(productCreated));
        } catch (tsErr: any) {
            fastify.log.error(tsErr, 'Failed to index product in Typesense');
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
              500: ErrorResponseSchema
          }
      }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const data: any = request.body;
    try {
        const existing = await (fastify.prisma as any).product.findUnique({where:{id}});
        if(!existing) return reply.status(404).send(createErrorResponse("Not found"));

        const { 
            name, sku: bodySku, description, groupNumber, groupId, isActive: bodyIsActive,
            categoryId: bodyCategoryId, brandId: bodyBrandId,
            category: bodyCategory, brand: bodyBrand, partNo: bodyPartNo, status,
            salesPrice, stock, specifications, specs,
            promotionalPrice, tierPricing,
            weight, width, length, volume,
            media, seo, 
            isFeatured, isVisibleOnEcommerce, isEcommerceVisible, fullDescription, industries
        } = data;

        const resolvedIsVisible = isVisibleOnEcommerce !== undefined ? isVisibleOnEcommerce : isEcommerceVisible;

        const resolvedCategoryId = await resolveEntityId('category', bodyCategoryId || bodyCategory) || existing.categoryId;
        const resolvedBrandId = await resolveEntityId('brand', bodyBrandId || bodyBrand) || existing.brandId;
        
        const resolvedIsActive = bodyIsActive !== undefined 
            ? (bodyIsActive === 'true' || bodyIsActive === true) 
            : (status === "Draft" ? false : (status === "Active" ? true : undefined));
        const resolvedImageUrl = (media && media.length > 0) ? media[0] : (data.imageUrl || undefined);

        const updateData: any = {};
        
        if (name !== undefined || bodySku !== undefined) {
             const newName = name || existing.name;
             const newSku = bodySku !== undefined ? bodySku : existing.sku;
             updateData.slug = await generateUniqueSlug(newName, "", newSku, id);
        }

        if (name !== undefined) updateData.name = name;
        if (bodySku !== undefined) updateData.sku = bodySku;
        if (description !== undefined) updateData.description = description;
        if (fullDescription !== undefined) updateData.fullDescription = fullDescription;
        if (groupNumber !== undefined) updateData.groupNumber = groupNumber;
        if (groupId !== undefined) updateData.groupId = groupId;
        if (status !== undefined) updateData.status = status;
        if (resolvedImageUrl !== undefined) updateData.imageUrl = resolvedImageUrl;
        if (media !== undefined) updateData.images = media;
        
        if (resolvedCategoryId) updateData.category = { connect: { id: resolvedCategoryId } };
        if (resolvedBrandId) updateData.brand = { connect: { id: resolvedBrandId } };
        
        if (length !== undefined) updateData.length = length?.toString();
        if (width !== undefined) updateData.width = width?.toString();
        if (weight !== undefined) updateData.weight = weight?.toString();
        if (volume !== undefined) updateData.volume = volume?.toString();
        
        if (salesPrice !== undefined || promotionalPrice !== undefined || tierPricing !== undefined) {
            const numericPrice = salesPrice !== undefined ? Number(salesPrice) : undefined;
            const priceUpdateData: any = {};
            
            if (numericPrice !== undefined) priceUpdateData.priceRetail = numericPrice;
            if (promotionalPrice !== undefined) priceUpdateData.priceSpecial = Number(promotionalPrice);
            if (tierPricing?.wholesale !== undefined) priceUpdateData.priceWholesale = Number(tierPricing.wholesale);
            
            if (numericPrice !== undefined) updateData.price = numericPrice;
            
            updateData.prices = {
                updateMany: {
                    where: { isActive: true },
                    data: priceUpdateData
                }
            };
        }

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

        const updated = await (fastify.prisma as any).product.update({
             where: { id },
             data: updateData,
             include: { category: true, brand: true, prices: { include: { currency: true } }, stocks: true, industries: { include: { industry: true } } }
        });

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
            await fastify.cache.del('shop:home');
            await fastify.cache.clearPattern('shop:products:*');
            if (updated.slug) await fastify.cache.del(`product:${updated.slug}`);
            // Also invalidate the old slug if it changed
            if (existing.slug && existing.slug !== updated.slug) {
                await fastify.cache.del(`product:${existing.slug}`);
            }
        } catch (cacheErr) {
            fastify.log.error(cacheErr, 'Failed to invalidate cache on update');
        }

        // Sync to Typesense
        try {
            await fastify.typesense.collections('products').documents().upsert(mapToTypesenseDocument(updated));
        } catch (tsErr: any) {
            fastify.log.error(tsErr, 'Failed to update product in Typesense');
        }

        return createResponse(transformProduct(updated), "Product Updated");
    } catch (err: any) {
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
          
          // Perform Soft Delete
          await (fastify.prisma as any).product.update({ 
            where: { id },
            data: { 
                deletedAt: new Date(),
                isActive: false
            }
          });

          // Invalidate Cache
          if (product) {
              try {
                  await fastify.cache.del('shop:home');
                  await fastify.cache.clearPattern('shop:products:*');
                  if (product.slug) await fastify.cache.del(`product:${product.slug}`);
              } catch (cacheErr) {
                  fastify.log.error(cacheErr, 'Failed to invalidate cache on delete');
              }
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
          } catch (tsErr: any) {
              fastify.log.warn(`Failed to remove product ${id} from Typesense (it might not exist): ${tsErr.message}`);
          }

          return createResponse(null, "Product Deleted (Soft)");
      } catch (err: any) {
          fastify.log.error(`[ProductDelete] Error deleting product ${id}: ${err.message}`);
          return reply.status(500).send(createErrorResponse('Delete Failed: ' + (err.message || 'Unknown error')));
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
            const rates: Record<string, number> = { 'SAR': 1.0, 'AED': 1.0, 'PKR': 74.5 };
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
          { header: 'Base Price (SAR)', key: 'basePrice' },
          { header: 'SAR Retail', key: 'sarRetail' },
          { header: 'SAR Wholesale', key: 'sarWholesale' },
          { header: 'AED Retail', key: 'aedRetail' },
          { header: 'AED Wholesale', key: 'aedWholesale' },
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
              sarRetail: getPriceByCurrency(p, 'SAR', 'retail'),
              sarWholesale: getPriceByCurrency(p, 'SAR', 'wholesale'),
              aedRetail: getPriceByCurrency(p, 'AED', 'retail'),
              aedWholesale: getPriceByCurrency(p, 'AED', 'wholesale'),
              pkrRetail: getPriceByCurrency(p, 'PKR', 'retail'),
              pkrWholesale: getPriceByCurrency(p, 'PKR', 'wholesale'),
              totalStock: Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - s.reservedQty), 0) || 0),
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
}
