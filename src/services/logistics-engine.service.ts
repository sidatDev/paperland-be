import { PrismaClient } from '@prisma/client';

export class LogisticsEngine {
  /**
   * autoAssignLogistics
   * Evaluates active Shipping Rules based on order city and assigns logistics
   * Supports only Pakistan regions/cities as per current constraints.
   */
  static async autoAssignLogistics(orderId: string, tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) {
    try {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          address: true,
        },
      });

      if (!order) {
        return { assigned: false, reason: 'Order not found' };
      }

      if (order.isManualLogistics) {
        return { assigned: false, reason: 'Logistics manually assigned by admin' };
      }

      // Default region is always PK.
      const mappedRegion = 'PK';
      const orderCity = order.shippingDetails && (order.shippingDetails as any).city 
            ? (order.shippingDetails as any).city.toLowerCase() 
            : (order.address?.city?.toLowerCase() || '');

      // Fetch matching rules for PK region
      const rules = await tx.shippingRule.findMany({
        where: {
          region: mappedRegion,
          isActive: true,
          OR: [
            { minOrderValue: null },
            { minOrderValue: { lte: order.totalAmount } },
          ],
          AND: [
             { OR: [{ maxOrderValue: null }, { maxOrderValue: { gte: order.totalAmount } }] }
          ]
        },
        orderBy: [
          { priority: 'desc' }
        ]
      });

      if (!rules || rules.length === 0) {
        return { assigned: false, reason: 'No shipping rules matched' };
      }

      // Try finding exact city match first, then fallback to catch-all (null city)
      let bestRule = rules.find((r: any) => r.city && r.city.toLowerCase() === orderCity);
      
      if (!bestRule) {
          bestRule = rules.find((r: any) => !r.city); // Catch-all rule
      }

      if (!bestRule) {
        return { assigned: false, reason: 'No valid shipping rule for this city' };
      }

      const updateData: any = {
        logisticsType: bestRule.logisticsType,
      };

      if (bestRule.logisticsType === 'THIRD_PARTY' && bestRule.courierProviderId) {
         updateData.courierProviderId = bestRule.courierProviderId;
      }

      if (bestRule.warehouseId) {
        updateData.fulfillmentWarehouseId = bestRule.warehouseId;
      }

      await tx.order.update({
        where: { id: order.id },
        data: updateData,
      });

      // Create tracking log for audit
      await tx.trackingLog.create({
        data: {
          orderId: order.id,
          status: 'LOGISTICS_ASSIGNED',
          location: bestRule.warehouseId ? 'System Auto-Assignment' : null,
          rawResponse: {
             message: `Order logistics auto-assigned by rule: ${bestRule.name}`,
             ruleId: bestRule.id,
             logisticsType: bestRule.logisticsType,
          }
        }
      });

      return { 
          assigned: true, 
          rule: bestRule, 
          logisticsType: bestRule.logisticsType 
      };

    } catch (error) {
      console.error('Error auto-assigning logistics:', error);
      return { assigned: false, reason: 'Internal error during assignment' };
    }
  }

  static async getShippingEstimate(city: string | null, totalAmount: number, tx: any) {
    try {
      const mappedRegion = 'PK';
      const cleanCity = city ? city.toLowerCase().trim() : null;

      // Fetch matching rules for PK region
      const rules = await tx.shippingRule.findMany({
        where: {
          region: mappedRegion,
          isActive: true,
          OR: [
            { minOrderValue: null },
            { minOrderValue: { lte: totalAmount } },
          ],
          AND: [
             { OR: [{ maxOrderValue: null }, { maxOrderValue: { gte: totalAmount } }] }
          ]
        },
        include: {
          courierProvider: true,
        },
        orderBy: [
          { priority: 'desc' }
        ]
      });

      if (!rules || rules.length === 0) {
        return null;
      }

      // Try finding exact city match first, then fallback to catch-all (null city)
      let bestRule = rules.find((r: any) => r.city && r.city.toLowerCase().trim() === cleanCity);
      
      if (!bestRule) {
          bestRule = rules.find((r: any) => !r.city); // Catch-all rule
      }

      if (!bestRule) return null;

      let shipsFrom = 'Processing Center';
      if (bestRule.warehouseId) {
          const warehouse = await tx.warehouse.findUnique({
              where: { id: bestRule.warehouseId },
              select: { city: true }
          });
          if (warehouse) shipsFrom = warehouse.city;
      }

      return {
          estimatedDays: bestRule.estimatedDays || '3-5 business days',
          baseCost: bestRule.baseShippingCost ? parseFloat(bestRule.baseShippingCost.toString()) : 0,
          shipsFrom,
          logisticsType: bestRule.logisticsType,
          courier: bestRule.courierProvider?.name || null
      };

    } catch (error) {
      console.error('Error getting shipping estimate:', error);
      return null;
    }
  }
}
