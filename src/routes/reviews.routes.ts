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
      const { status } = request.query as any;
      const where: any = {};
      if (status) {
        where.status = status;
      }

      const reviews = await (fastify.prisma as any).review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, imageUrl: true } },
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
          status: 'APPROVED', // Admin created reviews are auto-approved
          images: body.images || []
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

  // 5. POST /api/v1/reviews/submit - Customer Review Submission (Authenticated)
  fastify.post('/reviews/submit', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Submit a product review as a customer',
      tags: ['Reviews'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['productId', 'rating'],
        properties: {
          productId: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { productId, rating, comment, images } = request.body as any;

      // Rule: Check if the user has a "DELIVERED" order with this product
      const deliveredOrder = await (fastify.prisma as any).order.findFirst({
        where: {
          userId: user.id,
          status: 'DELIVERED',
          items: {
            some: { productId }
          }
        }
      });

      if (!deliveredOrder) {
        return reply.status(403).send(createErrorResponse('You can only review products from delivered orders.'));
      }

      // Check if user already reviewed this product
      const existingReview = await (fastify.prisma as any).review.findFirst({
        where: {
          userId: user.id,
          productId
        }
      });

      if (existingReview) {
        return reply.status(400).send(createErrorResponse('You have already reviewed this product.'));
      }

      const review = await (fastify.prisma as any).review.create({
        data: {
          userId: user.id,
          productId,
          rating,
          comment,
          images: images || [],
          customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
          isVerified: true, // Tied to a delivered order
          status: 'PENDING', // Customer reviews start as PENDING for moderation
        }
      });

      return createResponse(review, 'Review submitted and pending approval.');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // 6. PATCH /api/v1/admin/reviews/:id/status - Moderate a review (Approve/Reject)
  fastify.patch('/admin/reviews/:id/status', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      description: 'Approve or reject a review',
      tags: ['Admin Reviews'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'PENDING'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;

      const review = await (fastify.prisma as any).review.update({
        where: { id },
        data: { status }
      });

      return createResponse(review, `Review ${status.toLowerCase()} successfully`);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
