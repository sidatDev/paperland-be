
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
                                        where: { 
                                            isActive: true, 
                                            isVisibleOnEcommerce: true, 
                                            deletedAt: null,
                                            parentId: null // Ensure only parent products are featured
                                        },
                                        include: { 
                                            prices: { include: { currency: true } },
                                            stocks: true,
                                            reviews: {
                                                where: { status: 'APPROVED' },
                                                select: { rating: true }
                                            }
                                        }
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
                    const [popularProducts, latestProducts, premiumProducts] = await Promise.all([
                        (fastify.prisma as any).product.findMany({
                            where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null, parentId: null },
                            take: 10,
                            include: { prices: { include: { currency: true } }, stocks: true, reviews: { where: { status: 'APPROVED' }, select: { rating: true } } }
                        }),
                        (fastify.prisma as any).product.findMany({
                            where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null, parentId: null },
                            take: 10,
                            orderBy: { createdAt: 'desc' }, // Latest Arrivals
                            include: { prices: { include: { currency: true } }, stocks: true, reviews: { where: { status: 'APPROVED' }, select: { rating: true } } }
                        }),
                        (fastify.prisma as any).product.findMany({
                            where: { isActive: true, isVisibleOnEcommerce: true, deletedAt: null, parentId: null },
                            take: 10,
                            orderBy: { updatedAt: 'desc' },
                            include: { prices: { include: { currency: true } }, stocks: true, reviews: { where: { status: 'APPROVED' }, select: { rating: true } } }
                        })
                    ]);

                    if (!hasCategories) {
                        const productsForCategories = await (fastify.prisma as any).product.findMany({
                            where: { 
                                name: { in: ['Dollar Premium A4 Paper 80gsm', 'Pelikan Fountain Pen', 'Deli Stapler', 'Faber-Castell Pencils'] }, 
                                isActive: true, 
                                deletedAt: null,
                                parentId: null // Suppression
                            },
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
                    if (!hasBestSellers && popularProducts.length > 0) {
                        s.push({ id: 'bestsellers-auto', type: 'bestsellers', sortOrder: 3, displayTitle: 'Our Best Sellers', subtitle: 'OUR COLLECTIONS', items: popularProducts.map((p: any) => ({ id: p.id, product: p })) });
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
                            currency: 'PKR', slug: i.product?.slug, link: i.customLink || (i.product ? `/en/products/${i.product.slug || i.product.id}` : '#'), is_featured_large: i.isFeaturedLarge,
                            totalStock: i.product ? (() => {
                                if (i.product.status === 'Out of Stock' || (i.product.specifications as any)?.status === 'Out of Stock') return 0;
                                return Math.max(0, i.product.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0);
                            })() : undefined,
                            rating: i.product?.reviews?.length > 0 
                                ? (i.product.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / i.product.reviews.length) 
                                : 0,
                            reviewsCount: i.product?.reviews?.length || 0
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
                                currency: 'PKR', slug: i.product.slug, link: `/en/products/${i.product.slug || i.product.id}`, is_featured_large: i.isFeaturedLarge,
                                totalStock: (() => {
                                    if (i.product.status === 'Out of Stock' || (i.product.specifications as any)?.status === 'Out of Stock') return 0;
                                    return Math.max(0, (i.product.stocks || []).reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0);
                                })(),
                                rating: i.product.reviews?.length > 0 
                                    ? (i.product.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / i.product.reviews.length) 
                                    : 0,
                                reviewsCount: i.product.reviews?.length || 0
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
                        select: { 
                            id: true, 
                            name: true, 
                            slug: true, 
                            imageUrl: true, 
                            parentId: true,
                            _count: {
                                select: { products: { where: { isActive: true, deletedAt: null, isVisibleOnEcommerce: true, parentId: null } } }
                            }
                        },
                        orderBy: { position: 'asc' }
                    });

                const hierarchy = ((cats: any[]) => {
                    const categoryMap = new Map(cats.map(c => [c.id, { ...c, productsCount: c._count?.products || 0, subCategories: [] }]));
                    const rootCategories: any[] = [];
                    
                    cats.forEach(c => {
                        const node = categoryMap.get(c.id);
                        if (c.parentId && categoryMap.has(c.parentId)) {
                            categoryMap.get(c.parentId).subCategories.push(node);
                        } else if (!c.parentId) {
                            rootCategories.push(node);
                        }
                    });

                    const pruneEmpty = (nodes: any[]) => {
                        return nodes.filter(node => {
                            node.subCategories = pruneEmpty(node.subCategories);
                            return node.productsCount > 0 || node.subCategories.length > 0;
                        });
                    };

                    return pruneEmpty(rootCategories);
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

            // Fetch user's catalogs for filtering if logged in
            let catalogIds: string[] = [];
            if (userId && userId !== 'guest') {
                const user = await (fastify.prisma as any).user.findUnique({
                    where: { id: userId },
                    select: {
                        company: {
                            select: {
                                catalogs: {
                                    where: {
                                        catalog: {
                                            isActive: true,
                                            deletedAt: null,
                                            OR: [
                                                { validFrom: null, validUntil: null },
                                                {
                                                    validFrom: { lte: new Date() },
                                                    validUntil: { gte: new Date() }
                                                }
                                            ]
                                        }
                                    },
                                    select: { catalogId: true }
                                }
                            }
                        }
                    }
                });
                if (user?.company?.catalogs) {
                    catalogIds = user.company.catalogs.map((c: any) => c.catalogId);
                }
            }

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

            // Catalog Visibility Filter for B2B Users
            if (catalogIds.length > 0) {
                where.AND.push({
                    catalogProducts: {
                        some: {
                            catalogId: { in: catalogIds }
                        }
                    }
                });
            }

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
                    // Recursive subcategories for matching category
                    let categoryIds = [matchingCategory.id];
                    let currentParentIds = [matchingCategory.id];
                    for (let i = 0; i < 5 && currentParentIds.length > 0; i++) {
                        const children = await (fastify.prisma as any).category.findMany({
                            where: { parentId: { in: currentParentIds }, deletedAt: null },
                            select: { id: true }
                        });
                        currentParentIds = children.map((c: any) => c.id);
                        categoryIds = [...categoryIds, ...currentParentIds];
                    }

                    // If it matches a category, restrict results to that category and its descendants
                    where.AND.push({
                        categoryId: { in: categoryIds }
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
                const categoryParams = ensureArray(category);
                
                // Find initial categories to get their IDs
                const initialCategories = await (fastify.prisma as any).category.findMany({
                    where: {
                        OR: categoryParams.map((c: string) => ({
                            OR: [
                                { id: c },
                                { slug: c },
                                { name: { equals: c, mode: 'insensitive' } }
                            ]
                        }))
                    },
                    select: { id: true }
                });
                
                let allCategoryIds = initialCategories.map((c: any) => c.id);
                let currentParentIds = [...allCategoryIds];
                
                // Iterative approach for descendants (up to depth 5)
                for (let i = 0; i < 5 && currentParentIds.length > 0; i++) {
                    const children = await (fastify.prisma as any).category.findMany({
                        where: { parentId: { in: currentParentIds }, deletedAt: null },
                        select: { id: true }
                    });
                    currentParentIds = children.map((c: any) => c.id);
                    allCategoryIds = [...allCategoryIds, ...currentParentIds];
                }

                where.AND.push({
                    categoryId: { in: allCategoryIds }
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
                    orderBy = [{ price: 'asc' }, { name: 'asc' }];
                    break;
                case 'price_desc':
                    orderBy = [{ price: 'desc' }, { name: 'asc' }];
                    break;
                case 'alphabetical':
                    orderBy = { name: 'asc' };
                    break;
                case 'featured':
                    orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
                    break;
                case 'best_seller':
                    orderBy = [{ orderItems: { _count: 'desc' } }, { name: 'asc' }];
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
                        industries: { include: { industry: true } },
                        reviews: {
                            where: { status: 'APPROVED' },
                            select: { rating: true }
                        }
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
                        price: priced[idx].finalPrice,
                        totalStock: (() => {
                            if (p.status === 'Out of Stock' || (p.specifications as any)?.status === 'Out of Stock') return 0;
                            return Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0);
                        })(),
                        rating: p.reviews?.length > 0 
                            ? (p.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / p.reviews.length) 
                            : 0,
                        reviewsCount: p.reviews?.length || 0
                    }));
                }),
                (fastify.prisma as any).product.count({ where }),
                (fastify.prisma as any).category.findMany({ 
                    where: { 
                        isActive: true, 
                        deletedAt: null 
                    }, 
                    select: { 
                        id: true, 
                        name: true, 
                        slug: true, 
                        imageUrl: true, 
                        parentId: true,
                        _count: {
                            select: { products: { where: { isActive: true, deletedAt: null, isVisibleOnEcommerce: true, parentId: null } } }
                        }
                    },
                    orderBy: { name: 'asc' }
                }),
                (fastify.prisma as any).brand.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true, logoUrl: true }, orderBy: { name: 'asc' } }),
                (fastify.prisma as any).industry.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true, slug: true, logoUrl: true }, orderBy: { name: 'asc' } })
            ]);

            const result = {
                metadata: {
                    total_results: total,
                    categories: ((categories: any[]) => {
                        const categoryMap = new Map(categories.map(c => [c.id, { ...c, productsCount: c._count?.products || 0, subCategories: [] }]));
                        const rootCategories: any[] = [];
                        
                        categories.forEach(c => {
                            const node = categoryMap.get(c.id);
                            if (c.parentId && categoryMap.has(c.parentId)) {
                                categoryMap.get(c.parentId).subCategories.push(node);
                            } else if (!c.parentId) {
                                rootCategories.push(node);
                            }
                        });

                        const pruneEmpty = (nodes: any[]) => {
                            return nodes.filter(node => {
                                node.subCategories = pruneEmpty(node.subCategories);
                                return node.productsCount > 0 || node.subCategories.length > 0;
                            });
                        };

                        return pruneEmpty(rootCategories);
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
                    rating: p.rating || 0,
                    reviewsCount: p.reviewsCount || 0,
                    tags: [p.category?.name, p.brand?.name, ...(p.industries?.map((i: any) => i.industry.name) || [])].filter(Boolean)
                })),
                pagination: {
                    current_page: page,
                    next_page: page + 1,
                    has_more: skip + limit < total
                }
            };

            await fastify.cache.set(cacheKey, result, 60); // Cache for 60 seconds
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
        description: 'Get public product details by ID',
        tags: ['Public Shop'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        response: {
            200: { type: 'object', additionalProperties: true },
            404: { type: 'object', additionalProperties: true },
            500: { type: 'object', additionalProperties: true }
        }
      }
    }, async (request: any, reply: any) => {
        try {
            const { id } = request.params;
            const userId = (request.user as any)?.id;

            // Fetch user's catalogs for filtering if logged in
            let catalogIds: string[] = [];
            if (userId) {
                const user = await (fastify.prisma as any).user.findUnique({
                    where: { id: userId },
                    select: {
                        company: {
                            select: {
                                catalogs: {
                                    where: {
                                        catalog: {
                                            isActive: true,
                                            deletedAt: null,
                                            OR: [
                                                { validFrom: null, validUntil: null },
                                                {
                                                    validFrom: { lte: new Date() },
                                                    validUntil: { gte: new Date() }
                                                }
                                            ]
                                        }
                                    },
                                    select: { catalogId: true }
                                }
                            }
                        }
                    }
                });
                if (user?.company?.catalogs) {
                    catalogIds = user.company.catalogs.map((c: any) => c.catalogId);
                }
            }

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
                        },
                        catalogIds.length > 0 ? {
                            catalogProducts: {
                                some: {
                                    catalogId: { in: catalogIds }
                                }
                            }
                        } : {}
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
                    },
                    catalogVariants: true,
                    reviews: {
                        where: { status: 'APPROVED' },
                        select: { rating: true }
                    }
                }
            });

            if (!product) return reply.status(404).send(createErrorResponse('Product not found'));

            const currentUserId = (request.user as any)?.id;
            const basePrice = (() => {
                const pkr = product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                return pkr ? Number(pkr.priceRetail) : Number(product.prices?.[0]?.priceRetail || product.price || 0);
            })();
            const finalPrice = await PricingEngine.calculatePrice(fastify.prisma as any, product.id, basePrice, currentUserId, product.sku);

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
                rating: product.reviews?.length > 0 
                    ? (product.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / product.reviews.length) 
                    : 0,
                reviewsCount: product.reviews?.length || 0,
                // Dimensions
                width: product.width,
                length: product.length,
                weight: product.weight,
                volume: product.volume,
                specifications: product.specifications || {},
                variantOptions: product.variantOptions,
                variantAttributes: product.variantAttributes,
                variants: await Promise.all((product.variants || [])
                    .filter((v: any) => {
                        if (catalogIds.length === 0) return true;
                        // For B2B with catalogs, variants must also be in the catalog
                        return product.catalogVariants?.some((cv: any) => cv.variantId === v.id && catalogIds.includes(cv.catalogId));
                    })
                    .map(async (v: any) => {
                        const vPkr = v.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                        const vBase = vPkr ? Number(vPkr.priceRetail) : Number(v.price || 0);
                        const vFinal = await PricingEngine.calculatePrice(fastify.prisma as any, v.id, vBase, currentUserId, v.sku);
                        
                        // Extract MOQ if in catalog
                        let moq = 1;
                        if (catalogIds.length > 0) {
                            const catalogPricing = await (fastify.prisma as any).catalogPricing.findFirst({
                                where: {
                                    variantId: v.id,
                                    catalogId: { in: catalogIds }
                                },
                            });
                            if (catalogPricing) {
                                moq = catalogPricing.minimumQuantity;
                            }
                        }

                        return {
                            id: v.id,
                            name: v.name,
                            sku: v.sku,
                            price: vFinal,
                            originalPrice: vBase !== vFinal ? vBase : undefined,
                            currency: 'PKR',
                            image_url: v.imageUrl,
                            totalStock: Math.max(0, v.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
                            variantAttributes: v.variantAttributes,
                            minimumQuantity: moq
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
        const slug = decodeURIComponent(request.params.slug);
        const userId = (request.user as any)?.id;
        const cacheKey = `product:${slug}:${userId || 'guest'}`;
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        
        try {
            const cached = await fastify.cache.get(cacheKey);
            if (cached) {
                reply.header('X-Cache', 'HIT');
                return reply.send(createResponse(cached));
            }

            // Fetch user's catalogs for filtering if logged in
            let catalogIds: string[] = [];
            if (userId && userId !== 'guest') {
                const user = await (fastify.prisma as any).user.findUnique({
                    where: { id: userId },
                    select: {
                        company: {
                            select: {
                                catalogs: {
                                    where: {
                                        catalog: {
                                            isActive: true,
                                            deletedAt: null,
                                            OR: [
                                                { validFrom: null, validUntil: null },
                                                {
                                                    validFrom: { lte: new Date() },
                                                    validUntil: { gte: new Date() }
                                                }
                                            ]
                                        }
                                    },
                                    select: { catalogId: true }
                                }
                            }
                        }
                    }
                });
                if (user?.company?.catalogs) {
                    catalogIds = user.company.catalogs.map((c: any) => c.catalogId);
                }
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
                                { slug: { equals: slug, mode: 'insensitive' } },
                                ...(isUUID ? [{ id: slug }] : [])
                            ]
                        },
                        catalogIds.length > 0 ? {
                            catalogProducts: {
                                some: {
                                    catalogId: { in: catalogIds }
                                }
                            }
                        } : {}
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
                    },
                    catalogVariants: true,
                    reviews: {
                        where: { status: 'APPROVED' },
                        select: { rating: true }
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
                totalStock: (() => {
                    if (product.status === 'Out of Stock' || (product.specifications as any)?.status === 'Out of Stock') return 0;
                    return Math.max(0, product.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0);
                })(),
                rating: product.reviews?.length > 0 
                    ? (product.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / product.reviews.length) 
                    : 0,
                reviewsCount: product.reviews?.length || 0,
                width: product.width,
                length: product.length,
                weight: product.weight,
                volume: product.volume,
                variantOptions: product.variantOptions,
                variantAttributes: product.variantAttributes,
                variants: await Promise.all((product.variants || [])
                    .filter((v: any) => {
                        if (catalogIds.length === 0) return true;
                        // For B2B with catalogs, variants must also be in the catalog
                        return product.catalogVariants?.some((cv: any) => cv.variantId === v.id && catalogIds.includes(cv.catalogId));
                    })
                    .map(async (v: any) => {
                        const vPkr = v.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                        const vBase = vPkr ? Number(vPkr.priceRetail) : Number(v.price || 0);
                        const vFinal = await PricingEngine.calculatePrice(fastify.prisma as any, v.id, vBase, userId, v.sku);
                        
                        // Extract MOQ if in catalog
                        let moq = 1;
                        if (catalogIds.length > 0) {
                            const catalogPricing = await (fastify.prisma as any).catalogPricing.findFirst({
                                where: {
                                    variantId: v.id,
                                    catalogId: { in: catalogIds }
                                },
                                
                            });
                            if (catalogPricing) {
                                moq = catalogPricing.minimumQuantity;
                            }
                        }

                        return {
                            id: v.id,
                            name: v.name,
                            sku: v.sku,
                            price: vFinal,
                            originalPrice: vBase !== vFinal ? vBase : undefined,
                            currency: 'PKR',
                            image_url: v.imageUrl,
                            totalStock: (() => {
                                if (v.status === 'Out of Stock' || (v.specifications as any)?.status === 'Out of Stock') return 0;
                                return Math.max(0, v.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0);
                            })(),
                            variantAttributes: v.variantAttributes,
                            minimumQuantity: moq
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

    fastify.get('/shop/products/:productId/reviews', {
        schema: {
            description: 'Get public approved reviews for a product',
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

            // Find the product and all its variants to aggregate their reviews
            const product = await (fastify.prisma as any).product.findUnique({
                where: { id: productId },
                select: { id: true, variants: { select: { id: true } } }
            });

            if (!product) {
                return reply.status(404).send(createErrorResponse('Product not found'));
            }

            const productIdsToCollect = [productId, ...(product.variants?.map((v: any) => v.id) || [])];

            const reviews = await (fastify.prisma as any).review.findMany({
                where: { 
                  productId: { in: productIdsToCollect }, 
                  status: 'APPROVED',
                  deletedAt: null 
                },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    customerName: true,
                    customerLocation: true,
                    customerImageUrl: true,
                    images: true,
                    isVerified: true,
                    helpfulCount: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' }
            });

            // Calculate distribution and average
            const totalReviews = reviews.length;
            const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let sum = 0;

            reviews.forEach((r: any) => {
                sum += r.rating;
                if (distribution[r.rating as keyof typeof distribution] !== undefined) {
                    distribution[r.rating as keyof typeof distribution]++;
                }
            });

            const averageRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

            return reply.send(createResponse({
                reviews,
                summary: {
                    averageRating,
                    totalReviews,
                    distribution
                }
            }));
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });
}
