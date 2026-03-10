
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function makeProductsVisible() {
  try {
    console.log("Updating all products to be visible on E-commerce...");
    
    const updateResult = await prisma.product.updateMany({
      where: {
        deletedAt: null
      },
      data: {
        isActive: true,
        isEcommerceVisible: true
      }
    });

    console.log(`Updated ${updateResult.count} products. They should now be visible on the public shop.`);

  } catch (error) {
    console.error("Error updating products:", error);
  } finally {
    await prisma.$disconnect();
  }
}

makeProductsVisible();
