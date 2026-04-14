import { PrismaClient } from '@prisma/client';

export class PricingEngine {
  /**
   * Calculates the final price for a product based on the user's B2B profile pricing rules.
   * Priority:
   * 1. Catalog Pricing (Company -> Catalog -> CatalogPricing)
   * 2. SKU Override (ProductDiscountOverride)
   * 3. Tier Discount (DiscountTier)
   * 4. Base Price
   */
  static async calculatePrice(prisma: PrismaClient, productId: string, basePrice: number, userId?: string, productSku?: string): Promise<number> {
    if (!userId || basePrice <= 0) return Number(basePrice);

    try {
      const user = await prisma.user.findUnique({
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
      });

      if (!user) return Number(basePrice);

      // 1. Check Catalog Pricing (Highest Priority)
      if (user.company && user.company.catalogs.length > 0) {
        // Since catalogs are ordered by priority, we check each one
        for (const companyCatalog of user.company.catalogs) {
          const pricing = companyCatalog.catalog.pricingOverrides[0];
          if (pricing) {
            return Number(pricing.customPrice);
          }
        }
      }

      if (!user.b2bProfile) return Number(basePrice);

      let finalPrice = Number(basePrice);
      
      // 2. Check SKU Override
      if (user.b2bProfile.discountOverrides && user.b2bProfile.discountOverrides.length > 0) {
        const override = user.b2bProfile.discountOverrides[0];
        const discountPercent = Number(override.discountPercent);
        if (discountPercent > 0 && discountPercent <= 100) {
          finalPrice = finalPrice * (1 - (discountPercent / 100));
          return Number(finalPrice.toFixed(2));
        }
      }

      // 3. Check Tier Discount
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
                      pricingOverrides: true // Get all for in-memory mapping
                    }
                  }
                }
              }
            }
          },
          b2bProfile: {
            include: {
              discountTier: true,
              discountOverrides: true // Get all overrides to calculate in-memory
            }
          }
        }
      });

      if (!user) {
        return items.map(item => ({ 
          ...item, 
          basePrice: Number(item.basePrice),
          finalPrice: Number(item.basePrice),
          discountType: 'NONE' as const,
          tierName: undefined as string | undefined
        }));
      }

      // Catalog Pricing Map (Highest Priority)
      const catalogPricingMap = new Map<string, number>();
      if (user.company && user.company.catalogs.length > 0) {
        // Reverse order so higher priority catalogs overwrite lower ones in the map
        const sortedCatalogs = [...user.company.catalogs].reverse();
        for (const companyCatalog of sortedCatalogs) {
          for (const pricing of companyCatalog.catalog.pricingOverrides) {
            catalogPricingMap.set(pricing.variantId, Number(pricing.customPrice));
          }
        }
      }

      const overridesMap = new Map();
      if (user.b2bProfile && user.b2bProfile.discountOverrides) {
        user.b2bProfile.discountOverrides.forEach(o => {
          overridesMap.set(o.productId, Number(o.discountPercent));
        });
      }

      const tierDiscount = (user.b2bProfile && user.b2bProfile.discountTier && user.b2bProfile.discountTier.isActive) 
        ? Number(user.b2bProfile.discountTier.discountPercent) 
        : 0;

      return items.map(item => {
        let finalPrice = Number(item.basePrice);
        let discountType: 'NONE' | 'TIER' | 'OVERRIDE' | 'CATALOG' = 'NONE';
        
        // 1. Catalog Pricing (Highest Priority)
        if (catalogPricingMap.has(item.productId)) {
           finalPrice = catalogPricingMap.get(item.productId)!;
           discountType = 'CATALOG';
        } 
        // 2. SKU Override
        else if (overridesMap.has(item.productId)) {
          const overrideDiscount = overridesMap.get(item.productId);
          if (overrideDiscount > 0 && overrideDiscount <= 100) {
            finalPrice = finalPrice * (1 - (overrideDiscount / 100));
            discountType = 'OVERRIDE';
          }
        } 
        // 3. Tier Discount
        else if (tierDiscount > 0 && tierDiscount <= 100) {
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
