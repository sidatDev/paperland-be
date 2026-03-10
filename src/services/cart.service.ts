
import { PrismaClient } from '@prisma/client';

export const mergeGuestCart = async (prisma: PrismaClient, userId: string, guestToken: string) => {
    if (!guestToken) return;

    // 1. Find Guest Cart
    const guestCart = await prisma.cart.findFirst({ 
        where: { guestToken, status: 'ACTIVE' },
        include: { items: true }
    });

    if (!guestCart) return;

    // 2. Find User Cart
    const userCart = await prisma.cart.findFirst({ 
        where: { userId, status: 'ACTIVE' } 
    });

    try {
        await prisma.$transaction(async (tx) => {
            if (userCart) {
                // MERGE: Move items from guest cart to user cart
                const MAX_QUANTITY = 99999;
                
                for (const item of guestCart.items) {
                    const existingItem = await tx.cartItem.findFirst({
                        where: { cartId: userCart.id, productId: item.productId }
                    });

                    if (existingItem) {
                        // Cap at max quantity when merging
                        const newQuantity = Math.min(
                            existingItem.quantity + item.quantity,
                            MAX_QUANTITY
                        );
                        
                        await tx.cartItem.update({
                            where: { id: existingItem.id },
                            data: { quantity: newQuantity }
                        });
                    } else {
                        await tx.cartItem.create({
                            data: {
                                cartId: userCart.id,
                                productId: item.productId,
                                quantity: Math.min(item.quantity, MAX_QUANTITY),
                                priceSnapshot: item.priceSnapshot // Preserve original price snapshot if available
                            }
                        });
                    }
                }

                // Cleanup Guest Cart
                await tx.cartItem.deleteMany({ where: { cartId: guestCart.id } });
                await tx.cart.update({
                    where: { id: guestCart.id },
                    data: { status: 'CONVERTED' } // Mark as converted instead of deleting for audit
                });

            } else {
                // ASSIGN: Simply re-assign guest cart to user
                await tx.cart.update({
                    where: { id: guestCart.id },
                    data: { 
                        userId: userId, 
                        guestToken: null 
                    }
                });
            }
        });
    } catch (error) {
        console.error("Failed to merge cart:", error);
        // Don't throw, just log. Login should succeed even if cart merge fails (critical UX).
    }
};
