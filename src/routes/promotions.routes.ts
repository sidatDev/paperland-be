import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { PromotionService } from '../services/promotion.service';
import { PricingEngine } from '../utils/pricing.engine';

export default async function promotionsRoutes(fastify: FastifyInstance) {
  
  // GET /shop/promotions/banner
  fastify.get('/shop/promotions/banner', {
    schema: {
      description: 'Get active promotions flagged for homepage banner',
      tags: ['Promotions']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const now = new Date();
      const promotions = await (fastify.prisma as any).promotion.findMany({
        where: {
          isActive: true,
          showOnBanner: true,
          startDate: { lte: now },
          endDate: { gte: now }
        },
        include: {
          tiers: { orderBy: { minQuantity: 'asc' } },
          product: { select: { id: true, name: true, slug: true, imageUrl: true } }
        },
        orderBy: { priority: 'desc' }
      });
      return createResponse(promotions, "Banner promotions retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /shop/promotions/product/:productId
  fastify.get('/shop/promotions/product/:productId', {
    schema: {
      description: 'Get applicable promotions and tiers for a specific product',
      tags: ['Promotions'],
      params: {
        type: 'object',
        properties: { productId: { type: 'string' } }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productId } = request.params as any;
      
      const product = await fastify.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, categoryId: true, brandId: true }
      });

      if (!product) return reply.status(404).send(createErrorResponse("Product not found"));

      const promotions = await PromotionService.getActivePromotions(fastify.prisma as any, {
        productIds: [productId],
        categoryIds: [product.categoryId],
        brandIds: [product.brandId]
      });

      return createResponse(promotions, "Product promotions retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/promotions/check-name — Check for unique name
  fastify.get('/admin/promotions/check-name', {
    preHandler: [fastify.authenticate],
    schema: { 
      description: 'Check if internal campaign name is unique', 
      tags: ['Admin', 'Promotions'],
      querystring: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          excludeId: { type: 'string' }
        },
        required: ['name']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, excludeId } = request.query as any;
      const existing = await (fastify.prisma as any).promotion.findFirst({
        where: { 
          name: { equals: name.trim(), mode: 'insensitive' },
          id: excludeId ? { not: excludeId } : undefined,
          deletedAt: null
        }
      });
      return createResponse({ isUnique: !existing }, "Uniqueness check completed");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/promotions/occupied-targets — Check for already assigned targets
  fastify.get('/admin/promotions/occupied-targets', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Get target IDs already assigned to active promotions in a date range',
      tags: ['Admin', 'Promotions'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          excludeId: { type: 'string' }
        },
        required: ['startDate', 'endDate']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { startDate, endDate, excludeId } = request.query as any;
      const occupied = await PromotionService.getOccupiedTargets(fastify.prisma, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        excludeId
      });
      return createResponse(occupied, "Occupied targets retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // ============================================================
  // ADMIN ROUTES (Require Auth)
  // ============================================================

  // GET /admin/promotions — List all (paginated)
  fastify.get('/admin/promotions', {
    preHandler: [fastify.authenticate],
    schema: { description: 'List all promotions', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const promotions = await (fastify.prisma as any).promotion.findMany({
        where: { deletedAt: null },
        include: {
          tiers: { orderBy: { minQuantity: 'asc' } },
          product: { select: { id: true, name: true, sku: true } },
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
      });
      return createResponse(promotions, "Promotions retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/promotions/:id — Get single
  fastify.get('/admin/promotions/:id', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Get a single promotion by ID', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const promotion = await (fastify.prisma as any).promotion.findUnique({
        where: { id },
        include: {
          tiers: { orderBy: { minQuantity: 'asc' } },
          product: { select: { id: true, name: true, sku: true } },
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } }
        }
      });
      if (!promotion || promotion.deletedAt) return reply.status(404).send(createErrorResponse("Promotion not found"));
      return createResponse(promotion, "Promotion retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /admin/promotions — Create
  fastify.post('/admin/promotions', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Create a new promotion with tiers', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const userId = (request as any).user?.id;

      const promotion = await (fastify.prisma as any).promotion.create({
        data: {
          name: body.name,
          campaignType: body.campaignType || 'GENERAL',
          displayTitle: body.displayTitle || null,
          displaySubtitle: body.displaySubtitle || null,
          description: body.description || null,
          discountType: body.discountType,
          targetType: body.targetType,
          targetProductId: body.targetProductId || null,
          targetCategoryId: body.targetCategoryId || null,
          targetBrandId: body.targetBrandId || null,
          targetIds: body.targetIds || [],
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          isActive: body.isActive ?? true,
          priority: body.priority ?? 0,
          maxUsesTotal: body.maxUsesTotal ?? null,
          maxUsesPerUser: body.maxUsesPerUser ?? null,
          customerSegment: body.customerSegment ?? 'ALL',
          minOrderValue: body.minOrderValue ?? null,
          stackable: body.stackable ?? false,
          displayLocations: body.displayLocations || [],
          showOnBanner: body.showOnBanner ?? false,
          bannerImageDesktop: body.bannerImageDesktop || null,
          bannerImageMobile: body.bannerImageMobile || null,
          popupImageDesktop: body.popupImageDesktop || null,
          popupImageMobile: body.popupImageMobile || null,
          bannerImage: body.bannerImage || null,
          bannerColor: body.bannerColor || null,
          backgroundColor: body.backgroundColor || null,
          textColor: body.textColor || null,
          ctaText: body.ctaText || null,
          ctaLink: body.ctaLink || null,
          badgeText: body.badgeText || null,
          showCountdown: body.showCountdown ?? false,
          urgencyMessage: body.urgencyMessage || null,
          isAutoApply: body.isAutoApply ?? false,
          stockThreshold: body.stockThreshold ?? null,
          ageThresholdDays: body.ageThresholdDays ?? null,
          popupYoutubeLink: body.popupYoutubeLink || null,
          popupFrequencyHours: body.popupFrequencyHours ? Number(body.popupFrequencyHours) : 0,
          slug: body.slug || null,
          infoBarText: body.infoBarText || null,
          layoutType: body.layoutType || 'DEFAULT',
          timezone: body.timezone || null,
          createdBy: userId,
          tiers: {
            create: (body.tiers || []).map((t: any) => ({
              minQuantity: Number(t.minQuantity),
              discountValue: Number(t.discountValue),
              label: t.label || null
            }))
          }
        },
        include: { tiers: true }
      });

      return reply.status(201).send(createResponse(promotion, "Promotion created"));
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // PUT /admin/promotions/:id — Update
  fastify.put('/admin/promotions/:id', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Update a promotion and its tiers', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;

      // Delete existing tiers and recreate  
      await (fastify.prisma as any).promotionTier.deleteMany({ where: { promotionId: id } });

      const updated = await (fastify.prisma as any).promotion.update({
        where: { id },
        data: {
          name: body.name,
          campaignType: body.campaignType || 'GENERAL',
          displayTitle: body.displayTitle || null,
          displaySubtitle: body.displaySubtitle || null,
          description: body.description || null,
          discountType: body.discountType,
          targetType: body.targetType,
          targetProductId: body.targetProductId || null,
          targetCategoryId: body.targetCategoryId || null,
          targetBrandId: body.targetBrandId || null,
          targetIds: body.targetIds || [],
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          isActive: body.isActive ?? true,
          priority: body.priority ?? 0,
          maxUsesTotal: body.maxUsesTotal ?? null,
          maxUsesPerUser: body.maxUsesPerUser ?? null,
          customerSegment: body.customerSegment ?? 'ALL',
          minOrderValue: body.minOrderValue ?? null,
          stackable: body.stackable ?? false,
          displayLocations: body.displayLocations || [],
          showOnBanner: body.showOnBanner ?? false,
          bannerImageDesktop: body.bannerImageDesktop || null,
          bannerImageMobile: body.bannerImageMobile || null,
          popupImageDesktop: body.popupImageDesktop || null,
          popupImageMobile: body.popupImageMobile || null,
          bannerImage: body.bannerImage || null,
          bannerColor: body.bannerColor || null,
          backgroundColor: body.backgroundColor || null,
          textColor: body.textColor || null,
          ctaText: body.ctaText || null,
          ctaLink: body.ctaLink || null,
          badgeText: body.badgeText || null,
          showCountdown: body.showCountdown ?? false,
          urgencyMessage: body.urgencyMessage || null,
          isAutoApply: body.isAutoApply ?? false,
          stockThreshold: body.stockThreshold ?? null,
          ageThresholdDays: body.ageThresholdDays ?? null,
          popupYoutubeLink: body.popupYoutubeLink || null,
          popupFrequencyHours: body.popupFrequencyHours ? Number(body.popupFrequencyHours) : 0,
          slug: body.slug || null,
          infoBarText: body.infoBarText || null,
          layoutType: body.layoutType || 'DEFAULT',
          timezone: body.timezone || null,
          tiers: {
            create: (body.tiers || []).map((t: any) => ({
              minQuantity: Number(t.minQuantity),
              discountValue: Number(t.discountValue),
              label: t.label || null
            }))
          }
        },
        include: { tiers: true }
      });

      return createResponse(updated, "Promotion updated");
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // PATCH /admin/promotions/:id/status — Toggle Active Status
  fastify.patch('/admin/promotions/:id/status', {
    preHandler: [fastify.authenticate],
    schema: { 
      description: 'Toggle promotion active status', 
      tags: ['Admin', 'Promotions'],
      body: {
        type: 'object',
        properties: { isActive: { type: 'boolean' } },
        required: ['isActive']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { isActive } = request.body as any;
      
      const updated = await (fastify.prisma as any).promotion.update({
        where: { id, deletedAt: null },
        data: { isActive }
      });
      
      return createResponse(updated, `Promotion ${isActive ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/promotions/trash — List soft-deleted
  fastify.get('/admin/promotions/trash', {
    preHandler: [fastify.authenticate],
    schema: { description: 'List soft-deleted promotions', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const promotions = await (fastify.prisma as any).promotion.findMany({
        where: { deletedAt: { not: null } },
        include: {
          tiers: { orderBy: { minQuantity: 'asc' } },
          product: { select: { id: true, name: true, sku: true } }
        },
        orderBy: { deletedAt: 'desc' }
      });
      return createResponse(promotions, "Trash promotions retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // DELETE /admin/promotions/:id — Soft Delete
  fastify.delete('/admin/promotions/:id', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Soft delete a promotion', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const updated = await (fastify.prisma as any).promotion.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false }
      });
      return createResponse(updated, "Promotion moved to trash");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /admin/promotions/:id/restore — Restore
  fastify.post('/admin/promotions/:id/restore', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Restore a soft-deleted promotion', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const updated = await (fastify.prisma as any).promotion.update({
        where: { id },
        data: { deletedAt: null, isActive: true }
      });
      return createResponse(updated, "Promotion restored successfully");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // DELETE /admin/promotions/:id/permanent — Permanent Delete
  fastify.delete('/admin/promotions/:id/permanent', {
    preHandler: [fastify.authenticate],
    schema: { description: 'Permanently delete a promotion', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      
      // Delete tiers first (Prisma should handle if onDelete: Cascade but let's be sure)
      await (fastify.prisma as any).promotionTier.deleteMany({ where: { promotionId: id } });
      
      const deleted = await (fastify.prisma as any).promotion.delete({
        where: { id }
      });
      return createResponse(deleted, "Promotion permanently deleted");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
