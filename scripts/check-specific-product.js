const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProduct() {
  try {
    console.log("Searching for product 'Liquid Filter' or 'P554005'...");
    
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { name: { contains: 'Liquid Filter', mode: 'insensitive' } },
          { sku: { contains: 'P554005', mode: 'insensitive' } }
        ]
      }
    });

    if (product) {
        console.log("Product Found:");
        console.log(`ID: ${product.id}`);
        console.log(`Name: ${product.name}`);
        console.log(`SKU: ${product.sku}`);
        console.log("Dimensions:");
        console.log(`- Width: ${product.width}`);
        console.log(`- Length: ${product.length}`);
        console.log(`- Weight: ${product.weight}`);
        console.log(`- Volume: ${product.volume}`);
    } else {
        console.log("Product NOT found in database.");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

checkProduct();
