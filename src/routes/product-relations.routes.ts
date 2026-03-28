
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function productRelationsRoutes(fastify: FastifyInstance) {

  // ═══════════════════════════════════════════════
  // ADMIN ROUTES (Authenticated)
  // ═══════════════════════════════════════════════

  // GET /api/v1/admin/products/:id/relations — Get all relations for a product
  fastify.get('/admin/products/:id/relations', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get all product relations (Related, FBT, Upsell)',
      tags: ['Product Relations'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
      const relations = await (fastify.prisma as any).productRelation.findMany({
        where: {
          OR: [
            { sourceProductId: id },
            { targetProductId: id }
          ]
        },
        include: {
          sourceProduct: {
            select: { id: true, name: true, sku: true, imageUrl: true, price: true, slug: true }
          },
          targetProduct: {
            select: { id: true, name: true, sku: true, imageUrl: true, price: true, slug: true }
          }
        },
        orderBy: [{ type: 'asc' }, { score: 'desc' }]
      });

      // Normalize: always show the "other" product relative to the queried one
      const normalized = relations.map((rel: any) => {
        const isSource = rel.sourceProductId === id;
        const relatedProduct = isSource ? rel.targetProduct : rel.sourceProduct;
        return {
          id: rel.id,
          type: rel.type,
          score: rel.score,
          isManual: rel.isManual,
          isActive: rel.isActive,
          product: relatedProduct,
          createdAt: rel.createdAt
        };
      });

      // Group by type
      const grouped = {
        related: normalized.filter((r: any) => r.type === 'RELATED'),
        fbt: normalized.filter((r: any) => r.type === 'FBT'),
        upsell: normalized.filter((r: any) => r.type === 'UPSELL'),
      };

      return createResponse(grouped, 'Relations retrieved');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch relations'));
    }
  });

  // POST /api/v1/admin/products/:id/relations — Add a relation
  fastify.post('/admin/products/:id/relations', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Add a product relation (Related, FBT, Upsell)',
      tags: ['Product Relations'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['targetProductId', 'type'],
        properties: {
          targetProductId: { type: 'string' },
          type: { type: 'string', enum: ['RELATED', 'FBT', 'UPSELL'] },
          score: { type: 'integer', default: 0 }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { targetProductId, type, score = 0 } = request.body;

    if (id === targetProductId) {
      return reply.status(400).send(createErrorResponse('Cannot create a relation with the same product'));
    }

    try {
      // Verify both products exist
      const [source, target] = await Promise.all([
        (fastify.prisma as any).product.findUnique({ where: { id }, select: { id: true } }),
        (fastify.prisma as any).product.findUnique({ where: { id: targetProductId }, select: { id: true } })
      ]);

      if (!source) return reply.status(404).send(createErrorResponse('Source product not found'));
      if (!target) return reply.status(404).send(createErrorResponse('Target product not found'));

      // Create bidirectional relation (both directions)
      const relation = await (fastify.prisma as any).productRelation.upsert({
        where: {
          sourceProductId_targetProductId_type: {
            sourceProductId: id,
            targetProductId,
            type
          }
        },
        update: { score, isManual: true, isActive: true },
        create: {
          sourceProductId: id,
          targetProductId,
          type,
          score,
          isManual: true,
          isActive: true
        },
        include: {
          targetProduct: {
            select: { id: true, name: true, sku: true, imageUrl: true, price: true }
          }
        }
      });

      // Also create the reverse relation for FBT and RELATED (bidirectional)
      if (type === 'FBT' || type === 'RELATED') {
        await (fastify.prisma as any).productRelation.upsert({
          where: {
            sourceProductId_targetProductId_type: {
              sourceProductId: targetProductId,
              targetProductId: id,
              type
            }
          },
          update: { score, isManual: true, isActive: true },
          create: {
            sourceProductId: targetProductId,
            targetProductId: id,
            type,
            score,
            isManual: true,
            isActive: true
          }
        });
      }

      return createResponse({
        id: relation.id,
        type: relation.type,
        score: relation.score,
        isManual: relation.isManual,
        isActive: relation.isActive,
        product: relation.targetProduct
      }, 'Relation added successfully');
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(409).send(createErrorResponse('This relation already exists'));
      }
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to add relation'));
    }
  });

  // PUT /api/v1/admin/products/:id/relations/:relationId — Update relation (toggle active, score)
  fastify.put('/admin/products/:id/relations/:relationId', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Update a product relation',
      tags: ['Product Relations'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          relationId: { type: 'string' }
        },
        required: ['id', 'relationId']
      },
      body: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
          score: { type: 'integer' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { relationId } = request.params;
    const { isActive, score } = request.body;

    try {
      const updateData: any = {};
      if (isActive !== undefined) updateData.isActive = isActive;
      if (score !== undefined) updateData.score = score;

      const updated = await (fastify.prisma as any).productRelation.update({
        where: { id: relationId },
        data: updateData
      });

      return createResponse(updated, 'Relation updated');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to update relation'));
    }
  });

  // DELETE /api/v1/admin/products/:id/relations/:relationId — Remove relation
  fastify.delete('/admin/products/:id/relations/:relationId', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Remove a product relation',
      tags: ['Product Relations'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          relationId: { type: 'string' }
        },
        required: ['id', 'relationId']
      }
    }
  }, async (request: any, reply) => {
    const { id, relationId } = request.params;

    try {
      const relation = await (fastify.prisma as any).productRelation.findUnique({
        where: { id: relationId }
      });

      if (!relation) {
        return reply.status(404).send(createErrorResponse('Relation not found'));
      }

      // Delete the relation
      await (fastify.prisma as any).productRelation.delete({
        where: { id: relationId }
      });

      // Also delete reverse relation if it exists (for bidirectional FBT/RELATED)
      if (relation.type === 'FBT' || relation.type === 'RELATED') {
        await (fastify.prisma as any).productRelation.deleteMany({
          where: {
            sourceProductId: relation.targetProductId,
            targetProductId: relation.sourceProductId,
            type: relation.type
          }
        });
      }

      return createResponse(null, 'Relation removed');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to remove relation'));
    }
  });

  // POST /api/v1/admin/products/relations/generate-fbt — Auto-generate FBT from order history
  fastify.post('/admin/products/relations/generate-fbt', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Auto-generate Frequently Bought Together relations from order history',
      tags: ['Product Relations'],
      body: {
        type: 'object',
        properties: {
          minCoOccurrences: { type: 'integer', default: 3, description: 'Minimum times products were bought together' },
          maxRelationsPerProduct: { type: 'integer', default: 5, description: 'Max FBT suggestions per product' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { minCoOccurrences = 3, maxRelationsPerProduct = 5 } = request.body || {};

    try {
      // Query co-purchased products from order_items
      const coOccurrences: any[] = await (fastify.prisma as any).$queryRaw`
        SELECT 
          oi1.product_id AS source_id,
          oi2.product_id AS target_id,
          COUNT(DISTINCT oi1.order_id) AS co_purchase_count
        FROM order_items oi1
        INNER JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
        INNER JOIN orders o ON oi1.order_id = o.id AND o.deleted_at IS NULL
        INNER JOIN products p1 ON oi1.product_id = p1.id AND p1.deleted_at IS NULL AND p1.is_active = true
        INNER JOIN products p2 ON oi2.product_id = p2.id AND p2.deleted_at IS NULL AND p2.is_active = true
        GROUP BY oi1.product_id, oi2.product_id
        HAVING COUNT(DISTINCT oi1.order_id) >= ${minCoOccurrences}
        ORDER BY co_purchase_count DESC
      `;

      let created = 0;
      let updated = 0;

      for (const co of coOccurrences) {
        const score = Number(co.co_purchase_count);

        // Check existing count for this source product (limit per product)
        const existingCount = await (fastify.prisma as any).productRelation.count({
          where: { sourceProductId: co.source_id, type: 'FBT' }
        });

        if (existingCount >= maxRelationsPerProduct) continue;

        // Upsert both directions
        for (const [src, tgt] of [[co.source_id, co.target_id], [co.target_id, co.source_id]]) {
          const result = await (fastify.prisma as any).productRelation.upsert({
            where: {
              sourceProductId_targetProductId_type: {
                sourceProductId: src,
                targetProductId: tgt,
                type: 'FBT'
              }
            },
            update: { score, isActive: true },
            create: {
              sourceProductId: src,
              targetProductId: tgt,
              type: 'FBT',
              score,
              isManual: false,
              isActive: true
            }
          });

          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created++;
          } else {
            updated++;
          }
        }
      }

      return createResponse({
        coOccurrencesFound: coOccurrences.length,
        relationsCreated: created,
        relationsUpdated: updated
      }, 'FBT generation complete');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('FBT generation failed: ' + err.message));
    }
  });

  // ═══════════════════════════════════════════════
  // PUBLIC SHOP ROUTES
  // ═══════════════════════════════════════════════

  // GET /api/v1/shop/products/:id/related — Public: Get related products
  fastify.get('/shop/products/:id/related', {
    schema: {
      description: 'Get related products for a product (public)',
      tags: ['Public Shop'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 8 }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { limit = 8 } = request.query;

    try {
      // 1. First try manual/auto relations
      const relations = await (fastify.prisma as any).productRelation.findMany({
        where: {
          sourceProductId: id,
          type: { in: ['RELATED', 'UPSELL'] },
          isActive: true,
          targetProduct: {
            isActive: true,
            isVisibleOnEcommerce: true,
            deletedAt: null
          }
        },
        include: {
          targetProduct: {
            include: {
              prices: { include: { currency: true } },
              stocks: true,
              brand: { select: { name: true } },
              category: { select: { name: true, slug: true } }
            }
          }
        },
        orderBy: { score: 'desc' },
        take: limit
      });

      const products = relations.map((rel: any) => {
        const p = rel.targetProduct;
        const pkr = p.prices?.find((pr: any) => pr.currency?.code === 'PKR');
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          price: pkr ? Number(pkr.priceRetail) : Number(p.price || 0),
          currency: 'PKR',
          image_url: p.imageUrl,
          brand: p.brand?.name,
          category: p.category?.name,
          totalStock: Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0)
        };
      });

      return reply.send(createResponse(true, 'Related products fetched', products));
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch related products'));
    }
  });

  // GET /api/v1/shop/products/:id/frequently-bought-together — Public: Get FBT products
  fastify.get('/shop/products/:id/frequently-bought-together', {
    schema: {
      description: 'Get frequently bought together products (public)',
      tags: ['Public Shop'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 4 }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { limit = 4 } = request.query;

    try {
      const relations = await (fastify.prisma as any).productRelation.findMany({
        where: {
          sourceProductId: id,
          type: 'FBT',
          isActive: true,
          targetProduct: {
            isActive: true,
            isVisibleOnEcommerce: true,
            deletedAt: null
          }
        },
        include: {
          targetProduct: {
            include: {
              prices: { include: { currency: true } },
              stocks: true,
              brand: { select: { name: true } }
            }
          }
        },
        orderBy: [{ isManual: 'desc' }, { score: 'desc' }], // Manual first, then by score
        take: limit
      });

      const products = relations.map((rel: any) => {
        const p = rel.targetProduct;
        const pkr = p.prices?.find((pr: any) => pr.currency?.code === 'PKR');
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          price: pkr ? Number(pkr.priceRetail) : Number(p.price || 0),
          currency: 'PKR',
          image_url: p.imageUrl,
          brand: p.brand?.name,
          totalStock: Math.max(0, p.stocks?.reduce((acc: number, s: any) => acc + (s.qty - (s.reservedQty || 0)), 0) || 0),
          isManual: rel.isManual,
          score: rel.score
        };
      });

      return reply.send(createResponse(products, 'FBT products retrieved'));
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch FBT products'));
    }
  });
}
