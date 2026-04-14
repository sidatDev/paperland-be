import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function catalogsRoutes(fastify: FastifyInstance) {
    // GET /admin/catalogs - List active catalogs
    fastify.get('/admin/catalogs', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_view')],
        schema: {
            description: 'List all active B2B catalogs',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 50 },
                    search: { type: 'string' }
                }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { page = 1, limit = 50, search } = request.query;
            const skip = (page - 1) * limit;

            const where: any = { deletedAt: null };
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const [catalogs, total] = await Promise.all([
                (fastify.prisma as any).catalog.findMany({
                    where,
                    include: {
                        _count: {
                            select: { companies: true, products: true }
                        }
                    },
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' }
                }),
                (fastify.prisma as any).catalog.count({ where })
            ]);

            return createResponse(catalogs, "Success", { page: Number(page), limit: Number(limit), total });
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch catalogs'));
        }
    });

    // GET /admin/catalogs/deleted - List deleted catalogs
    fastify.get('/admin/catalogs/deleted', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_view')],
        schema: {
            description: 'List all soft-deleted B2B catalogs',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }]
        }
    }, async (request: any, reply: any) => {
        try {
            const catalogs = await (fastify.prisma as any).catalog.findMany({
                where: { deletedAt: { not: null } },
                include: {
                    _count: {
                        select: { companies: true, products: true }
                    }
                },
                orderBy: { deletedAt: 'desc' }
            });

            return createResponse(catalogs);
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch deleted catalogs'));
        }
    });

    // GET /admin/catalogs/:id - Get catalog details
    fastify.get('/admin/catalogs/:id', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_view')],
        schema: {
            description: 'Get B2B catalog details',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { id } = request.params;
            const catalog = await (fastify.prisma as any).catalog.findUnique({
                where: { id },
                include: {
                    companies: {
                        include: { company: true }
                    },
                    products: {
                        include: { product: true }
                    },
                    pricingOverrides: true
                }
            });

            if (!catalog) return reply.status(404).send(createErrorResponse('Catalog not found'));

            return createResponse(catalog);
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch catalog details'));
        }
    });

    // POST /admin/catalogs - Create catalog
    fastify.post('/admin/catalogs', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Create a new B2B catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    isActive: { type: 'boolean', default: true },
                    validFrom: { type: 'string', format: 'date-time' },
                    validUntil: { type: 'string', format: 'date-time' }
                }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { name, description, isActive, validFrom, validUntil } = request.body;

            const catalog = await (fastify.prisma as any).catalog.create({
                data: {
                    name,
                    description,
                    isActive: isActive ?? true,
                    validFrom: validFrom ? new Date(validFrom) : null,
                    validUntil: validUntil ? new Date(validUntil) : null
                }
            });

            return createResponse(catalog, "Catalog created successfully");
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to create catalog'));
        }
    });

    // PUT /admin/catalogs/:id - Update catalog
    fastify.put('/admin/catalogs/:id', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Update B2B catalog details',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } }
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    isActive: { type: 'boolean' },
                    validFrom: { type: 'string', format: 'date-time', nullable: true },
                    validUntil: { type: 'string', format: 'date-time', nullable: true }
                }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { id } = request.params;
            const { name, description, isActive, validFrom, validUntil } = request.body;

            const existingCatalog = await (fastify.prisma as any).catalog.findUnique({ where: { id } });
            if (!existingCatalog) return reply.status(404).send(createErrorResponse('Catalog not found'));

            const catalog = await (fastify.prisma as any).catalog.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(description !== undefined && { description }),
                    ...(isActive !== undefined && { isActive }),
                    ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
                    ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null })
                }
            });

            return createResponse(catalog, 'Catalog updated successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to update catalog'));
        }
    });

    // DELETE /admin/catalogs/:id - Soft delete catalog
    fastify.delete('/admin/catalogs/:id', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Soft delete a B2B catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { id } = request.params;
            
            const existingCatalog = await (fastify.prisma as any).catalog.findUnique({ where: { id } });
            if (!existingCatalog) return reply.status(404).send(createErrorResponse('Catalog not found'));

            await (fastify.prisma as any).catalog.update({
                where: { id },
                data: { deletedAt: new Date(), isActive: false }
            });

            return createResponse(null, 'Catalog deleted successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to delete catalog'));
        }
    });

    // POST /admin/catalogs/:id/restore - Restore soft deleted catalog
    fastify.post('/admin/catalogs/:id/restore', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Restore a soft deleted B2B catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { id } = request.params;

            const existingCatalog = await (fastify.prisma as any).catalog.findUnique({ where: { id } });
            if (!existingCatalog) return reply.status(404).send(createErrorResponse('Catalog not found'));

            await (fastify.prisma as any).catalog.update({
                where: { id },
                data: { deletedAt: null, isActive: true }
            });

            return createResponse(null, 'Catalog restored successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to restore catalog'));
        }
    });

    // POST /admin/catalogs/:id/products - Link products with their variants
    fastify.post('/admin/catalogs/:id/products', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Add products and their variant pricings to a catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } }
            },
            body: {
                type: 'object',
                required: ['products'],
                properties: {
                    products: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['productId', 'variants'],
                            properties: {
                                productId: { type: 'string' },
                                variants: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        required: ['variantId', 'price', 'minimumQuantity'],
                                        properties: {
                                            variantId: { type: 'string' },
                                            price: { type: 'number' },
                                            minimumQuantity: { type: 'integer' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request: any, reply: any) => {
        const { id } = request.params;
        const { products } = request.body;

        try {
             await (fastify.prisma as any).$transaction(async (tx: any) => {
                for (const p of products) {
                    // Create catalog product link if it doesn't exist
                    await tx.catalogProduct.upsert({
                        where: {
                            catalogId_productId: {
                                catalogId: id,
                                productId: p.productId
                            }
                        },
                        create: {
                            catalogId: id,
                            productId: p.productId
                        },
                        update: {}
                    });

                    // Add rules for variants
                    for (const v of p.variants) {
                        await tx.catalogVariant.upsert({
                            where: {
                                catalogId_variantId: {
                                    catalogId: id,
                                    variantId: v.variantId
                                }
                            },
                            create: {
                                catalogId: id,
                                variantId: v.variantId
                            },
                            update: {}
                        });

                        await tx.catalogPricing.upsert({
                            where: {
                                catalogId_variantId: {
                                    catalogId: id,
                                    variantId: v.variantId
                                }
                            },
                            create: {
                                catalogId: id,
                                variantId: v.variantId,
                                customPrice: v.price,
                                minimumQuantity: v.minimumQuantity
                            },
                            update: {
                                customPrice: v.price,
                                minimumQuantity: v.minimumQuantity
                            }
                        });
                    }
                }
             }, { maxWait: 5000, timeout: 15000 });

            return createResponse(null, 'Products added to catalog successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to add products to catalog: ' + err.message));
        }
    });

    // GET /admin/companies - List companies for assignment
    fastify.get('/admin/companies', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_view')],
        schema: {
            description: 'List all companies with search',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            querystring: {
                type: 'object',
                properties: {
                    search: { type: 'string' },
                    limit: { type: 'integer', default: 20 }
                }
            }
        }
    }, async (request: any, reply: any) => {
        try {
            const { search, limit = 20 } = request.query;
            const where: any = {};
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const companies = await (fastify.prisma as any).company.findMany({
                where,
                take: limit,
                orderBy: { name: 'asc' }
            });

            return createResponse(companies);
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch companies'));
        }
    });

    // DELETE /admin/catalogs/:id/products/:productId - Remove product from catalog
    fastify.delete('/admin/catalogs/:id/products/:productId', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Remove a product and all its variant rules from a catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id', 'productId'],
                properties: { 
                    id: { type: 'string' },
                    productId: { type: 'string' }
                }
            }
        }
    }, async (request: any, reply: any) => {
        const { id, productId } = request.params;

        try {
             await (fastify.prisma as any).$transaction(async (tx: any) => {
                // Remove catalog pricing rules for variants of this product
                const productVariants = await tx.variant.findMany({
                    where: { productId },
                    select: { id: true }
                });

                const variantIds = productVariants.map((v: any) => v.id);

                if (variantIds.length > 0) {
                    await tx.catalogPricing.deleteMany({
                        where: {
                            catalogId: id,
                            variantId: { in: variantIds }
                        }
                    });

                    await tx.catalogVariant.deleteMany({
                        where: {
                            catalogId: id,
                            variantId: { in: variantIds }
                        }
                    });
                }

                // Remove catalog product link
                await tx.catalogProduct.deleteMany({
                    where: {
                        catalogId: id,
                        productId: productId
                    }
                });
             });

            return createResponse(null, 'Product removed from catalog');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to remove product from catalog'));
        }
    });
    // POST /admin/catalogs/:id/companies - Assign companies to a catalog
    fastify.post('/admin/catalogs/:id/companies', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Assign companies to a B2B catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } }
            },
            body: {
                type: 'object',
                required: ['companyIds'],
                properties: {
                    companyIds: { type: 'array', items: { type: 'string' } },
                    priority: { type: 'integer', default: 0 }
                }
            }
        }
    }, async (request: any, reply: any) => {
        const { id } = request.params;
        const { companyIds, priority = 0 } = request.body;

        try {
            await (fastify.prisma as any).$transaction(
                companyIds.map((companyId: string) => 
                    (fastify.prisma as any).companyCatalog.upsert({
                        where: {
                            companyId_catalogId: {
                                companyId,
                                catalogId: id
                            }
                        },
                        create: {
                            companyId,
                            catalogId: id,
                            priority
                        },
                        update: {
                            priority
                        }
                    })
                )
            );

            return createResponse(null, 'Companies assigned to catalog successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to assign companies: ' + err.message));
        }
    });

    // DELETE /admin/catalogs/:id/companies/:companyId - Remove company from catalog
    fastify.delete('/admin/catalogs/:id/companies/:companyId', {
        preHandler: [fastify.authenticate, fastify.hasPermission('catalog_manage')],
        schema: {
            description: 'Remove a company from a B2B catalog',
            tags: ['Admin Catalogs'],
            security: [{ bearerAuth: [] }],
            params: {
                type: 'object',
                required: ['id', 'companyId'],
                properties: { 
                    id: { type: 'string' },
                    companyId: { type: 'string' }
                }
            }
        }
    }, async (request: any, reply: any) => {
        const { id, companyId } = request.params;

        try {
            await (fastify.prisma as any).companyCatalog.delete({
                where: {
                    companyId_catalogId: {
                        companyId,
                        catalogId: id
                    }
                }
            });

            return createResponse(null, 'Company removed from catalog');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to remove company from catalog'));
        }
    });
}
