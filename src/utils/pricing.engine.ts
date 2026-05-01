import { PrismaClient } from '@prisma/client';
import { PromotionService } from '../services/promotion.service';

export interface PriceResult {
    finalPrice: number;
    originalPrice?: number;
    discountAmount?: number;
    discountPercent?: number;
    discountType: 'NONE' | 'TIER' | 'OVERRIDE' | 'CATALOG' | 'PROMOTION';
    promotionId?: string;
    tierName?: string;
    badgeText?: string;
    campaignType?: string;
    urgencyMessage?: string;
    showCountdown?: boolean;
    endDate?: Date | string;
    nextTierUpsell?: {
        qtyNeeded: number;
        potentialSavings: number;
        tierLabel: string;
    } | null;
}

export interface BulkPriceResult extends PriceResult {
    productId: string;
    basePrice: number;
    sku?: string;
    quantity?: number;
    tierLabel?: string;
}

export class PricingEngine {
  /**
   * Calculates the final price for a product based on the user's B2B profile pricing rules and active promotions.
   * Priority:
   * 1. Catalog Pricing (Absolute Priority for B2B)
   * 2. SKU Override (ProductDiscountOverride)
   * 3. Best of (Promotion Tier OR General B2B Tier Discount)
   * 4. Base Price
   */
  static async calculatePrice(
    prisma: PrismaClient, 
    productId: string, 
    basePrice: number, 
    userId?: string, 
    productSku?: string,
    quantity: number = 1
  ): Promise<PriceResult> {
    const defaultResult: PriceResult = { 
        finalPrice: Number(basePrice), 
        originalPrice: Number(basePrice),
        discountAmount: 0,
        discountPercent: 0,
        discountType: 'NONE'
    };

    if (basePrice <= 0) return defaultResult;

    try {
      // Fetch Product info for promotion targeting
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { 
          id: true, 
          categoryId: true, 
          brandId: true,
          stocks: { select: { qty: true } }
        }
      });

      if (!product) return defaultResult;

