import { FastifyInstance } from 'fastify';

export default async function homepageRoutes(fastify: FastifyInstance) {
    
    // PUBLIC: Get active homepage sections
    fastify.get('/homepage/sections', {
        schema: {
            description: 'Get all active homepage sections for public landing page',
            tags: ['Public Homepage'],
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            displayTitle: { type: 'string' },
                            subtitle: { type: 'string' },
                            type: { type: 'string' },
                            sortOrder: { type: 'integer' },
                            ctaLabel: { type: 'string' },
                            ctaLink: { type: 'string' },
                            styles: { type: 'object', additionalProperties: true },
                            items: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        customTitle: { type: 'string' },
                                        customImage: { type: 'string' },
                                        customLink: { type: 'string' },
                                        isFeaturedLarge: { type: 'boolean' },
                                        product: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string' },
                                                name: { type: 'string' },
                                                imageUrl: { type: 'string' },
                                                price: { type: 'number' }
                                            },
                                            nullable: true
                                        }
                                    }
                                }
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
    }, async (request, reply) => {
        try {
            const cacheKey = 'shop:home:sections';
            const data = await fastify.cache.wrap(cacheKey, async () => {
                const sections = await (fastify.prisma as any).homepageSection.findMany({
                    where: { isActive: true },
                    include: {
                        items: {
                            include: {
                                product: {
                                    include: {
                                        prices: { take: 1 }
                                    }
                                }
                            },
                            orderBy: { sortOrder: 'asc' }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                });

                // Map to simplify for frontend
                return sections.map((s: any) => ({
                    ...s,
                    items: s.items.map((i: any) => ({
                        ...i,
                        product: i.product ? {
                            id: i.product.id,
                            name: i.product.name,
                            imageUrl: i.product.imageUrl,
                            price: i.product.prices[0]?.amount
                        } : null
                    }))
                }));
            }, 300); // 5 minutes cache

            return data;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Get all sections
    fastify.get('/admin/homepage/sections', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Get all homepage sections for admin management',
            tags: ['Admin Homepage Management'],
            response: {
                200: { type: 'array', items: { type: 'object', additionalProperties: true } },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const sections = await (fastify.prisma as any).homepageSection.findMany({
                include: { items: true },
                orderBy: { sortOrder: 'asc' }
            });
            return sections;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Create section
    fastify.post('/admin/homepage/sections', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Create a new homepage section',
            tags: ['Admin Homepage Management'],
            body: {
                type: 'object',
                required: ['internalName', 'type'],
                properties: {
                    internalName: { type: 'string' },
                    displayTitle: { type: 'string' },
                    subtitle: { type: 'string' },
                    type: { type: 'string', enum: ['GRID', 'BENTO', 'SLIDER'] },
                    ctaLink: { type: 'string' },
                    styles: { type: 'object', additionalProperties: true }
                }
            },
            response: {
                201: { type: 'object', additionalProperties: true },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request: any, reply) => {
        try {
            const lastSection = await (fastify.prisma as any).homepageSection.findFirst({
                orderBy: { sortOrder: 'desc' }
            });
            const nextOrder = (lastSection?.sortOrder || 0) + 1;

            const section = await (fastify.prisma as any).homepageSection.create({
                data: {
                    ...request.body,
                    sortOrder: nextOrder
                }
            });
            return section;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Update section
    fastify.put('/admin/homepage/sections/:id', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Update homepage section',
            tags: ['Admin Homepage Management'],
            params: { type: 'object', properties: { id: { type: 'string' } } },
            body: { type: 'object', additionalProperties: true }
        }
    }, async (request: any, reply) => {
        const { id } = request.params;
        try {
            const section = await (fastify.prisma as any).homepageSection.update({
                where: { id },
                data: request.body
            });
            return section;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Delete section
    fastify.delete('/admin/homepage/sections/:id', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Delete homepage section',
            tags: ['Admin Homepage Management'],
            params: { type: 'object', properties: { id: { type: 'string' } } }
        }
    }, async (request: any, reply) => {
        const { id } = request.params;
        try {
            await (fastify.prisma as any).homepageSection.delete({ where: { id } });
            return { success: true };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Reorder sections
    fastify.post('/admin/homepage/sections/reorder', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Reorder homepage sections',
            tags: ['Admin Homepage Management'],
            body: {
                type: 'object',
                required: ['orders'],
                properties: {
                    orders: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['id', 'sortOrder'],
                            properties: {
                                id: { type: 'string' },
                                sortOrder: { type: 'integer' }
                            }
                        }
                    }
                }
            },
            response: {
                200: { type: 'object', additionalProperties: true },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request: any, reply) => {
        const { orders } = request.body;
        try {
            for (const item of orders) {
                await (fastify.prisma as any).homepageSection.update({
                    where: { id: item.id },
                    data: { sortOrder: item.sortOrder }
                });
            }
            return { success: true };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Add items to section
    fastify.post('/admin/homepage/sections/:id/items', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Add an item (product or custom) to a homepage section',
            tags: ['Admin Homepage Management'],
            params: { type: 'object', properties: { id: { type: 'string' } } },
            body: {
                type: 'object',
                properties: {
                    productId: { type: 'string' },
                    customTitle: { type: 'string' },
                    customSubtitle: { type: 'string' },
                    customImage: { type: 'string' },
                    customDescription: { type: 'string' },
                    customLink: { type: 'string' },
                    isFeaturedLarge: { type: 'boolean', default: false },
                    isActive: { type: 'boolean', default: true },
                    sortOrder: { type: 'integer' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { id: sectionId } = request.params;
        const { productId } = request.body;

        try {
            // DUPLICATE PREVENTION: Check if product already in section
            if (productId) {
                const existing = await (fastify.prisma as any).homepageSectionItem.findFirst({
                    where: { sectionId, productId }
                });
                if (existing) {
                    return reply.status(400).send({ 
                        message: 'This product is already in this section. Multiples are not allowed.' 
                    });
                }
            }

            // Remove 'product' object if present, only 'productId' is needed for relation
            const { product, ...itemData } = request.body;

            const item = await (fastify.prisma as any).homepageSectionItem.create({
                data: {
                    ...itemData,
                    sectionId
                }
            });
            return item;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Update section item (isFeaturedLarge, sortOrder)
    fastify.put('/admin/homepage/sections/items/:itemId', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Update a specific item in a section',
            tags: ['Admin Homepage Management'],
            params: { type: 'object', properties: { itemId: { type: 'string' } } },
            body: {
                type: 'object',
                properties: {
                    customTitle: { type: 'string' },
                    customSubtitle: { type: 'string' },
                    customImage: { type: 'string' },
                    customDescription: { type: 'string' },
                    customLink: { type: 'string' },
                    isFeaturedLarge: { type: 'boolean' },
                    isActive: { type: 'boolean' },
                    sortOrder: { type: 'integer' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { itemId } = request.params;
        try {
            // Remove 'product' object if present
            const { product, ...updateData } = request.body;
            
            const item = await (fastify.prisma as any).homepageSectionItem.update({
                where: { id: itemId },
                data: updateData
            });
            return item;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Delete item from section
    fastify.delete('/admin/homepage/sections/items/:itemId', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Remove an item from a section',
            tags: ['Admin Homepage Management'],
            params: { type: 'object', properties: { itemId: { type: 'string' } } }
        }
    }, async (request: any, reply) => {
        const { itemId } = request.params;
        try {
            await (fastify.prisma as any).homepageSectionItem.delete({ where: { id: itemId } });
            return { success: true };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Reorder items within a section
    fastify.post('/admin/homepage/sections/items/reorder', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Reorder items within a homepage section',
            tags: ['Admin Homepage Management'],
            body: {
                type: 'object',
                required: ['orders'],
                properties: {
                    orders: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['id', 'sortOrder'],
                            properties: {
                                id: { type: 'string' },
                                sortOrder: { type: 'integer' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request: any, reply) => {
        const { orders } = request.body;
        try {
            for (const item of orders) {
                await (fastify.prisma as any).homepageSectionItem.update({
                    where: { id: item.id },
                    data: { sortOrder: item.sortOrder }
                });
            }
            return { success: true };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // --- HERO CONFIGURATION ENDPOINTS ---

    // PUBLIC: Get hero configuration
    fastify.get('/homepage/hero-config', {
        schema: {
            description: 'Get hero section configuration',
            tags: ['Public Homepage'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        layoutType: { type: 'string', enum: ['CAROUSEL', 'GRID'] },
                        slotAssignments: { type: 'object', additionalProperties: true }
                    }
                },
                500: {
                    type: 'object',
                    properties: { message: { type: 'string' } }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const config = await (fastify.prisma as any).homepageSection.findFirst({
                where: { internalName: 'HERO_CONFIG' }
            });
            const styles = (config?.styles || {}) as any;
            return {
                layoutType: styles.layoutType || 'CAROUSEL',
                slotAssignments: styles.slotAssignments || {}
            };
        } catch (err: any) {
            fastify.log.error(err);
            return { layoutType: 'CAROUSEL' };
        }
    });

    // ADMIN: Get hero configuration
    fastify.get('/admin/homepage/hero-config', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Get hero section configuration for admin',
            tags: ['Admin Homepage Management'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        layoutType: { type: 'string', enum: ['CAROUSEL', 'GRID'] },
                        slotAssignments: { type: 'object', additionalProperties: true }
                    }
                },
                500: {
                    type: 'object',
                    properties: { message: { type: 'string' } }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const config = await (fastify.prisma as any).homepageSection.findFirst({
                where: { internalName: 'HERO_CONFIG' }
            });
            const styles = (config?.styles || {}) as any;
            return {
                layoutType: styles.layoutType || 'CAROUSEL',
                slotAssignments: styles.slotAssignments || {}
            };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // ADMIN: Update hero configuration
    fastify.post('/admin/homepage/hero-config', {
        preHandler: [fastify.authenticate],
        schema: {
            description: 'Update hero section configuration',
            tags: ['Admin Homepage Management'],
            body: {
                type: 'object',
                required: ['layoutType'],
                properties: {
                    layoutType: { type: 'string', enum: ['CAROUSEL', 'GRID'] },
                    slotAssignments: {
                        type: 'object',
                        additionalProperties: true
                    }
                }
            }
        }
    }, async (request: any, reply) => {
        const { layoutType, slotAssignments } = request.body;
        try {
            const existing = await (fastify.prisma as any).homepageSection.findFirst({
                where: { internalName: 'HERO_CONFIG' }
            });

            const configData = { layoutType, slotAssignments: slotAssignments || {} };

            if (existing) {
                await (fastify.prisma as any).homepageSection.update({
                    where: { id: existing.id },
                    data: { styles: configData }
                });
            } else {
                await (fastify.prisma as any).homepageSection.create({
                    data: {
                        internalName: 'HERO_CONFIG',
                        type: 'CONFIG',
                        styles: configData,
                        isActive: true
                    }
                });
            }
            return { success: true, ...configData };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });

    // PUBLIC: Get homepage categories
    fastify.get('/homepage/categories', {
        schema: {
            description: 'Get all categories flagged for homepage display',
            tags: ['Public Homepage'],
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            slug: { type: 'string' },
                            homepageImage: { type: 'string', nullable: true },
                            imageUrl: { type: 'string', nullable: true }
                        }
                    }
                },
                500: { type: 'object', properties: { message: { type: 'string' } } }
            }
        }
    }, async (request, reply) => {
        try {
            const cacheKey = 'shop:home:categories';
            const categories = await fastify.cache.wrap(cacheKey, async () => {
                return await (fastify.prisma as any).category.findMany({
                    where: { 
                        isActive: true, 
                        deletedAt: null,
                        showOnHomepage: true 
                    },
                    orderBy: { homepageOrder: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        homepageImage: true,
                        imageUrl: true
                    }
                });
            }, 3600); // 1 hour cache
            return categories;
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ message: 'Internal Server Error' });
        }
    });
}
