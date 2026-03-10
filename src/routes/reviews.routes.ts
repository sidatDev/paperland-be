import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function reviewsRoutes(fastify: FastifyInstance) {
  
  // 1. GET /api/v1/admin/reviews - List all reviews
  fastify.get('/admin/reviews', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_view')], // Using product_view as a fallback if review_view doesn't exist
    schema: {
      description: 'List all reviews for admin',
      tags: ['Admin Reviews'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const reviews = await (fastify.prisma as any).review.findMany({
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return createResponse(reviews);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // 2. POST /api/v1/admin/reviews - Create a new review (Admin Only)
  fastify.post('/admin/reviews', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Create a new review (Admin Only)',
      tags: ['Admin Reviews'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId', 'rating'],
        properties: {
          productId: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          customerName: { type: 'string' },
          customerLocation: { type: 'string' },
          customerImageUrl: { type: 'string' },
          isVerified: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      const review = await (fastify.prisma as any).review.create({
        data: {
          productId: body.productId,
          rating: body.rating,
          comment: body.comment,
          customerName: body.customerName,
          customerLocation: body.customerLocation,
          customerImageUrl: body.customerImageUrl,
          isVerified: body.isVerified ?? false,
        }
      });
      return createResponse(review, 'Review created successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // 3. PUT /api/v1/admin/reviews/:id - Update a review
  fastify.put('/admin/reviews/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Update a review',
      tags: ['Admin Reviews'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          customerName: { type: 'string' },
          customerLocation: { type: 'string' },
          customerImageUrl: { type: 'string' },
          isVerified: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      
      const review = await (fastify.prisma as any).review.update({
        where: { id },
        data: body
      });
      return createResponse(review, 'Review updated successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // 4. DELETE /api/v1/admin/reviews/:id - Delete a review
  fastify.delete('/admin/reviews/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Delete a review',
      tags: ['Admin Reviews'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await (fastify.prisma as any).review.delete({ where: { id } });
      return createResponse(null, 'Review deleted successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
