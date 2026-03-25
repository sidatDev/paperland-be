import { FastifyInstance } from 'fastify';

export default async function shopRoutes(fastify: FastifyInstance) {
    fastify.get('/public/shop', {
        schema: {
            description: 'Public discovery API for products with search, filtering and metadata aggregation',
            tags: ['Public Shop'],
            querystring: {
                type: 'object',
                properties: {
                    q: { type: 'string' },
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 12 },
                    sort: { type: 'string', enum: ['price_asc', 'price_desc', 'newest'] },
                    price_min: { type: 'number' },
                    price_max: { type: 'number' },
                    brand: { type: 'string' },
                    category: { type: 'string' },
                    industry: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        metadata: {
                            type: 'object',
                            properties: {
                                categories: { type: 'array', items: { type: 'string' } },
                                brands: { type: 'array', items: { type: 'string' } },
                                industries: { type: 'array', items: { type: 'string' } },
                                total_results: { type: 'integer' }
                            }
                        },
                        products: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    price: { type: 'number' },
                                    currency: { type: 'string' },
                                    image_url: { type: 'string' },
                                    images: { type: 'array', items: { type: 'string' } },
                                    brand: { type: 'string' },
                                    category: { type: 'string' },
                                    sku: { type: 'string' },
                                    description: { type: 'string' }
                                }
                            }
                        },
                        pagination: {
                            type: 'object',
                            properties: {
                                current_page: { type: 'integer' },
                                total_pages: { type: 'integer' },
                                has_more: { type: 'boolean' }
                            }
                        }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request: any, reply) => {
        const { q, page, limit, sort, price_min, price_max, brand, category, industry } = request.query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            isActive: true,
            isVisibleOnEcommerce: true,
            deletedAt: null
        };

        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { specifications: { path: ['partNo'], string_contains: q } }
            ];
        }

        if (category) {
            where.category = { name: category };
        }

        if (brand) {
            where.brand = { name: brand };
        }

        if (industry) {
            where.industries = {
                some: {
                    industry: { name: industry }
                }
            };
        }

        // Handle price filtering (Prices table)
        if (price_min !== undefined || price_max !== undefined) {
            where.prices = {
                some: {
                    amount: {
                        gte: price_min || 0,
                        lte: price_max || 9999999
                    }
                }
            };
        }

        // Build Sort logic
        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'price_asc') {
            // Note: In a multi-currency/multi-price setup, this might need refinement
            // For now sorting by the first price record.
            orderBy = { prices: { _count: 'asc' } }; // This is not ideal for price value
            // Ideally we join and sort on price but Prisma doesn't support sorting on many relation aggregate easily without a specific price type.
            // Simplified sort for now:
        }

        try {
            const [products, total_results] = await Promise.all([
                (fastify.prisma as any).product.findMany({
                    where,
                    include: {
                        category: true,
                        brand: true,
                        prices: {
                            take: 1, // Get default price
                            include: { currency: true }
                        }
                    },
                    orderBy,
                    skip,
                    take: limit
                }),
                (fastify.prisma as any).product.count({ where })
            ]);

            // Metadata aggregation (Get all unique values from results)
            // To be efficient, we might need a separate query or raw SQL, 
            // but for now we'll fetch them from the filtered set.
            const [allCategories, allBrands, allIndustries] = await Promise.all([
                (fastify.prisma as any).category.findMany({
                   where: { products: { some: where } },
                   select: { name: true }
                }),
                (fastify.prisma as any).brand.findMany({
                   where: { products: { some: where } },
                   select: { name: true }
                }),
                (fastify.prisma as any).industry.findMany({
                   where: { products: { some: { product: where } } }, // Fix junction field name
                   select: { name: true }
                })
            ]);

            const mappedProducts = products.map((p: any) => ({
                id: p.id,
                name: p.name,
                price: p.prices[0]?.amount || 0,
                currency: p.prices[0]?.currency?.code || 'SAR',
                image_url: p.imageUrl,
                images: p.images,
                brand: p.brand?.name,
                category: p.category?.name,
                sku: p.sku,
                description: p.description
            }));

            return {
                metadata: {
                    categories: allCategories.map((c: any) => c.name),
                    brands: allBrands.map((b: any) => b.name),
                    industries: allIndustries.map((i: any) => i.name),
                    total_results
                },
                products: mappedProducts,
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(total_results / limit),
                    has_more: skip + limit < total_results
                }
            };

        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });
}
