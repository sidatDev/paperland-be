import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { PricingEngine } from '../utils/pricing.engine';

export default async function cartRoutes(fastify: FastifyInstance) {
  
  // Helper to find cart
  const findCart = async (request: any, includeItems = true) => {
    let userId = request.user?.id;
    const guestToken = (request.query as any)?.guestToken || (request.body as any)?.guestToken;

    if (!userId && !guestToken) return null;

    const whereClause: any = { status: 'ACTIVE' };
    
    if (userId && guestToken) {
        whereClause.OR = [{ userId }, { guestToken }];
    } else if (userId) {
        whereClause.userId = userId;
    } else if (guestToken) {
        whereClause.guestToken = guestToken;
    } else {
        return null;
    }

    return await fastify.prisma.cart.findFirst({
        where: whereClause,
        include: includeItems ? { 
            items: { 
                orderBy: { createdAt: 'desc' },
                include: { 
                    product: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            imageUrl: true,
                            prices: {
                                where: { isActive: true },
                                take: 1,
                                include: { currency: true }
                            },
                            stocks: true
                        }
                    } 
                } 
            } 
        } : undefined
    });
  };

  // Helper to calculate totals
  const calculateCartTotals = async (cart: any, userId?: string) => {
    if (!cart || !cart.items) return { subtotal: 0, tax: 0, total: 0, count: 0 };
    
    const pricedItems = await PricingEngine.calculateBulkPrices(
        fastify.prisma as any,
        cart.items.map((item: any) => {
            const pkr = item.product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
            return {
                productId: item.productId,
                basePrice: pkr ? Number(pkr.priceRetail) : Number(item.product.prices?.[0]?.priceRetail || item.product.price || 0),
                sku: item.product.sku
            };
        }),
        userId
    );

    let subtotal = 0;
    pricedItems.forEach((item: any, idx: number) => {
        const qty = cart.items[idx].quantity;
        subtotal += item.finalPrice * qty;
    });

    // Simple tax logic (e.g., 15%)
    const taxRate = 0.15; 
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    return {
        subtotal: Number(subtotal.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        total: Number(total.toFixed(2)),
        count: cart.items.reduce((acc: number, item: any) => acc + item.quantity, 0),
        pricedItems // Return for mapping
    };
  };

  // Helper to invalidate draft orders when cart changes
  const invalidateDraftOrder = async (userId: string | undefined) => {
    if (!userId) return;
    
    // Find draft orders for this user
    const draftOrders = await fastify.prisma.order.findMany({
        where: { userId, status: 'DRAFT' },
        select: { id: true }
    });

    if (draftOrders.length > 0) {
        const ids = draftOrders.map((o: any) => o.id);
        // Delete items first due to FK constraints
        await fastify.prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
        await fastify.prisma.order.deleteMany({ where: { id: { in: ids } } });
        fastify.log.info({ userId, draftOrderIds: ids }, "Invalidated draft orders due to cart change");
    }
  };

  // GET Cart
  fastify.get('/cart', {
    schema: {
        description: 'Get current cart items with totals',
        tags: ['Cart'],
        querystring: {
            type: 'object',
            properties: {
                guestToken: { type: 'string' }
            }
        }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const cart = await findCart(request);
        const totals = await calculateCartTotals(cart, (request as any).user?.id);
        
        const items = (cart && totals.pricedItems) ? (cart as any).items.map((item: any, idx: number) => {
            const priced = totals.pricedItems![idx];
            return {
                ...item,
                price: priced.finalPrice,
                originalPrice: priced.basePrice !== priced.finalPrice ? priced.basePrice : undefined
            };
        }) : [];

        return createResponse({
            id: cart?.id,
            items: items,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            count: totals.count
        }, "Cart Retrieved");
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET Cart Count
  fastify.get('/cart/count', {
      schema: {
          description: 'Get total number of items in cart',
          tags: ['Cart'],
          querystring: {
              type: 'object',
              properties: {
                  guestToken: { type: 'string' }
              }
          }
      }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
          const cart = await findCart(request);
          const count = (cart as any)?.items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0;
          return createResponse({ count }, "Cart count retrieved");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // POST Add to Cart
  fastify.post('/cart/add', {
    schema: {
        description: 'Add item to cart',
        tags: ['Cart'],
        body: {
            type: 'object',
            required: ['productId', 'quantity'],
            properties: {
                productId: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 },
                guestToken: { type: 'string' }
            }
        }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { productId, quantity, guestToken } = request.body as any;
        const userId = (request as any).user?.id;

        if (!userId && !guestToken) {
            return reply.status(400).send(createErrorResponse("Either Guest Token or Login required"));
        }

        // 1. Find or Create Cart
        const orConditions: any[] = [];
        if (userId) orConditions.push({ userId });
        if (guestToken) orConditions.push({ guestToken });

        let cart = await fastify.prisma.cart.findFirst({
            where: {
                status: 'ACTIVE',
                OR: orConditions
            }
        });

        if (!cart) {
            cart = await fastify.prisma.cart.create({
                data: {
                    userId: userId || null,
                    guestToken: userId ? null : guestToken,
                    status: 'ACTIVE'
                }
            });
        }

        // 2. Check Product
        const product = await fastify.prisma.product.findUnique({ 
            where: { id: productId },
            include: { prices: { where: { isActive: true }, take: 1 }, stocks: true }
        });
        if (!product) return reply.status(404).send(createErrorResponse("Product not found"));

        // Check if manually marked as out of stock
        if (product.status === 'Out of Stock' || (product.specifications as any)?.status === 'Out of Stock') {
            return reply.status(400).send(createErrorResponse("This item is currently out of stock."));
        }

        // 3. Upsert Cart Item
        const existingItem = await fastify.prisma.cartItem.findFirst({
            where: { cartId: cart.id, productId }
        });

        const currentPrice = (product as any).prices?.[0]?.priceRetail || 0;
        const availableStock = Math.max(0, (product as any).stocks?.reduce((acc: number, s: any) => acc + (s.qty - s.reservedQty), 0) || 0);

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > availableStock) {
                return reply.status(400).send(
                    createErrorResponse(`Cannot add more. Only ${availableStock} items available in stock.`)
                );
            }
            
            await fastify.prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: newQuantity }
            });
        } else {
            if (quantity > availableStock) {
                return reply.status(400).send(
                    createErrorResponse(`Only ${availableStock} items available in stock.`)
                );
            }
            
            await fastify.prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    quantity,
                    priceSnapshot: currentPrice
                } as any
            });
        }

        // Invalidate any existing checkout drafts
        await invalidateDraftOrder(userId);

        // Return updated cart by explicit ID to avoid any session/token mismatches
        const updatedCart = await fastify.prisma.cart.findUnique({
            where: { id: cart.id },
            include: { 
                items: { 
                    orderBy: { createdAt: 'desc' },
                    include: { 
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                imageUrl: true,
                                prices: {
                                    where: { isActive: true },
                                    take: 1
                                },
                                stocks: true
                            }
                        } 
                    } 
                } 
            }
        });

        const totals = await calculateCartTotals(updatedCart, userId);

        const items = (updatedCart && totals.pricedItems) ? (updatedCart as any).items.map((item: any, idx: number) => {
            const priced = totals.pricedItems![idx];
            return {
                ...item,
                price: priced.finalPrice,
                originalPrice: priced.basePrice !== priced.finalPrice ? priced.basePrice : undefined
            };
        }) : [];

        fastify.log.info({ cartId: cart.id, itemsCount: (updatedCart as any)?.items?.length }, "Add to cart result");

        return createResponse({
            items: items,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            count: totals.count
        }, "Item added to cart");

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // PUT Update Item
  fastify.put('/cart/items/:id', {
      schema: {
          description: 'Update cart item quantity',
          tags: ['Cart'],
          params: {
              type: 'object',
              properties: {
                  id: { type: 'string' }
              }
          },
          body: {
              type: 'object',
              required: ['quantity'],
              properties: {
                  quantity: { type: 'integer', minimum: 0 } // Allow 0 to remove
              }
          }
      }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { id } = request.params as any;
        const { quantity } = request.body as any;

        // Handle quantity = 0 as delete
        if (quantity === 0) {
            await fastify.prisma.cartItem.delete({ where: { id } });
            return createResponse(null, "Item removed from cart");
        }

        const item = await fastify.prisma.cartItem.findUnique({ 
            where: { id },
            include: { cart: true, product: { include: { stocks: true } } }
        });

        if (!item) return reply.status(404).send(createErrorResponse("Item not found"));

        const availableStock = Math.max(0, item.product.stocks?.reduce((acc: number, s: any) => acc + (s.qty - s.reservedQty), 0) || 0);

        if (quantity > availableStock) {
            return reply.status(400).send(
                createErrorResponse(`Only ${availableStock} items available in stock.`)
            );
        }

        await fastify.prisma.cartItem.update({
            where: { id },
            data: { quantity }
        });

        // Invalidate any existing checkout drafts
        if ((item as any)?.cart?.userId) {
            await invalidateDraftOrder((item as any).cart.userId);
        }

        return createResponse(null, "Cart item updated");
    } catch (err: any) {
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // DELETE Remove Item
  fastify.delete('/cart/items/:id', {
      schema: {
          description: 'Remove item from cart',
          tags: ['Cart'],
          params: {
              type: 'object',
              properties: {
                  id: { type: 'string' }
              }
          }
      }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
          const { id } = request.params as any;
          
          const item = await fastify.prisma.cartItem.findUnique({ 
              where: { id },
              include: { cart: true }
          });
          
          await fastify.prisma.cartItem.delete({ where: { id } });

          if ((item as any)?.cart?.userId) {
              await invalidateDraftOrder((item as any).cart.userId);
          }

          return createResponse(null, "Item removed");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // POST Clear Cart
  fastify.post('/cart/clear', {
      schema: {
          description: 'Clear all items from cart',
          tags: ['Cart'],
          body: {
              type: 'object',
              properties: {
                  guestToken: { type: 'string' }
              }
          }
      }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
          const cart = await findCart(request, false); // Don't need items to delete them
          if (cart) {
              await fastify.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
              
              if (cart.userId) {
                  await invalidateDraftOrder(cart.userId);
              }

              return createResponse(null, "Cart cleared");
          }
          return createResponse(null, "Cart already empty");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });
}
