import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

/**
 * Cleanup script: find all Price records where priceSpecial >= priceRetail
 * (i.e. the special/promotional price is higher than retail, which makes no sense)
 * and reset priceSpecial to null/0.
 */
async function main() {
  try {
    // Find all prices where priceSpecial is set but is >= priceRetail (invalid promotional price)
    const badPrices = await prisma.price.findMany({
      where: {
        priceSpecial: { not: null }
      },
      include: {
        product: { select: { id: true, name: true, sku: true } }
      }
    });

    const toFix = badPrices.filter((p: any) => {
      const retail = Number(p.priceRetail || 0);
      const special = Number(p.priceSpecial || 0);
      // Invalid: special is 0 or >= retail
      return special <= 0 || special >= retail;
    });

    if (toFix.length === 0) {
      console.log('No invalid promotional prices found. All good!');
      return;
    }

    console.log(`Found ${toFix.length} price records with invalid priceSpecial:`);
    toFix.forEach((p: any) => {
      console.log(`  - ${p.product?.name} (${p.product?.sku}): priceRetail=${p.priceRetail}, priceSpecial=${p.priceSpecial} → will be cleared to 0`);
    });

    const ids = toFix.map((p: any) => p.id);
    const result = await prisma.price.updateMany({
      where: { id: { in: ids } },
      data: { priceSpecial: 0 }
    });

    console.log(`\n✅ Successfully cleared priceSpecial to 0 for ${result.count} price records.`);
  } catch (error) {
    console.error('Error running cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
