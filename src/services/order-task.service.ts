import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';

const prisma = new PrismaClient();

/**
 * Automated Order Cancellation Task
 * Scans for Bank Transfer orders that haven't provided proof within 48 hours.
 */
export async function processOrderCancellationTask(fastify: FastifyInstance) {
    fastify.log.info('[OrderTask] Running automated cancellation check...');

    // Expiry threshold: 48 hours
    const expiryTime = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find orders:
    // - Payment Method: BANK_TRANSFER
    // - Status: PENDING (This means no proof has been uploaded/confirmed yet)
    // - Older than 48 hours
    const ordersToCancel = await prisma.order.findMany({
        where: {
            paymentMethod: 'BANK_TRANSFER',
            status: 'PENDING',
            createdAt: { lt: expiryTime },
            deletedAt: null
        }
    });

    if (ordersToCancel.length === 0) {
        fastify.log.info('[OrderTask] No expired orders found.');
        return;
    }

    fastify.log.info(`[OrderTask] Found ${ordersToCancel.length} orders for automated cancellation.`);

    for (const order of ordersToCancel) {
        try {
            await prisma.$transaction(async (tx) => {
                // 1. Update Order Status
                await tx.order.update({
                    where: { id: order.id },
                    data: { 
                        status: 'CANCELLED',
                        cancellationReason: 'Automated cancellation: No payment proof uploaded within 48 hours.'
                    }
                });

                // 2. Log Status History
                await tx.orderStatusHistory.create({
                    data: {
                        orderId: order.id,
                        status: 'CANCELLED',
                        notes: 'Automated cancellation: No payment proof uploaded within 48 hours.',
                        changedBy: 'SYSTEM'
                    }
                });

                // 3. Release Stock Reservations
                const orderItems = await tx.orderItem.findMany({
                    where: { orderId: order.id }
                });

                for (const item of orderItems) {
                    if (item.productId) {
                        const stock = await tx.stock.findFirst({
                            where: { productId: item.productId },
                            orderBy: { reservedQty: 'desc' }
                        });
                        
                        if (stock) {
                            await tx.stock.update({
                                where: { id: stock.id },
                                data: { 
                                    reservedQty: { 
                                        decrement: Math.min(Number(item.quantity), stock.reservedQty) 
                                    } 
                                }
                            });
                        }
                    }
                }
            });

            fastify.log.info(`[OrderTask] Order ${order.orderNumber} (${order.id}) cancelled automatically.`);
            
            // Note: We could trigger an email here, but for now we'll stick to the log.
            
        } catch (err: any) {
            fastify.log.error(`[OrderTask] Failed to cancel order ${order.orderNumber}: ${err.message}`);
        }
    }
}
