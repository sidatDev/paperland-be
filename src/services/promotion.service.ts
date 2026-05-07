import { PrismaClient } from '@prisma/client';

export class PromotionService {
  /**
   * Finds all active promotions for a set of products, categories, and brands.
   */
  static async getActivePromotions(
    prisma: PrismaClient,
    params: {
      productIds?: string[];
      categoryIds?: string[];
      brandIds?: string[];
      customerSegment?: 'ALL' | 'B2B_ONLY' | 'RETAIL_ONLY' | 'GUEST_ONLY';
    }
  ) {
    const now = new Date();
    const { productIds = [], categoryIds = [], brandIds = [], customerSegment = 'ALL' } = params;

    const promotions = await (prisma as any).promotion.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        startDate: { lte: now },
        endDate: { gte: now },
        // No location targeting for PaperLand
        AND: [
          {
            OR: [
              { targetType: 'ALL' },
              { targetType: 'PRODUCT', OR: [{ targetProductId: { in: productIds } }, { targetIds: { hasSome: productIds } }] },
              { targetType: 'CATEGORY', OR: [{ targetCategoryId: { in: categoryIds } }, { targetIds: { hasSome: categoryIds } }] },
              { targetType: 'BRAND', OR: [{ targetBrandId: { in: brandIds } }, { targetIds: { hasSome: brandIds } }] },
            ],
          },
          { customerSegment: { in: ['ALL', customerSegment] } }
        ]
      },
      include: {
        tiers: {
          orderBy: { minQuantity: 'asc' }
        }
      },
      orderBy: { priority: 'desc' }
    });

    return promotions;
  }

  /**
   * Applies the best promotion from a list for a specific item and quantity.
   * Follows STRICT priority resolution.
   */
  static evaluatePromotion(
    promotions: any[],
    product: { id: string; categoryId: string; brandId: string; basePrice: number; currentStock?: number },
    quantity: number,
    forcePromotionId?: string
  ) {
    // 1. Filter promotions that apply to this specific item and pass inventory triggers
    const applicablePromotions = promotions.filter(p => {
      // Inventory Triggers
      if (p.isAutoApply) {
        if (p.stockThreshold !== null && (product.currentStock ?? 0) > p.stockThreshold) return false;
      }

      // Targeting
      if (p.targetType === 'ALL') return true;
      if (p.targetType === 'PRODUCT' && (p.targetProductId === product.id || p.targetIds.includes(product.id))) return true;
      if (p.targetType === 'CATEGORY' && (p.targetCategoryId === product.categoryId || p.targetIds.includes(product.categoryId))) return true;
      if (p.targetType === 'BRAND' && (p.targetBrandId === product.brandId || p.targetIds.includes(product.brandId))) return true;
      return false;
    });

    if (applicablePromotions.length === 0) return null;

    // 2. STRICT PRIORITY RESOLUTION:
    let topPriorityPromos = [];
    if (forcePromotionId) {
        // If forced, only consider the specific promotion if it applies
        topPriorityPromos = applicablePromotions.filter(p => p.id === forcePromotionId);
        if (topPriorityPromos.length === 0) return null;
    } else {
        // Sort by priority DESC
        applicablePromotions.sort((a, b) => b.priority - a.priority);
        // Only consider promotions from the highest priority group
        const highestPriority = applicablePromotions[0].priority;
        topPriorityPromos = applicablePromotions.filter(p => p.priority === highestPriority);
    }

    let bestPrice = Infinity;
    let selectedPromo = null;
    let selectedTier = null;
    let nextTier = null;

    // 3. Among the TOP priority promos, pick the one that gives the lowest price
    for (const promo of topPriorityPromos) {
      const tiers = promo.tiers || [];
      let currentTier = null;
      let potentialNextTier = null;

      for (let i = 0; i < tiers.length; i++) {
        if (quantity >= tiers[i].minQuantity) {
          currentTier = tiers[i];
        } else {
          potentialNextTier = tiers[i];
          break; 
        }
      }

      if (currentTier) {
        let price = Number(product.basePrice);
        const discountValue = Number(currentTier.discountValue);

        if (promo.discountType === 'PERCENTAGE') {
          price = price * (1 - (discountValue / 100));
        } else if (promo.discountType === 'FIXED_PRICE') {
          price = discountValue;
        } else if (promo.discountType === 'FIXED_AMOUNT') {
          price = price - discountValue;
        }

        if (price < bestPrice) {
          bestPrice = price;
          selectedPromo = promo;
          selectedTier = currentTier;
          nextTier = potentialNextTier;
        }
      } else if (tiers.length > 0) {
        // Track first tier as nextTier for upsell if no tier met
        if (!nextTier || tiers[0].minQuantity < nextTier.minQuantity) {
          nextTier = tiers[0];
          if (!selectedPromo) selectedPromo = promo;
        }
      }
    }

    if (!selectedPromo) return null;

    const basePrice = Number(product.basePrice);
    const finalPrice = bestPrice === Infinity ? basePrice : Number(bestPrice.toFixed(2));

    return {
      promoId: selectedPromo.id,
      promoName: selectedPromo.name,
      campaignType: selectedPromo.campaignType,
      badgeText: selectedPromo.badgeText,
      urgencyMessage: selectedPromo.urgencyMessage,
      showCountdown: selectedPromo.showCountdown,
      endDate: selectedPromo.endDate,
      finalPrice,
      originalPrice: basePrice,
      discountAmount: Number((basePrice - finalPrice).toFixed(2)),
      discountPercent: basePrice > 0 ? Math.round(((basePrice - finalPrice) / basePrice) * 100) : 0,
      tierLabel: selectedTier?.label,
      nextTierUpsell: nextTier ? {
        qtyNeeded: nextTier.minQuantity - quantity,
        potentialSavings: Number((basePrice - (selectedPromo.discountType === 'PERCENTAGE' ? (basePrice * (1 - Number(nextTier.discountValue)/100)) : (selectedPromo.discountType === 'FIXED_PRICE' ? Number(nextTier.discountValue) : basePrice - Number(nextTier.discountValue)))).toFixed(2)),
        tierLabel: nextTier.label
      } : null,
      stackable: selectedPromo.stackable || false
    };
  }
}
