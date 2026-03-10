import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function wishlistRoutes(fastify: FastifyInstance) {

  // Helper: get or create wishlist for user
  const getOrCreateWishlist = async (userId: string) => {
    let wishlist = await fastify.prisma.wishlist.findUnique({
      where: { userId },
    });
    if (!wishlist) {
      wishlist = await fastify.prisma.wishlist.create({
        data: { userId },
      });
    }
    return wishlist;
  };

  // GET /wishlist — get user's wishlist items
  fastify.get('/wishlist', {
    schema: {
      description: 'Get user wishlist items',
      response: {
        200: { type: 'object', additionalProperties: true },
        500: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send(createErrorResponse('Unauthorized'));

      const wishlist = await fastify.prisma.wishlist.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  brand: { select: { id: true, name: true, slug: true } },
                  category: { select: { id: true, name: true, slug: true } },
                  prices: true,
                  stocks: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return reply.send(createResponse(wishlist?.items || []));
    } catch (error: any) {
      return reply.code(500).send(createErrorResponse(error.message));
    }
  });

  // POST /wishlist/add — add a product to wishlist
  fastify.post('/wishlist/add', {
    schema: {
      description: 'Add a product to wishlist',
      body: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        400: { type: 'object', additionalProperties: true },
        500: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send(createErrorResponse('Unauthorized'));

      const { productId } = request.body;

      // Verify product exists
      const product = await fastify.prisma.product.findUnique({ where: { id: productId } });
      if (!product) return reply.code(404).send(createErrorResponse('Product not found'));

      const wishlist = await getOrCreateWishlist(userId);

      // Check if already in wishlist
      const existing = await fastify.prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      });
      if (existing) return reply.send(createResponse({ message: 'Product already in wishlist' }));

      const item = await fastify.prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      });

      return reply.send(createResponse(item, 'Product added to wishlist'));
    } catch (error: any) {
      return reply.code(500).send(createErrorResponse(error.message));
    }
  });

  // DELETE /wishlist/remove/:productId — remove product from wishlist
  fastify.delete('/wishlist/remove/:productId', {
    schema: {
      description: 'Remove a product from wishlist',
      params: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        500: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send(createErrorResponse('Unauthorized'));

      const { productId } = request.params as { productId: string };

      const wishlist = await fastify.prisma.wishlist.findUnique({
        where: { userId },
      });
      if (!wishlist) return reply.send(createResponse({ message: 'Wishlist is empty' }));

      await fastify.prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id, productId },
      });

      return reply.send(createResponse(null, 'Product removed from wishlist'));
    } catch (error: any) {
      return reply.code(500).send(createErrorResponse(error.message));
    }
  });

  // GET /wishlist/check/:productId — check if product is in wishlist
  fastify.get('/wishlist/check/:productId', {
    schema: {
      description: 'Check if a product is in the user wishlist',
      params: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        500: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send(createErrorResponse('Unauthorized'));

      const { productId } = request.params as { productId: string };

      const wishlist = await fastify.prisma.wishlist.findUnique({
        where: { userId },
      });

      if (!wishlist) return reply.send(createResponse({ inWishlist: false }));

      const item = await fastify.prisma.wishlistItem.findUnique({
        where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      });

      return reply.send(createResponse({ inWishlist: !!item }));
    } catch (error: any) {
      return reply.code(500).send(createErrorResponse(error.message));
    }
  });

  // GET /wishlist/ids — get all product IDs in wishlist (for bulk heart icon state)
  fastify.get('/wishlist/ids', {
    schema: {
      description: 'Get all product IDs in user wishlist',
      response: {
        200: { type: 'object', additionalProperties: true },
        500: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send(createErrorResponse('Unauthorized'));

      const wishlist = await fastify.prisma.wishlist.findUnique({
        where: { userId },
        include: { items: { select: { productId: true } } },
      });

      const ids = wishlist?.items.map((i: any) => i.productId) || [];
      return reply.send(createResponse(ids));
    } catch (error: any) {
      return reply.code(500).send(createErrorResponse(error.message));
    }
  });
}
