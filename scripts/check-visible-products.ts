
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVisibleProducts() {
  try {
    const totalProducts = await prisma.product.count();
    const visibleProducts = await prisma.product.count({
      where: {
        isActive: true,
        isEcommerceVisible: true,
        deletedAt: null
      }
    });

    const sample = await prisma.product.findFirst({
        where: {
            isActive: true,
            isEcommerceVisible: true,
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            sku: true,
            isActive: true,
            isEcommerceVisible: true
        }
    });

    console.log(`Total Products in DB: ${totalProducts}`);
    console.log(`Visible Products on Shop (Active + Visible): ${visibleProducts}`);
    if (sample) {
        console.log("Sample Visible Product:", sample);
    } else {
        console.log("No visible products found. Please check 'isEcommerceVisible' and 'isActive' flags.");
        
        // Check if there are any active but not visible
        const activeOnly = await prisma.product.count({ where: { isActive: true, deletedAt: null } });
        console.log(`Products that are Active but maybe hidden from Ecommerce: ${activeOnly}`);
    }

  } catch (error) {
    console.error("Error checking products:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVisibleProducts();
