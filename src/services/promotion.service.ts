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
        OR: [
          { maxUsesTotal: null },
          { 
            AND: [
              { maxUsesTotal: { not: null } },
              { currentUses: { lt: (prisma as any).promotion.fields?.maxUsesTotal || 9999999 } } // This is a placeholder for the logic below
            ]
          }
        ],
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

    // Filter out promotions that have reached their limit (Prisma doesn't support comparing two columns in 'where' easily without raw SQL)
    return promotions.filter((p: any) => p.maxUsesTotal === null || p.currentUses < p.maxUsesTotal);
  }

  /**
   * Increment promotion usage count atomically.
   * Returns true if successful, false if limit reached.
   */
  static async incrementPromotionUsage(prisma: any, promoId: string, amount: number = 1) {
    try {
      // Use Raw SQL for 100% atomic 'compare-and-swap' logic
      // This is the only way to be 100% sure in high traffic
      const result = await prisma.$executeRawUnsafe(`
        UPDATE "Promotion" 
        SET "currentUses" = "currentUses" + ${amount}
        WHERE "id" = '${promoId}' 
        AND ("maxUsesTotal" IS NULL OR "currentUses" < "maxUsesTotal")
      `);

      return result > 0;
    } catch (error) {
      console.error('Failed to increment promotion usage:', error);
      return false;
    }
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

  /**
   * Returns a list of target IDs (products, categories, brands) that are already
   * assigned to active promotions overlapping with the given date range.
   */
  static async getOccupiedTargets(
    prisma: PrismaClient,
    params: {
      startDate: Date;
      endDate: Date;
      excludeId?: string;
    }
  ) {
    const { startDate, endDate, excludeId } = params;

    const overlappingPromotions = await (prisma as any).promotion.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } }
        ]
      },
      select: {
        targetType: true,
        targetProductId: true,
        targetCategoryId: true,
        targetBrandId: true,
        targetIds: true
      }
    });

    const occupied = {
      products: new Set<string>(),
      categories: new Set<string>(),
      brands: new Set<string>()
    };

    overlappingPromotions.forEach((p: any) => {
      if (p.targetType === 'PRODUCT') {
        if (p.targetProductId) occupied.products.add(p.targetProductId);
        if (p.targetIds) p.targetIds.forEach((id: string) => occupied.products.add(id));
      } else if (p.targetType === 'CATEGORY') {
        if (p.targetCategoryId) occupied.categories.add(p.targetCategoryId);
        if (p.targetIds) p.targetIds.forEach((id: string) => occupied.categories.add(id));
      } else if (p.targetType === 'BRAND') {
        if (p.targetBrandId) occupied.brands.add(p.targetBrandId);
        if (p.targetIds) p.targetIds.forEach((id: string) => occupied.brands.add(id));
      }
    });

    return {
      products: Array.from(occupied.products),
      categories: Array.from(occupied.categories),
      brands: Array.from(occupied.brands)
    };
  }
}
