import { FastifyInstance } from 'fastify';

/**
 * Merge guest cart into user cart after successful login/signup
 * NO DATABASE SCHEMA CHANGES - Pure application logic
 */
export async function mergeGuestCartToUser(
  fastify: FastifyInstance,
  userId: string,
  guestToken?: string
): Promise<void> {
  if (!guestToken) {
    fastify.log.info({ userId }, 'No guest token provided, skipping cart merge');
    return;
  }

  try {
    // Find guest cart
    const guestCart = await fastify.prisma.cart.findFirst({
      where: { guestToken, status: 'ACTIVE' },
      include: { items: true }
    });

    if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
      fastify.log.info({ userId, guestToken }, 'No active guest cart found or cart is empty');
      return;
    }

    fastify.log.info(
      { userId, guestToken, itemCount: guestCart.items.length },
      'Found guest cart to merge'
    );

    // Find user's existing cart
    let userCart = await fastify.prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { items: true }
    });

    // Case 1: User has no active cart - Transfer guest cart to user
    if (!userCart) {
      await fastify.prisma.cart.update({
        where: { id: guestCart.id },
        data: {
          userId,
          guestToken: null, // Clear guest token
          status: 'ACTIVE'
        }
      });

      fastify.log.info({ userId, cartId: guestCart.id }, 'Guest cart transferred to user');
      return;
    }

    // Case 2: User has active cart - Merge items
    fastify.log.info(
      { userId, userCartId: userCart.id, guestCartId: guestCart.id },
      'Merging guest cart into user cart'
    );

    for (const guestItem of guestCart.items) {
      const existingUserItem = userCart.items.find(
        (item) => item.productId === guestItem.productId
      );

      if (existingUserItem) {
        // Product exists in both carts - Sum quantities
        const newQuantity = existingUserItem.quantity + guestItem.quantity;
        const MAX_QUANTITY = 99999;
        const finalQuantity = Math.min(newQuantity, MAX_QUANTITY);

        await fastify.prisma.cartItem.update({
          where: { id: existingUserItem.id },
          data: { quantity: finalQuantity }
        });

        fastify.log.info(
          {
            productId: guestItem.productId,
            oldQty: existingUserItem.quantity,
            addedQty: guestItem.quantity,
            newQty: finalQuantity
          },
          'Merged cart item quantities'
        );
      } else {
        // Product only in guest cart - Move to user cart
        await fastify.prisma.cartItem.update({
          where: { id: guestItem.id },
          data: { cartId: userCart.id }
        });

        fastify.log.info({ productId: guestItem.productId }, 'Moved item to user cart');
      }
    }

    // Mark guest cart as converted
    await fastify.prisma.cart.update({
      where: { id: guestCart.id },
      data: { status: 'CONVERTED' }
    });

    fastify.log.info({ userId, guestCartId: guestCart.id }, 'Guest cart marked as CONVERTED');
  } catch (err: any) {
    // Don't fail login/signup if cart merge fails - just log error
    fastify.log.error(
      { err, userId, guestToken },
      'Failed to merge guest cart, but continuing with login/signup'
    );
  }
}