      const user = userId ? await prisma.user.findUnique({
        where: { id: userId },
        include: {
          company: {
            include: {
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
                orderBy: { priority: 'desc' },
                include: {
                  catalog: {
                    include: {
                      pricingOverrides: {
                        where: { variantId: productId }
                      }
                    }
                  }
                }
              }
            }
          },
          b2bProfile: {
            include: {
              discountTier: true,
              discountOverrides: {
                where: { productId }
              }
            }
          }
        }
      }) : null;

      let finalPrice = Number(basePrice);
      let appliedDiscountType: 'NONE' | 'TIER' | 'OVERRIDE' | 'CATALOG' | 'PROMOTION' = 'NONE';
      let tierName: string | undefined;
      let promotionMetadata: any = null;

      // 1. Check Catalog Pricing (Highest Priority for assigned companies)
      if (user?.company && user.company.catalogs.length > 0) {
        for (const companyCatalog of user.company.catalogs) {
          const pricing = companyCatalog.catalog.pricingOverrides[0];
          if (pricing) {
            return {
              finalPrice: Number(pricing.customPrice),
              originalPrice: Number(basePrice),
              discountAmount: Number((basePrice - Number(pricing.customPrice)).toFixed(2)),
              discountPercent: Math.round(((basePrice - Number(pricing.customPrice)) / basePrice) * 100),
              discountType: 'CATALOG'
            };
          }
        }
      }

      // 2. Check SKU Override
      if (user?.b2bProfile?.discountOverrides && user.b2bProfile.discountOverrides.length > 0) {
        const override = user.b2bProfile.discountOverrides[0];
        const discountPercent = Number(override.discountPercent);
        if (discountPercent > 0 && discountPercent <= 100) {
          finalPrice = finalPrice * (1 - (discountPercent / 100));
          return { 
            finalPrice: Number(finalPrice.toFixed(2)), 
            originalPrice: Number(basePrice),
            discountAmount: Number((basePrice - finalPrice).toFixed(2)),
            discountPercent: Math.round(discountPercent),
            discountType: 'OVERRIDE' 
          };
        }
      }

      // 3. Fetch Active Promotions
      const promotions = await PromotionService.getActivePromotions(prisma, {
        productIds: [productId],
        categoryIds: [product.categoryId],
        brandIds: [product.brandId],
        customerSegment: user?.b2bProfile ? 'B2B_ONLY' : 'RETAIL_ONLY'
      });

      const currentStock = product.stocks.reduce((sum, s) => sum + s.qty, 0);

      const promoResult = PromotionService.evaluatePromotion(promotions, {
        id: product.id,
        categoryId: product.categoryId,
        brandId: product.brandId,
        basePrice: Number(basePrice),
        currentStock
      }, quantity);

      // 4. Check General B2B Tier Discount
      let b2bTierPrice = Number(basePrice);
      let hasB2BTier = false;
      let b2bTierPercent = 0;
      if (user?.b2bProfile?.discountTier && user.b2bProfile.discountTier.isActive) {
        const exemptSkus: string[] = user.b2bProfile.discountTier.exemptSkus || [];
        if (!productSku || !exemptSkus.includes(productSku)) {
          b2bTierPercent = Number(user.b2bProfile.discountTier.discountPercent);
          if (b2bTierPercent > 0 && b2bTierPercent <= 100) {
            b2bTierPrice = b2bTierPrice * (1 - (b2bTierPercent / 100));
            hasB2BTier = true;
          }
        }
      }

      // 5. Compare Promotion vs B2B Tier (Best Price Logic)
      if (promoResult && hasB2BTier) {
        if (promoResult.finalPrice <= Number(b2bTierPrice.toFixed(2))) {
          finalPrice = promoResult.finalPrice;
          appliedDiscountType = 'PROMOTION';
          promotionMetadata = promoResult;
        } else {
          finalPrice = b2bTierPrice;
          appliedDiscountType = 'TIER';
          tierName = user?.b2bProfile?.discountTier?.name;
          promotionMetadata = promoResult; 
        }
      } else if (promoResult) {
        finalPrice = promoResult.finalPrice;
        appliedDiscountType = 'PROMOTION';
        promotionMetadata = promoResult;
      } else if (hasB2BTier) {
        finalPrice = b2bTierPrice;
        appliedDiscountType = 'TIER';
        tierName = user?.b2bProfile?.discountTier?.name;
      }

      return {
        finalPrice: Number(finalPrice.toFixed(2)),
        originalPrice: Number(basePrice),
        discountAmount: Number((basePrice - finalPrice).toFixed(2)),
        discountPercent: appliedDiscountType === 'TIER' ? b2bTierPercent : (promotionMetadata?.discountPercent || 0),
        discountType: appliedDiscountType,
        promotionId: promotionMetadata?.promoId,
        tierName,
        badgeText: promotionMetadata?.badgeText,
        campaignType: promotionMetadata?.campaignType,
        urgencyMessage: promotionMetadata?.urgencyMessage,
        showCountdown: promotionMetadata?.showCountdown,
        endDate: promotionMetadata?.endDate,
        nextTierUpsell: promotionMetadata?.nextTierUpsell
      };
    } catch (err) {
      console.error('PricingEngine Error:', err);
      return defaultResult;
    }
  }

  /**
   * Calculate prices for multiple items in a cart/bulk order.
   */
  static async calculateBulkPrices(
    prisma: PrismaClient, 
    items: { productId: string, basePrice: number, sku?: string, quantity?: number }[], 
    userId?: string
  ): Promise<BulkPriceResult[]> {
    if (items.length === 0) return [];

    try {
      // Batch fetch product info
      const productIds = items.map(i => i.productId);
      const productsFromDb = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { 
          id: true, 
          categoryId: true, 
          brandId: true,
          stocks: { select: { qty: true } }
        }
      });
      const productMap = new Map(productsFromDb.map(p => [p.id, p]));

      // Fetch user and profiles
      const user = userId ? await prisma.user.findUnique({
        where: { id: userId },
        include: {
          company: {
            include: {
              catalogs: {
                where: {
                  catalog: {
                    isActive: true,
                    deletedAt: null
                  }
                },
                include: {
                  catalog: {
                    include: {
                      pricingOverrides: true
                    }
                  }
                }
              }
            }
          },
          b2bProfile: {
            include: {
              discountTier: true,
              discountOverrides: true
            }
          }
        }
      }) : null;

      // Catalog Pricing Map
      const catalogPricingMap = new Map<string, number>();
      if (user?.company && user.company.catalogs.length > 0) {
        const sortedCatalogs = [...user.company.catalogs].sort((a, b) => (a.priority || 0) - (b.priority || 0));
        for (const companyCatalog of sortedCatalogs) {
          for (const pricing of companyCatalog.catalog.pricingOverrides) {
            catalogPricingMap.set(pricing.variantId, Number(pricing.customPrice));
          }
        }
      }

      // Fetch all active promotions
      const categoryIds = productsFromDb.map(p => p.categoryId);
      const brandIds = productsFromDb.map(p => p.brandId);
      
      const promotions = await PromotionService.getActivePromotions(prisma, {
        productIds,
        categoryIds,
        brandIds,
        customerSegment: user?.b2bProfile ? 'B2B_ONLY' : 'RETAIL_ONLY'
      });

      const overridesMap = new Map();
      if (user?.b2bProfile?.discountOverrides) {
        user.b2bProfile.discountOverrides.forEach(o => {
          overridesMap.set(o.productId, Number(o.discountPercent));
        });
      }

      const b2bTierPercent = (user?.b2bProfile?.discountTier && user.b2bProfile.discountTier.isActive) 
        ? Number(user.b2bProfile.discountTier.discountPercent) 
        : 0;

      return items.map(item => {
        const qty = item.quantity || 1;
        const basePrice = Number(item.basePrice);
        let finalPrice = basePrice;
        let discountType: 'NONE' | 'TIER' | 'OVERRIDE' | 'CATALOG' | 'PROMOTION' = 'NONE';
        let promotionMetadata: any = null;
        let tierName: string | undefined;

        // 1. Catalog Pricing (Highest Priority)
        if (catalogPricingMap.has(item.productId)) {
           finalPrice = catalogPricingMap.get(item.productId)!;
           discountType = 'CATALOG';
           return {
             ...item,
             productId: item.productId,
             basePrice,
             finalPrice: Number(finalPrice.toFixed(2)),
             originalPrice: basePrice,
             discountAmount: Number((basePrice - finalPrice).toFixed(2)),
             discountPercent: Math.round(((basePrice - finalPrice) / basePrice) * 100),
             discountType
           };
        }

        // 2. SKU Override
        if (overridesMap.has(item.productId)) {
          const overrideDiscount = overridesMap.get(item.productId);
          if (overrideDiscount > 0 && overrideDiscount <= 100) {
            finalPrice = finalPrice * (1 - (overrideDiscount / 100));
            discountType = 'OVERRIDE';
            return {
              ...item,
              productId: item.productId,
              basePrice,
              finalPrice: Number(finalPrice.toFixed(2)),
              originalPrice: basePrice,
              discountAmount: Number((basePrice - finalPrice).toFixed(2)),
              discountPercent: Math.round(overrideDiscount),
              discountType
            };
          }
        }

        // 3. Evaluate Promotion
        const product = productMap.get(item.productId);
        const currentStock = product ? (product as any).stocks.reduce((sum: number, s: any) => sum + s.qty, 0) : 0;
        const promoResult = product ? PromotionService.evaluatePromotion(promotions, {
          id: product.id,
          categoryId: product.categoryId,
          brandId: product.brandId,
          basePrice,
          currentStock
        } as any, qty) : null;

        // 4. Evaluate B2B Tier
        let b2bTierPrice = basePrice;
        let hasB2BTier = false;
        if (b2bTierPercent > 0 && b2bTierPercent <= 100) {
          const exemptSkus: string[] = user?.b2bProfile?.discountTier?.exemptSkus || [];
          if (!item.sku || !exemptSkus.includes(item.sku)) {
            b2bTierPrice = b2bTierPrice * (1 - (b2bTierPercent / 100));
            hasB2BTier = true;
          }
        }

        // 5. Best Price Logic
        if (promoResult && hasB2BTier) {
          if (promoResult.finalPrice <= Number(b2bTierPrice.toFixed(2))) {
            finalPrice = promoResult.finalPrice;
            discountType = 'PROMOTION';
            promotionMetadata = promoResult;
          } else {
            finalPrice = b2bTierPrice;
            discountType = 'TIER';
            tierName = user?.b2bProfile?.discountTier?.name;
            promotionMetadata = promoResult; 
          }
        } else if (promoResult) {
          finalPrice = promoResult.finalPrice;
          discountType = 'PROMOTION';
          promotionMetadata = promoResult;
        } else if (hasB2BTier) {
          finalPrice = b2bTierPrice;
          discountType = 'TIER';
          tierName = user?.b2bProfile?.discountTier?.name;
        }

        return {
          ...item,
          productId: item.productId,
          basePrice,
          finalPrice: Number(finalPrice.toFixed(2)),
          originalPrice: basePrice,
          discountAmount: Number((basePrice - finalPrice).toFixed(2)),
          discountPercent: discountType === 'TIER' ? b2bTierPercent : (promotionMetadata?.discountPercent || 0),
          discountType,
          promotionId: promotionMetadata?.promoId,
          tierName,
          badgeText: promotionMetadata?.badgeText,
          campaignType: promotionMetadata?.campaignType,
          urgencyMessage: promotionMetadata?.urgencyMessage,
          showCountdown: promotionMetadata?.showCountdown,
          endDate: promotionMetadata?.endDate,
          nextTierUpsell: promotionMetadata?.nextTierUpsell
        };
      });
    } catch (err) {
      console.error('PricingEngine Bulk Error:', err);
      return items.map(item => ({ 
        ...item, 
        productId: item.productId,
        basePrice: Number(item.basePrice),
        finalPrice: Number(item.basePrice),
        originalPrice: Number(item.basePrice),
        discountAmount: 0,
        discountPercent: 0,
        discountType: 'NONE' as const
      }));
    }
  }
}
