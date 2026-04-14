
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
        // Fetch user's catalogs for initial validation
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                company: {
                    include: {
                        catalogs: {
                            where: {
                                catalog: {
                                    isActive: true,
                                    deletedAt: null,
                                    OR: [
                                        { validFrom: null, validUntil: null },
                                        {
                                            validFrom: { lte: new Date() },
                                            validUntil: { gte: new Date() }
                                        }
                                    ]
                                }
                            },
                            select: { catalogId: true }
                        }
                    }
                }
            }
        });

        const catalogIds = user?.company?.catalogs.map((c: any) => c.catalogId) || [];

        await prisma.$transaction(async (tx) => {
            if (userCart) {
                // MERGE: Move items from guest cart to user cart
                const MAX_QUANTITY = 99999;
                
                for (const item of guestCart.items) {
                    let status = 'VALID';
                    let selectedCatalogId: string | null = null;

                    if (catalogIds.length > 0) {
                        const catalogProduct = await tx.catalogProduct.findFirst({
                            where: { productId: item.productId, catalogId: { in: catalogIds } }
                        });

                        if (!catalogProduct) {
                            status = 'INVALID_CATALOG';
                        } else {
                            selectedCatalogId = catalogProduct.catalogId;
                            const catalogPricing = await tx.catalogPricing.findFirst({
                                where: { variantId: item.productId, catalogId: { in: catalogIds } },
                                
                            });
                            if (catalogPricing && item.quantity < catalogPricing.minimumQuantity) {
                                status = 'INVALID_MOQ';
                            }
                        }
                    }

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
                            data: { 
                                quantity: newQuantity,
                                status,
                                catalogId: selectedCatalogId
                            }
                        });
                    } else {
                        await tx.cartItem.create({
                            data: {
                                cartId: userCart.id,
                                productId: item.productId,
                                quantity: Math.min(item.quantity, MAX_QUANTITY),
                                priceSnapshot: item.priceSnapshot,
                                status,
                                catalogId: selectedCatalogId
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
                // ASSIGN: Simply re-assign guest cart to user and validate items
                await tx.cart.update({
                    where: { id: guestCart.id },
                    data: { 
                        userId: userId, 
                        guestToken: null 
                    }
                });

                // Re-validate assignment
                for (const item of guestCart.items) {
                    let status = 'VALID';
                    let selectedCatalogId: string | null = null;

                    if (catalogIds.length > 0) {
                        const catalogProduct = await tx.catalogProduct.findFirst({
                            where: { productId: item.productId, catalogId: { in: catalogIds } }
                        });

                        if (!catalogProduct) {
                            status = 'INVALID_CATALOG';
                        } else {
                            selectedCatalogId = catalogProduct.catalogId;
                            const catalogPricing = await tx.catalogPricing.findFirst({
                                where: { variantId: item.productId, catalogId: { in: catalogIds } },
                                
                            });
                            if (catalogPricing && item.quantity < catalogPricing.minimumQuantity) {
                                status = 'INVALID_MOQ';
                            }
                        }
                    }

                    await tx.cartItem.update({
                        where: { id: item.id },
                        data: { status, catalogId: selectedCatalogId }
                    });
                }
            }
        });
    } catch (error) {
        console.error("Failed to merge cart:", error);
        // Don't throw, just log. Login should succeed even if cart merge fails (critical UX).
    }
};

export const detachUserCart = async (prisma: PrismaClient, userId: string, guestToken: string) => {
    if (!userId || !guestToken) return;

    try {
        const userCart = await prisma.cart.findFirst({
            where: { userId, status: 'ACTIVE' }
        });

        if (!userCart) return;

        await prisma.cart.update({
            where: { id: userCart.id },
            data: {
                userId: null,
                guestToken: guestToken
            }
        });
    } catch (error) {
        console.error("Failed to detach cart:", error);
    }
};

