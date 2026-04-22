import { PrismaClient } from '@prisma/client';

/**
 * PaymentResolver
 * Core engine for dynamically resolving available payment methods based on
 * order region (city) and transaction amount.
 */
export class PaymentResolver {
  /**
   * getAvailableMethods
   * Evaluates payment rules and returns available methods.
   */
  static async getAvailableMethods(city: string | null, amount: number, prisma: PrismaClient) {
    try {
      const normalizedCity = city ? city.toLowerCase().trim() : '';

      // 1. Find matching zone
      const zones = await (prisma as any).paymentZone.findMany({
        where: { isActive: true }
      });

      const matchingZone = zones.find((z: any) => {
        let cities: string[] = [];
        try {
          cities = typeof z.cities === 'string' ? JSON.parse(z.cities) : (z.cities as string[]);
        } catch (e) {
          cities = [];
        }
        return Array.isArray(cities) && cities.some(c => c.toLowerCase().trim() === normalizedCity);
      });

      // 2. Fetch Rules (Zone-specific OR Global)
      const rules = await (prisma as any).paymentRule.findMany({
        where: {
          isEnabled: true,
          OR: [
            { zoneId: matchingZone ? matchingZone.id : undefined },
            { zoneId: null }
          ].filter(q => q.zoneId !== undefined)
        },
        include: { gateway: true },
        orderBy: { priority: 'asc' }
      });

      // 3. Fallback if no rules exist
      if (rules.length === 0) {
        // Default to COD if active as a failsafe
        const codGateway = await (prisma as any).paymentGateway.findFirst({
          where: { identifier: 'cod', isActive: true }
        });
        if (codGateway) {
          return [{
            id: codGateway.id,
            type: 'COD',
            available: true,
            reason: null,
            extraCharge: 0,
            priority: 0,
            name: codGateway.name,
            instructions: codGateway.instructions || "Pay cash on delivery"
          }];
        }
        return [];
      }

      // Fetch active bank accounts for Bank Transfer
      const bankAccounts = await (prisma as any).bankAccount.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 4. Process Rules
      const results = await Promise.all(rules.map(async (rule: any) => {
        let available = true;
        let reason: string | null = null;

        // Check amount constraints
        if (rule.minOrderValue && amount < Number(rule.minOrderValue)) {
          available = false;
          reason = `Minimum order amount for this method is Rs. ${Number(rule.minOrderValue).toLocaleString()}`;
        } else if (rule.maxOrderValue && amount > Number(rule.maxOrderValue)) {
          available = false;
          reason = `Maximum order amount for this method is Rs. ${Number(rule.maxOrderValue).toLocaleString()}`;
        }

        // Check gateway status for Online methods
        if (rule.paymentType === 'ONLINE' && rule.gateway) {
          if (!rule.gateway.isActive) {
            available = false;
            reason = "Payment gateway is currently offline";
          }
        }

        const baseResponse: any = {
          id: rule.id,
          type: rule.paymentType,
          gateway: rule.gateway?.identifier,
          available,
          reason,
          extraCharge: rule.extraCharge ? Number(rule.extraCharge) : 0,
          priority: rule.priority,
          name: rule.gateway?.name || (rule.paymentType === 'BANK_TRANSFER' ? 'Bank Transfer' : rule.paymentType),
          instructions: rule.gateway?.instructions || ""
        };

        // Attach Bank Details
        if (rule.paymentType === 'BANK_TRANSFER') {
          baseResponse.banks = bankAccounts.map((b: any) => ({
            id: b.id,
            bankName: b.bankName,
            accountTitle: b.accountTitle,
            accountNumber: b.accountNumber,
            iban: b.iban,
            branch: b.branch
          }));
        }

        // Attach Public Gateway Config (Stripe specific)
        if (rule.paymentType === 'ONLINE' && rule.gateway?.identifier === 'stripe' && rule.gateway.config) {
          const cfg = typeof rule.gateway.config === 'string' ? JSON.parse(rule.gateway.config) : rule.gateway.config;
          baseResponse.stripeConfig = {
            publishableKey: cfg.publishableKey || '',
            mode: cfg.mode || 'test',
            currency: cfg.currency || 'usd',
            exchangeRatePKR: cfg.exchangeRatePKR || 278
          };
        }

        return baseResponse;
      }));

      return results;
    } catch (error) {
      console.error('[PaymentResolver] Error:', error);
      return [];
    }
  }
}
