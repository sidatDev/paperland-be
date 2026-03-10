
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const warehouseCount = await prisma.warehouse.count();
  
  const products = await prisma.product.findMany({
    include: {
      stocks: true
    }
  });

  let lowStockProducts = 0;
  let outOfStockProducts = 0;

  products.forEach(product => {
    const totalStock = product.stocks.reduce((sum, s) => sum + s.qty, 0);
    if (totalStock === 0) {
      outOfStockProducts++;
    } else if (totalStock <= 10) {
      lowStockProducts++;
    }
  });

  console.log('---RESULT---');
  console.log(JSON.stringify({
    warehouseCount,
    lowStockProducts,
    outOfStockProducts
  }));
  console.log('---END---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
