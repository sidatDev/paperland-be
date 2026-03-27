
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { PricingEngine } from '../utils/pricing.engine';

export default async function publicShopRoutes(fastify: FastifyInstance) {
    
    // 0. GET /api/redis-health
    fastify.get('/redis-health', {
        schema: {
            description: 'Check Redis connection status',
            tags: ['Public Shop'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object', additionalProperties: true }
                    }
                },
                503: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'null' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            if (!fastify.redis) {
                return reply.status(503).send(createErrorResponse('Redis plugin not initialized'));
            }
            const ping = await fastify.redis.ping();
            const info = await fastify.redis.info('server');
            const usedMemory = await fastify.redis.info('memory');
            
            return createResponse({
                status: 'connected',
                ping,
                server: info.split('\n').find(l => l.startsWith('redis_version')),
                memory: usedMemory.split('\n').find(l => l.startsWith('used_memory_human'))
            }, 'Redis is healthy');
        } catch (err: any) {
            return createErrorResponse(`Redis health check failed: ${err.message}`);
        }
    });

    // 1. GET /api/shop/home
    fastify.get('/shop/home', {
        schema: {
            description: 'Public homepage sections for landing page',
            tags: ['Public Shop'],
            querystring: {
                type: 'object',
                properties: {
                    cms: { type: 'string' }
                }
            },
            response: {
                200: { type: 'object', additionalProperties: true },
                500: { type: 'object', additionalProperties: true }
            }
        }
    }, async (request: any, reply: any) => {
        const userId = (request.user as any)?.id;
        try {
            // Let's fetch the CMS data for the home page if it exists
            const cmsPage = await (fastify.prisma as any).cMSPage.findUnique({
                where: { slug: 'home' }
            });

            const sections = await (async () => {
                let s = await (fastify.prisma as any).homepageSection.findMany({
                    where: { isActive: true },
                    include: {
                        items: {
                            where: { isActive: true },
                            include: {
                                product: {
                                    where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null },
                                    include: { prices: { include: { currency: true } } }
                                }
                            },
                            orderBy: { sortOrder: 'asc' }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                });

                // Check which types are missing
                const hasCategories = s.some((sec: any) => sec.type === 'categories');
                const hasFeatured = s.some((sec: any) => sec.type === 'featured_products');
                const hasPremium = s.some((sec: any) => sec.type === 'special_offers');
                const hasBestSellers = s.some((sec: any) => sec.type === 'bestsellers');

                if (!hasCategories || !hasFeatured || !hasPremium || !hasBestSellers) {
                    const [latestProducts, randomProducts, premiumProducts] = await Promise.all([
                        (fastify.prisma as any).product.findMany({
                            where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null },
                            take: 4,
                            orderBy: { createdAt: 'desc' },
                            include: { prices: { include: { currency: true } } }
                        }),
                        (fastify.prisma as any).product.findMany({
                            where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null },
                            take: 4,
                            orderBy: { name: 'asc' },
                            include: { prices: { include: { currency: true } } }
                        }),
                        (fastify.prisma as any).product.findMany({
                            where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null },
                            take: 4,
                            orderBy: { updatedAt: 'desc' },
                            include: { prices: { include: { currency: true } } }
                        })
                    ]);

                    if (!hasCategories) {
                        const productsForCategories = await (fastify.prisma as any).product.findMany({
                            where: { name: { in: ['Dollar Premium A4 Paper 80gsm', 'Pelikan Fountain Pen', 'Deli Stapler', 'Faber-Castell Pencils'] }, isActive: true, deletedAt: null },
                            include: { category: true },
                            take: 4
                        });
                        if (productsForCategories.length > 0) {
                            s.push({
                                id: 'categories-auto', type: 'categories', sortOrder: 0,
                                displayTitle: 'Shop Stationeries by Category',
                                subtitle: 'Browse our premium stationeries and office supplies for the perfect solution.',
                                items: productsForCategories.map((p: any) => ({ id: p.id, customTitle: p.name, customLink: `/en/products/${p.slug || p.id}`, product: p }))
                            });
                        }
                    }
                    if (!hasFeatured && latestProducts.length > 0) {
                        s.push({ id: 'featured-auto', type: 'featured_products', sortOrder: 2, displayTitle: 'Featured Products', subtitle: 'TRENDING PRODUCTS', items: latestProducts.map((p: any) => ({ id: p.id, product: p })) });
                    }
                    if (!hasPremium && premiumProducts.length > 0) {
                        s.push({ id: 'premium-auto', type: 'special_offers', sortOrder: 1, displayTitle: 'Our Premium Collection', subtitle: 'Our COLLECTIONS', items: premiumProducts.map((p: any) => ({ id: p.id, product: p })) });
                    }
                    if (!hasBestSellers && randomProducts.length > 0) {
                        s.push({ id: 'bestsellers-auto', type: 'bestsellers', sortOrder: 3, displayTitle: 'Our Best Sellers', subtitle: 'OUR COLLECTIONS', items: randomProducts.map((p: any) => ({ id: p.id, product: p })) });
                    }
                    s.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
                }
                return s;
            })();

            const pricedSections = await Promise.all(sections.map(async (s: any) => {
                const itemsWithProducts = (s.items || []).filter((i: any) => i.product);
                if (itemsWithProducts.length === 0 || !userId) {
                    return {
                        id: s.id, type: s.type, sort_order: s.sortOrder, title: s.displayTitle, subtitle: s.subtitle, cta_label: s.ctaLabel, cta_link: s.ctaLink, styles: s.styles,
                        items: (s.items || []).filter((i: any) => i.product || i.customLink || i.customTitle).map((i: any) => ({
                            id: i.product?.id || i.id, name: i.customTitle || i.product?.name || 'Unnamed', image: i.customImage || i.product?.imageUrl || '',
                            price: (() => {
                                const pkr = i.product?.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                                return pkr ? Number(pkr.priceRetail) : Number(i.product?.prices?.[0]?.priceRetail || i.product?.price || 0);
                            })(),
                            currency: 'PKR', slug: i.product?.slug, link: i.customLink || (i.product ? `/en/products/${i.product.slug || i.product.id}` : '#'), is_featured_large: i.isFeaturedLarge
                        }))
                    };
                }

                const priced = await PricingEngine.calculateBulkPrices(
                    fastify.prisma as any,
                    itemsWithProducts.map((i: any) => {
                        const pkr = i.product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                        return {
                            productId: i.product.id,
                            basePrice: pkr ? Number(pkr.priceRetail) : Number(i.product.prices?.[0]?.priceRetail || i.product.price || 0),
                            sku: i.product.sku
                        };
                    }),
                    userId
                );

                let pricedIdx = 0;
                return {
                    id: s.id, type: s.type, sort_order: s.sortOrder, title: s.displayTitle, subtitle: s.subtitle, cta_label: s.ctaLabel, cta_link: s.ctaLink, styles: s.styles,
                    items: (s.items || []).filter((i: any) => i.product || i.customLink || i.customTitle).map((i: any) => {
                        if (i.product) {
                            const p = priced[pricedIdx++];
                            return {
                                id: i.product.id, name: i.product.name, image: i.product.imageUrl || '',
                                price: p.finalPrice,
                                originalPrice: p.basePrice !== p.finalPrice ? p.basePrice : undefined,
                                currency: 'PKR', slug: i.product.slug, link: `/en/products/${i.product.slug || i.product.id}`, is_featured_large: i.isFeaturedLarge
                            };
                        }
                        return {
                            id: i.id, name: i.customTitle || 'Unnamed', image: i.customImage || '',
                            price: 0, currency: 'PKR', link: i.customLink || '#', is_featured_large: i.isFeaturedLarge
                        };
                    })
                };
            }));

            const result = { 
                homepage_sections: pricedSections,
                cms_data: cmsPage ? (cmsPage.contentJson || JSON.parse(cmsPage.content || '{}')) : null
            };

            return reply.send(createResponse(result));
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Internal Server Error'));
        }
    });

    // 2. GET /api/shop/categories (Hierarchical & Sorted)
    fastify.get('/shop/categories', {
        schema: {
            description: 'Get all categories in hierarchical order',
            tags: ['Public Shop'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                categories: { type: 'array', items: { type: 'object', additionalProperties: true } }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    }
                }
            }
        },
        handler: async (request, reply) => {
            const cacheKey = 'shop:categories:hierarchy';
            try {
                const cached = await fastify.cache.get(cacheKey);
                if (cached) {
                    reply.header('X-Cache', 'HIT');
                    return reply.send(createResponse({ categories: cached }));
                }

                const categories = await (fastify.prisma as any).category.findMany({
                        where: { isActive: true, deletedAt: null },
                        select: { id: true, name: true, slug: true, imageUrl: true, parentId: true },
                        orderBy: { position: 'asc' }
                    });

                const hierarchy = ((cats: any[]) => {
                    const categoryMap = new Map(cats.map(c => [c.id, { ...c, subCategories: [] }]));
                    const rootCategories: any[] = [];
                    cats.forEach(c => {
                        if (c.parentId && categoryMap.has(c.parentId)) {
                            categoryMap.get(c.parentId).subCategories.push(categoryMap.get(c.id));
                        } else if (!c.parentId) {
                            rootCategories.push(categoryMap.get(c.id));
                        }
                    });
                    return rootCategories;
                })(categories);

                await fastify.cache.set(cacheKey, hierarchy, 3600);
                reply.header('X-Cache', 'MISS');
                return reply.send(createResponse({ categories: hierarchy }));
            } catch (err) {
                fastify.log.error(err);
                return reply.status(500).send(createErrorResponse('Internal Server Error'));
            }
        }
    });

    // 3. GET /api/shop/products
    fastify.get('/shop/products', {
        schema: {
            description: 'Public product search and discovery',
            tags: ['Public Shop'],
            querystring: {
                type: 'object',
                properties: {
                    q: { type: 'string' },
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 12 },
                    sort: { type: 'string', enum: ['price_asc', 'price_desc', 'newest', 'alphabetical', 'featured', 'best_seller'] },
                    price_min: { type: 'number', description: 'Minimum price filter' },
                    price_max: { type: 'number', description: 'Maximum price filter' },
                    groupNo: { type: 'string', description: 'Filter by Group Number' },
                    brand: { type: 'string', description: 'Filter by Brand Slug' },
                    industry: { type: 'string', description: 'Filter by Industry Slug' },
                    availability: { type: 'string', enum: ['in_stock', 'out_of_stock'] }
                }
            },
            response: {
                200: { type: 'object', additionalProperties: true },
                500: { type: 'object', additionalProperties: true }
            }
        }
    }, async (request: any, reply: any) => {
        const userId = (request.user as any)?.id || 'guest';
        // Create a stable cache key based on sorted query parameters
        const queryKey = Object.keys(request.query).sort().reduce((acc, key) => {
            acc[key] = request.query[key];
            return acc;
        }, {} as any);
        const cacheKey = `shop:products:${userId}:${JSON.stringify(queryKey)}`;

        try {
            const cached = await fastify.cache.get(cacheKey);
            if (cached) {
                reply.header('X-Cache', 'HIT');
                return reply.send(createResponse(cached));
            }

            const { q, page, limit, sort, price_min, price_max, groupNo, category, brand, industry, availability } = request.query;
            const skip = (page - 1) * limit;

            const where: any = {
                AND: [
                    { isActive: true },
                    { isVisibleOnEcommerce: true },
                    { deletedAt: null },
                    { parentId: null },
                    { category: { isActive: true, deletedAt: null } },
                    { brand: { isActive: true, deletedAt: null } },
                    {
                        OR: [
                            { industries: { none: {} } },
                            { industries: { some: { industry: { isActive: true, deletedAt: null } } } }
                        ]
                    }
                ]
            };

            // Availability (Status) Filter
            if (availability === 'in_stock') {
                where.AND.push({
                    OR: [
                        { specifications: { path: ['status'], equals: 'Active' } },
                        { specifications: { path: ['status'], equals: null } },
                        { specifications: { equals: null } }
                    ]
                });
            } else if (availability === 'out_of_stock') {
                where.AND.push({
                    specifications: { path: ['status'], equals: 'Out of Stock' }
                });
            }

            if (q) {
                // Check if q matches a category name exactly
                const matchingCategory = await (fastify.prisma as any).category.findFirst({
                    where: { name: { equals: q, mode: 'insensitive' }, isActive: true, deletedAt: null },
                    select: { id: true, slug: true }
                });

                if (matchingCategory) {
                    // If it matches a category, restrict results to that category only
                    where.AND.push({
                        category: {
                            OR: [
                                { id: matchingCategory.id },
                                { slug: matchingCategory.slug }
                            ]
                        }
                    });
                } else {
                    // Otherwise do general search including category name
                    where.AND.push({
                        OR: [
                            { name: { contains: q, mode: 'insensitive' } },
                            { sku: { contains: q, mode: 'insensitive' } },
                            { specifications: { path: ['partNo'], string_contains: q } },
                            { category: { name: { contains: q, mode: 'insensitive' } } }
                        ]
                    });
                }
            }

            if (groupNo) {
                where.groupNumber = groupNo;
            }

            // Helper to handle single or array input for multi-select, including comma-separated strings
            const ensureArray = (val: any) => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string' && val.includes(',')) return val.split(',');
                return [val];
            };

            if (category) {
                const categories = ensureArray(category);
                where.AND.push({
                    category: {
                        OR: categories.map((cat: string) => ({
                            OR: [
                                { id: cat },
                                { slug: cat },
                                { name: { equals: cat, mode: 'insensitive' } }
                            ]
                        }))
                    }
                });
            }

            if (brand) {
                const brands = ensureArray(brand);
                where.AND.push({
                    brand: {
                        OR: brands.map((b: string) => ({
                            OR: [
                                { id: b },
                                { slug: b },
                                { name: { equals: b, mode: 'insensitive' } }
                            ]
                        }))
                    }
                });
            }

            if (industry) {
                const industries = ensureArray(industry);
                where.AND.push({
                    industries: {
                        some: {
                            industry: {
                                OR: industries.map((ind: string) => ({
                                    OR: [
                                        { id: ind },
                                        { slug: ind },
                                        { name: { equals: ind, mode: 'insensitive' } }
                                    ]
                                }))
                            }
                        }
                    }
                });
            }

            if (price_min || price_max) {
                 where.prices = {
                    some: {
                        priceRetail: {
                            gte: price_min ? parseFloat(price_min) : undefined,
                            lte: price_max ? parseFloat(price_max) : undefined
                        }
                    }
                 };
            }

            // Build sort logic
            let orderBy: any;
            switch (sort) {
                case 'price_asc':
                    orderBy = { price: 'asc' };
                    break;
                case 'price_desc':
                    orderBy = { price: 'desc' };
                    break;
                case 'alphabetical':
                    orderBy = { name: 'asc' };
                    break;
                case 'featured':
                    orderBy = { isFeatured: 'desc' };
                    break;
                case 'best_seller':
                    orderBy = { orderItems: { _count: 'desc' } };
                    break;
                case 'newest':
                default:
                    orderBy = { createdAt: 'desc' };
                    break;
            }

            const [products, total, totalCategories, totalBrands, totalIndustries] = await Promise.all([
                (fastify.prisma as any).product.findMany({
                    where,
                    include: {
                        category: true,
                        brand: true,
                        stocks: true, 
                        prices: { include: { currency: true } },
                        industries: { include: { industry: true } }
                    },
                    skip,
                    take: limit,
                    orderBy
                }).then(async (prods: any[]) => {
                    const userId = (request.user as any)?.id;
                    if (!userId) return prods.map((p: any) => {
                        const pkr = p.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                        const basePrice = pkr ? Number(pkr.priceRetail) : Number(p.prices?.[0]?.priceRetail || p.price || 0);
                        return { ...p, price: basePrice };
                    });

                    const priced = await PricingEngine.calculateBulkPrices(
                        fastify.prisma as any,
                        prods.map((p: any) => {
                            const pkr = p.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                            return {
                                productId: p.id,
                                basePrice: pkr ? Number(pkr.priceRetail) : Number(p.prices?.[0]?.priceRetail || p.price || 0),
                                sku: p.sku
                            };
                        }),
                        userId
                    );

                    return prods.map((p: any, idx: number) => ({
                        ...p,
                        originalPrice: priced[idx].basePrice !== priced[idx].finalPrice ? priced[idx].basePrice : undefined,
                        price: priced[idx].finalPrice
                    }));
                }),
                (fastify.prisma as any).product.count({ where }),
                (fastify.prisma as any).category.findMany({ 
                    where: { isActive: true, deletedAt: null }, 
                    select: { id: true, name: true, slug: true, imageUrl: true, parentId: true },
                    orderBy: { name: 'asc' }
                }),
                (fastify.prisma as any).brand.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true, logoUrl: true }, orderBy: { name: 'asc' } }),
                (fastify.prisma as any).industry.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true, logoUrl: true }, orderBy: { name: 'asc' } })
            ]);

            const result = {
                metadata: {
                    total_results: total,
                    categories: ((categories: any[]) => {
                        const categoryMap = new Map(categories.map(c => [c.id, { ...c, subCategories: [] }]));
                        const rootCategories: any[] = [];
                        
                        categories.forEach(c => {
                            if (c.parentId && categoryMap.has(c.parentId)) {
                                categoryMap.get(c.parentId).subCategories.push(categoryMap.get(c.id));
                            } else if (!c.parentId) {
                                rootCategories.push(categoryMap.get(c.id));
                            }
                        });
                        return rootCategories;
                    })(totalCategories),
                    brands: totalBrands.map((b: any) => ({ ...b, imageUrl: b.logoUrl })), // Map logoUrl to imageUrl for consistency
                    industries: totalIndustries.map((i: any) => ({ ...i, imageUrl: i.logoUrl })) // Map logoUrl to imageUrl
                },
                products: products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    partNumber: (p.specifications as any)?.partNo || p.sku,
                    sku: p.sku,
                    price: p.price,
                    originalPrice: p.originalPrice,
                    currency: 'PKR',
                    image_url: p.imageUrl,
                    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
                    brand: p.brand ? { id: p.brand.id, name: p.brand.name, slug: p.brand.slug } : null,
                    industries: p.industries?.map((i: any) => ({ id: i.industry.id, name: i.industry.name })) || [],
                    totalStock: Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
                    tags: [p.category?.name, p.brand?.name, ...(p.industries?.map((i: any) => i.industry.name) || [])].filter(Boolean)
                })),
                pagination: {
                    current_page: page,
                    next_page: page + 1,
                    has_more: skip + limit < total
                }
            };

            await fastify.cache.set(cacheKey, result, 600); // Cache for 10 minutes
            reply.header('X-Cache', 'MISS');
            return reply.send(createResponse(result));
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Internal Server Error'));
        }
    });

    // 3. GET /api/shop/product/:id
    fastify.get('/shop/product/:id', {
      schema: {
        description: 'Get public product details (masked)',
        tags: ['Public Shop'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
            200: { type: 'object', additionalProperties: true },
            404: { type: 'object', additionalProperties: true },
            500: { type: 'object', additionalProperties: true }
        }
      }
    }, async (request: any, reply: any) => {
        const { id } = request.params;
        try {
            const product = await (fastify.prisma as any).product.findFirst({
                where: { 
                    id, 
                    isActive: true, 
                    isVisibleOnEcommerce: true, 
                    deletedAt: null,
                    category: { isActive: true, deletedAt: null },
                    AND: [
                        { brand: { isActive: true, deletedAt: null } },
                        {
                            OR: [
                                { industries: { none: {} } },
                                { industries: { some: { industry: { isActive: true, deletedAt: null } } } }
                            ]
                        }
                    ]
                },
                include: {
                    category: true,
                    brand: true,
                    stocks: true,
                    prices: { include: { currency: true } },
                    variants: {
                        include: {
                            prices: { include: { currency: true } },
                            stocks: true
                        }
                    }
                }
            });

            if (!product) return reply.status(404).send(createErrorResponse('Product not found'));

            const userId = (request.user as any)?.id;
            const basePrice = (() => {
                const pkr = product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                return pkr ? Number(pkr.priceRetail) : Number(product.prices?.[0]?.priceRetail || product.price || 0);
            })();
            const finalPrice = await PricingEngine.calculatePrice(fastify.prisma as any, product.id, basePrice, userId, product.sku);

            return reply.send(createResponse({
                id: product.id,
                name: product.name,
                description: product.description,
                fullDescription: product.fullDescription,
                partNumber: (product.specifications as any)?.partNo || product.sku,
                sku: product.sku,
                groupNumber: product.groupNumber,
                price: finalPrice,
                originalPrice: basePrice !== finalPrice ? basePrice : undefined,
                currency: 'PKR',
                image_url: product.imageUrl,
                images: product.images,
                category: product.category?.name,
                brand: product.brand?.name,
                totalStock: Math.max(0, product.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
                // Dimensions
                width: product.width,
                length: product.length,
                weight: product.weight,
                volume: product.volume,
                specifications: product.specifications || {},
                variantOptions: product.variantOptions,
                variantAttributes: product.variantAttributes,
                variants: await Promise.all((product.variants || []).map(async (v: any) => {
                    const vPkr = v.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                    const vBase = vPkr ? Number(vPkr.priceRetail) : Number(v.price || 0);
                    const vFinal = await PricingEngine.calculatePrice(fastify.prisma as any, v.id, vBase, userId, v.sku);
                    
                    return {
                        id: v.id,
                        name: v.name,
                        sku: v.sku,
                        price: vFinal,
                        originalPrice: vBase !== vFinal ? vBase : undefined,
                        currency: 'PKR',
                        image_url: v.imageUrl,
                        totalStock: Math.max(0, v.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
                        variantAttributes: v.variantAttributes
                    };
                }))
            }));
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Internal Server Error'));
        }
    });

    // 4. GET /api/shop/product-by-slug/:slug
    fastify.get('/shop/product-by-slug/:slug', {
      schema: {
        description: 'Get public product details by slug',
        tags: ['Public Shop'],
        params: { type: 'object', properties: { slug: { type: 'string' } } },
        response: {
            200: { type: 'object', additionalProperties: true },
            404: { type: 'object', additionalProperties: true },
            500: { type: 'object', additionalProperties: true }
        }
      }
    }, async (request: any, reply: any) => {
        const { slug } = request.params;
        const userId = (request.user as any)?.id;
        const cacheKey = `product:${slug}:${userId || 'guest'}`;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        
        try {
            const cached = await fastify.cache.get(cacheKey);
            if (cached) {
                reply.header('X-Cache', 'HIT');
                return reply.send(createResponse(cached));
            }

            const product = await (fastify.prisma as any).product.findFirst({
                where: { 
                    isActive: true, 
                    isVisibleOnEcommerce: true, 
                    deletedAt: null,
                    category: { isActive: true, deletedAt: null },
                    AND: [
                        { brand: { isActive: true, deletedAt: null } },
                        {
                            OR: [
                                { industries: { none: {} } },
                                { industries: { some: { industry: { isActive: true, deletedAt: null } } } }
                            ]
                        },
                        {
                            OR: [
                                { slug },
                                ...(isUUID ? [{ id: slug }] : [])
                            ]
                        }
                    ]
                },
                include: {
                    category: true,
                    brand: true,
                    stocks: true,
                    prices: { include: { currency: true } },
                    variants: {
                        include: {
                            prices: { include: { currency: true } },
                            stocks: true
                        }
                    }
                }
            });

            if (!product) return reply.status(404).send(createErrorResponse('Product not found'));
            
            const basePrice = (() => {
                const pkr = product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                return pkr ? Number(pkr.priceRetail) : Number(product.prices?.[0]?.priceRetail || product.price || 0);
            })();
            const finalPrice = await PricingEngine.calculatePrice(fastify.prisma as any, product.id, basePrice, userId, product.sku);
            
            const result = {
                id: product.id,
                name: product.name,
                slug: product.slug,
                description: product.description,
                fullDescription: product.fullDescription,
                partNumber: (product.specifications as any)?.partNo || product.sku,
                sku: product.sku,
                groupNumber: product.groupNumber,
                price: finalPrice,
                originalPrice: basePrice !== finalPrice ? basePrice : undefined,
                currency: 'PKR',
                image_url: product.imageUrl,
                images: product.images,
                category: product.category?.name,
                brand: product.brand?.name,
                totalStock: Math.max(0, product.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
                width: product.width,
                length: product.length,
                weight: product.weight,
                volume: product.volume,
                variantOptions: product.variantOptions,
                variantAttributes: product.variantAttributes,
                variants: await Promise.all((product.variants || []).map(async (v: any) => {
                    const vPkr = v.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                    const vBase = vPkr ? Number(vPkr.priceRetail) : Number(v.price || 0);
                    const vFinal = await PricingEngine.calculatePrice(fastify.prisma as any, v.id, vBase, userId, v.sku);

                    return {
                        id: v.id,
                        name: v.name,
                        sku: v.sku,
                        price: vFinal,
                        originalPrice: vBase !== vFinal ? vBase : undefined,
                        currency: 'PKR',
                        image_url: v.imageUrl,
                        totalStock: Math.max(0, v.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
                        variantAttributes: v.variantAttributes
                    };
                })),
                seo: (() => {
                    // If product has manual SEO from CMS, use it
                    const manualSeo = product.seo as any;
                    if (manualSeo && (manualSeo.title || manualSeo.description)) {
                        return {
                            title: manualSeo.title || `${product.name} | ${product.brand?.name || ''} - Paperland`,
                        description: manualSeo.description || '',
                        keywords: manualSeo.keywords || '',
                        ogImage: manualSeo.ogImage || product.imageUrl || ''
                    };
                }
                // Auto-generate SEO meta from product data
                const brandName = product.brand?.name || '';
                const categoryName = product.category?.name || '';
                const partNo = (product.specifications as any)?.partNo || product.sku || '';
                const specs = product.specifications as any;
                
                // Build description from available specs
                const descParts = [`${product.name}`];
                if (brandName) descParts.push(`by ${brandName}`);
                if (categoryName) descParts.push(`- ${categoryName}`);
                if (specs?.outerDiameter) descParts.push(`OD: ${specs.outerDiameter}`);
                if (specs?.innerDiameter) descParts.push(`ID: ${specs.innerDiameter}`);
                if (specs?.length) descParts.push(`Length: ${specs.length}`);
                descParts.push('| Buy online at Paperland with fast delivery across Pakistan.');
                
                // Build keywords
                const keywordParts = [product.name, brandName, categoryName, partNo, product.sku].filter(Boolean);
                if (product.groupNumber) keywordParts.push(product.groupNumber);
                
                return {
                    title: `${product.name} | ${brandName} ${categoryName} - Paperland`.trim().replace(/\s+/g, ' '),
                    description: descParts.join(' ').substring(0, 160),
                    keywords: keywordParts.join(', '),
                    ogImage: product.imageUrl || ''
                };
            })()
        };

        await fastify.cache.set(cacheKey, result, 86400); // 24 hours
        reply.header('X-Cache', 'MISS');
        return reply.send(createResponse(result));
    } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
});

    // 5. GET /api/shop/products/:productId/reviews
    fastify.get('/shop/products/:productId/reviews', {
        schema: {
            description: 'Get public reviews for a product',
            tags: ['Public Shop'],
            params: { type: 'object', properties: { productId: { type: 'string' } } },
            response: {
                200: { type: 'object', additionalProperties: true },
                500: { type: 'object', additionalProperties: true }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { productId } = request.params;
            const reviews = await (fastify.prisma as any).review.findMany({
                where: { productId, deletedAt: null },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    customerName: true,
                    customerLocation: true,
                    customerImageUrl: true,
                    isVerified: true,
                    createdAt: true,
                    user: {
                        select: {
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return reply.send(createResponse(reviews));
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });
}
