import { PrismaClient } from '@prisma/client';
import { PaymentResolver } from '../services/payment-resolver.service';

const prisma = new PrismaClient();

async function test() {
  console.log('--- DB STATE ---');
  
  const gateways = await prisma.paymentGateway.findMany();
  console.log('Gateways:', gateways.map(g => ({ id: g.id, name: g.name, identifier: g.identifier, type: g.type, isActive: g.isActive })));

  const zones = await prisma.paymentZone.findMany();
  console.log('Zones:', zones);

  const rules = await prisma.paymentRule.findMany({
    include: { zone: true, gateway: true }
  });
  console.log('Rules:', rules.map(r => ({ 
    id: r.id, 
    type: r.paymentType, 
    zone: r.zone?.name || 'Global', 
    gateway: r.gateway?.identifier || 'N/A',
    isEnabled: r.isEnabled,
    min: r.minOrderValue,
    max: r.maxOrderValue
  })));

  console.log('\n--- RESOLVER TEST (Karachi, 2000) ---');
  const results = await PaymentResolver.getAvailableMethods('karachi', 2000, prisma as any);
  console.log('Results:', JSON.stringify(results, null, 2));
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
