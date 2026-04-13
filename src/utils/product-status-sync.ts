import { PrismaClient } from '@prisma/client';

/**
 * Recalculates total available stock for a product across all warehouses
 * and updates its 'status' label in specifications to ensure consistency.
 */
export async function syncProductStockStatus(prisma: PrismaClient | any, productId: string) {
    try {
        // 1. Fetch total quantities
        const stocks = await prisma.stock.findMany({
            where: { productId }
        });

        const totalPhysicalQty = stocks.reduce((acc: number, s: any) => acc + (s.qty || 0), 0);
        const totalReservedQty = stocks.reduce((acc: number, s: any) => acc + (s.reservedQty || 0), 0);
        const totalAvailable = totalPhysicalQty - totalReservedQty;

        // 2. Determine new status
        // If available stock is 0 or less, it's Out of Stock.
        // If it's more than 0, it's Active.
        const newStatus = totalAvailable <= 0 ? "Out of Stock" : "Active";

        // 3. Fetch current product were to get existing specifications
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { status: true, specifications: true }
        });

        if (!product) return;

        const currentSpecs = (product.specifications as any) || {};
        const currentSpecStatus = currentSpecs.status;
        const currentNativeStatus = product.status;

        // 4. Update only if status changed
        if (currentSpecStatus !== newStatus || currentNativeStatus !== newStatus) {
            await prisma.product.update({
                where: { id: productId },
                data: {
                    status: newStatus,
                    specifications: {
                        ...currentSpecs,
                        status: newStatus
                    }
                }
            });
            console.log(`[InventorySync] Product ${productId} status updated to: ${newStatus}`);
        }
    } catch (error) {
        console.error(`[InventorySync] Error syncing status for product ${productId}:`, error);
    }
}
