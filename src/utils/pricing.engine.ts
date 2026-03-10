import { PrismaClient } from '@prisma/client';

export class PricingEngine {
  /**
   * Calculates the final price for a product based on the user's B2B profile pricing rules.
   * Priority:
   * 1. SKU Override (ProductDiscountOverride)
   * 2. Tier Discount (DiscountTier)
   * 3. Base Price
   */
  static async calculatePrice(prisma: PrismaClient, productId: string, basePrice: number, userId?: string, productSku?: string): Promise<number> {
    if (!userId || basePrice <= 0) return Number(basePrice);

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          b2bProfile: {
            include: {
              discountTier: true,
              discountOverrides: {
                where: { productId }
              }
            }
          }
        }
      });

      if (!user || !user.b2bProfile) return Number(basePrice);

      let finalPrice = Number(basePrice);
      
      // 1. Check SKU Override
      if (user.b2bProfile.discountOverrides && user.b2bProfile.discountOverrides.length > 0) {
        const override = user.b2bProfile.discountOverrides[0];
        const discountPercent = Number(override.discountPercent);
        if (discountPercent > 0 && discountPercent <= 100) {
          finalPrice = finalPrice * (1 - (discountPercent / 100));
          return Number(finalPrice.toFixed(2));
        }
      }

      // 2. Check Tier Discount
      if (user.b2bProfile.discountTier && user.b2bProfile.discountTier.isActive) {
        const exemptSkus: string[] = user.b2bProfile.discountTier.exemptSkus || [];
        if (productSku && exemptSkus.includes(productSku)) {
          // Exempted from tier discount
          return Number(finalPrice.toFixed(2));
        }

        const discountPercent = Number(user.b2bProfile.discountTier.discountPercent);
        if (discountPercent > 0 && discountPercent <= 100) {
          finalPrice = finalPrice * (1 - (discountPercent / 100));
          return Number(finalPrice.toFixed(2));
        }
      }

      return Number(finalPrice.toFixed(2));
    } catch (err) {
      console.error('PricingEngine Error:', err);
      return Number(basePrice);
    }
  }

  /**
   * Calculate prices for multiple items in a cart/bulk order.
   */
  static async calculateBulkPrices(prisma: PrismaClient, items: { productId: string, basePrice: number, sku?: string }[], userId?: string) {
    if (!userId) {
      return items.map(item => ({ 
        ...item, 
        basePrice: Number(item.basePrice),
        finalPrice: Number(item.basePrice),
        discountType: 'NONE' as const,
        tierName: undefined as string | undefined
      }));
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          b2bProfile: {
            include: {
              discountTier: true,
              discountOverrides: true // Get all overrides to calculate in-memory
            }
          }
        }
      });

      if (!user || !user.b2bProfile) {
        return items.map(item => ({ 
          ...item, 
          basePrice: Number(item.basePrice),
          finalPrice: Number(item.basePrice),
          discountType: 'NONE' as const,
          tierName: undefined as string | undefined
        }));
      }

      const overridesMap = new Map();
      if (user.b2bProfile.discountOverrides) {
        user.b2bProfile.discountOverrides.forEach(o => {
          overridesMap.set(o.productId, Number(o.discountPercent));
        });
      }

      const tierDiscount = (user.b2bProfile.discountTier && user.b2bProfile.discountTier.isActive) 
        ? Number(user.b2bProfile.discountTier.discountPercent) 
        : 0;

      return items.map(item => {
        let finalPrice = Number(item.basePrice);
        let discountType: 'NONE' | 'TIER' | 'OVERRIDE' = 'NONE';
        
        if (overridesMap.has(item.productId)) {
          const overrideDiscount = overridesMap.get(item.productId);
          if (overrideDiscount > 0 && overrideDiscount <= 100) {
            finalPrice = finalPrice * (1 - (overrideDiscount / 100));
            discountType = 'OVERRIDE';
          }
        } else if (tierDiscount > 0 && tierDiscount <= 100) {
          const exemptSkus: string[] = user.b2bProfile?.discountTier?.exemptSkus || [];
          if (!item.sku || !exemptSkus.includes(item.sku)) {
            finalPrice = finalPrice * (1 - (tierDiscount / 100));
            discountType = 'TIER';
          }
        }

        return {
          ...item,
          basePrice: Number(item.basePrice),
          finalPrice: Number(finalPrice.toFixed(2)),
          discountType,
          tierName: discountType === 'TIER' ? user.b2bProfile?.discountTier?.name : undefined
        };
      });
    } catch (err) {
      console.error('PricingEngine Error:', err);
      return items.map(item => ({ 
        ...item, 
        basePrice: Number(item.basePrice),
        finalPrice: Number(item.basePrice),
        discountType: 'NONE' as const,
        tierName: undefined as string | undefined
      }));
    }
  }
}
