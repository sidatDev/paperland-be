import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { PromotionService } from '../services/promotion.service';
import { PricingEngine } from '../utils/pricing.engine';

export default async function promotionsRoutes(fastify: FastifyInstance) {
  
  // GET /shop/promotions/active
  fastify.get('/shop/promotions/active', {
    schema: {
      description: 'Get all active promotions for the storefront',
      tags: ['Promotions'],
      querystring: {
        type: 'object',
        properties: {
          segment: { type: 'string', enum: ['ALL', 'B2B_ONLY', 'RETAIL_ONLY'] }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { segment = 'ALL' } = request.query as any;
      const promotions = await PromotionService.getActivePromotions(fastify.prisma as any, {
        customerSegment: segment
      });
      return createResponse(promotions, "Active promotions retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /shop/promotions/storefront
  fastify.get('/shop/promotions/storefront', {
    schema: {
      description: 'Get grouped promotions for the homepage display',
      tags: ['Promotions'],
      querystring: {
        type: 'object',
        properties: {
          segment: { type: 'string', enum: ['ALL', 'B2B_ONLY', 'RETAIL_ONLY'] }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { segment = 'ALL' } = request.query as any;
      const now = new Date();
      
      // Fetch all active promotions
      const promotions = await (fastify.prisma as any).promotion.findMany({
        where: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
          customerSegment: { in: ['ALL', segment] }
        },
        include: {
          tiers: { orderBy: { minQuantity: 'asc' } }
        },
        orderBy: { priority: 'desc' }
      });

      // Grouping Logic
      const result: any = {
        stripPromotions: [],
        heroPromotions: [],
        carouselPromotions: [],
        popupPromotion: null
      };

      for (const promo of promotions) {
        const locations = promo.displayLocations || [];
        
        if (locations.includes('STRIP')) {
          result.stripPromotions.push({
            id: promo.id,
            displayTitle: promo.displayTitle,
            ctaText: promo.ctaText,
            ctaLink: promo.ctaLink,
            backgroundColor: promo.backgroundColor,
            textColor: promo.textColor
          });
        }

        if (locations.includes('HERO')) {
          result.heroPromotions.push({
            id: promo.id,
            displayTitle: promo.displayTitle,
            displaySubtitle: promo.displaySubtitle,
            bannerImageDesktop: promo.bannerImageDesktop || promo.bannerImage,
            bannerImageMobile: promo.bannerImageMobile || promo.bannerImage,
            ctaText: promo.ctaText,
            ctaLink: promo.ctaLink,
            showCountdown: promo.showCountdown,
            endDate: promo.endDate,
            campaignType: promo.campaignType,
            slug: promo.slug
          });
        }

        if (locations.includes('CAROUSEL')) {
          let targetFilter: any = {};
          
          if (promo.targetType === 'ALL') {
            targetFilter = {};
          } else {
            const orArray: any[] = [];
            
            if (promo.targetType === 'PRODUCT') {
              if (promo.targetProductId) orArray.push({ id: promo.targetProductId });
              if (promo.targetIds && promo.targetIds.length > 0) orArray.push({ id: { in: promo.targetIds } });
            } else if (promo.targetType === 'CATEGORY') {
              if (promo.targetCategoryId) orArray.push({ categoryId: promo.targetCategoryId });
              if (promo.targetIds && promo.targetIds.length > 0) orArray.push({ categoryId: { in: promo.targetIds } });
            } else if (promo.targetType === 'BRAND') {
              if (promo.targetBrandId) orArray.push({ brandId: promo.targetBrandId });
              if (promo.targetIds && promo.targetIds.length > 0) orArray.push({ brandId: { in: promo.targetIds } });
            }

            if (orArray.length > 0) {
              targetFilter = { OR: orArray };
            } else {
              targetFilter = { id: 'NONE' };
            }
          }

          const products = await (fastify.prisma as any).product.findMany({
            where: {
              ...targetFilter,
              isActive: true
            },
            take: 8,
            select: { id: true, name: true, sku: true, imageUrl: true, price: true, slug: true }
          });

          if (products.length > 0) {
            const pricedProducts = await Promise.all(products.map(async (p: any) => {
              const pricing = await PricingEngine.calculatePrice(fastify.prisma as any, p.id, Number(p.price), undefined, p.sku);
              return {
                id: p.id,
                name: p.name,
                sku: p.sku,
                imageUrl: p.imageUrl,
                price: p.price,
                slug: p.slug,
                // finalPrice calculation needs to handle potential object from future PricingEngine update
                finalPrice: typeof pricing === 'object' ? (pricing as any).finalPrice : pricing,
                badgeText: typeof pricing === 'object' ? (pricing as any).badgeText || promo.badgeText : promo.badgeText
              };
            }));

            result.carouselPromotions.push({
              promotionId: promo.id,
              campaignType: promo.campaignType === 'FLASH_SALE' ? 'FLASH' : promo.campaignType,
              displayTitle: promo.displayTitle,
              badgeText: promo.badgeText,
              slug: promo.slug,
              products: pricedProducts
            });
          }
        }

        if (locations.includes('POPUP') && !result.popupPromotion) {
          result.popupPromotion = {
            id: promo.id,
            displayTitle: promo.displayTitle,
            bannerImage: promo.bannerImageMobile || promo.bannerImageDesktop || promo.bannerImage,
            ctaText: promo.ctaText,
            ctaLink: promo.ctaLink
          };
        }
      }

      return createResponse(result, "Storefront promotions retrieved");
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });


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

  // ============================================================
  // ADMIN ROUTES (Require Auth)
  // ============================================================

  // GET /v1/admin/promotions — List all (paginated)
  fastify.get('/v1/admin/promotions', {
    preHandler: [fastify.authenticate],
    schema: { description: 'List all promotions', tags: ['Admin', 'Promotions'] }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const promotions = await (fastify.prisma as any).promotion.findMany({
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

  // GET /v1/admin/promotions/:id — Get single
  fastify.get('/v1/admin/promotions/:id', {
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
      if (!promotion) return reply.status(404).send(createErrorResponse("Promotion not found"));
      return createResponse(promotion, "Promotion retrieved");
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /v1/admin/promotions — Create
  fastify.post('/v1/admin/promotions', {
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
          slug: body.slug || null,
          layoutType: body.layoutType || 'DEFAULT',
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

  // PUT /v1/admin/promotions/:id — Update
  fastify.put('/v1/admin/promotions/:id', {
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
          slug: body.slug || null,
          layoutType: body.layoutType || 'DEFAULT',
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

  // PATCH /v1/admin/promotions/:id/status — Toggle Active Status
  fastify.patch('/v1/admin/promotions/:id/status', {
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
        where: { id },
        data: { isActive }
      });
      
      return createResponse(updated, `Promotion ${isActive ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
