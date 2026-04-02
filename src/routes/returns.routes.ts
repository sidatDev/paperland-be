/** Return Management Routes */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../utils/audit';

const returnRequestSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  images: z.array(z.string()).default([]),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
    condition: z.string().optional(),
  })),
});

const returnStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'PICKED', 'REFUNDED', 'REJECTED', 'CANCELLED']),
  notes: z.string().optional(),
  trackingNumber: z.string().optional(),
  refundAmount: z.coerce.number().optional(),
});

const returnRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // --- PUBLIC / CUSTOMER ROUTES ---

  // POST /returns/request - Customer initiates a return
  fastify.post('/returns/request', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const validatedBody = returnRequestSchema.parse(request.body);
    const { orderId, reason, notes, images, items } = validatedBody;
    const userId = (request.user as any).id;

    try {
      const order = await (fastify.prisma as any).order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) return reply.code(404).send({ error: 'Order not found' });
      if (order.userId !== userId) return reply.code(403).send({ error: 'Unauthorized order access' });
      
      // Calculate automatic refund amount
      let totalRefund = 0;
      for (const returnItem of items) {
        const orderItem = order.items.find((oi: any) => oi.productId === returnItem.productId);
        if (orderItem) {
          totalRefund += Number(orderItem.price) * returnItem.quantity;
        }
      }

      const returnRequest = await (fastify.prisma as any).returnRequest.create({
        data: {
          orderId,
          userId,
          reason,
          notes,
          images,
          refundAmount: totalRefund,
          status: 'PENDING',
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              condition: item.condition
            }))
          }
        }
      });

      // Update order status to RETURN_REQUESTED
      await (fastify.prisma as any).order.update({
        where: { id: orderId },
        data: { status: 'RETURN_REQUESTED' }
      });

      await logActivity(fastify, {
        entityType: 'RETURN',
        entityId: returnRequest.id,
        action: 'CREATE',
        performedBy: userId,
        details: { returnRequest }
      });

      return returnRequest;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /returns - Customer's return history
  fastify.get('/returns', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request.user as any).id;
    try {
      const returns = await (fastify.prisma as any).returnRequest.findMany({
        where: { userId, deletedAt: null },
        include: {
          order: { select: { orderNumber: true } },
          items: { include: { product: { select: { name: true, imageUrl: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return returns;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // --- ADMIN ROUTES ---

  // GET /admin/returns - List all return requests
  fastify.get('/admin/returns', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { status, page = 1, limit = 10 } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = { deletedAt: null };
      if (status) where.status = status;

      const [returns, total] = await Promise.all([
        (fastify.prisma as any).returnRequest.findMany({
          where,
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            order: { select: { orderNumber: true } },
            items: { include: { product: { select: { name: true, sku: true } } } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take
        }),
        (fastify.prisma as any).returnRequest.count({ where })
      ]);

      return { returns, total, page: Number(page), limit: Number(limit) };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /admin/returns/:id - Get detail
  fastify.get('/admin/returns/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      const returnRequest = await (fastify.prisma as any).returnRequest.findUnique({
        where: { id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
          order: { include: { items: true } },
          items: { include: { product: { select: { name: true, sku: true, imageUrl: true } } } }
        }
      });

      if (!returnRequest) return reply.code(404).send({ error: 'Return request not found' });
      return returnRequest;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PATCH /admin/returns/:id/status - Update status lifecycle
  fastify.patch('/admin/returns/:id/status', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { status, notes, trackingNumber, refundAmount } = returnStatusSchema.parse(request.body);

    try {
      const current = await (fastify.prisma as any).returnRequest.findUnique({ where: { id } });
      if (!current) return reply.code(404).send({ error: 'Return request not found' });

      // Guard: Cannot change status once REFUNDED
      if (current.status === 'REFUNDED') {
        return reply.code(400).send({ error: 'This return request has already been finalized as REFUNDED and cannot be modified.' });
      }

      const updated = await (fastify.prisma as any).returnRequest.update({
        where: { id },
        data: { 
          status, 
          notes: notes || current.notes,
          trackingNumber: trackingNumber || current.trackingNumber,
          refundAmount: refundAmount !== undefined ? refundAmount : current.refundAmount
        }
      });

      // SYNC Order status if needed
      if (status === 'REFUNDED') {
        await (fastify.prisma as any).order.update({
          where: { id: current.orderId },
          data: { status: 'REFUNDED' }
        });
      } else if (status === 'CANCELLED' || status === 'REJECTED') {
         // Optionally revert logic or leave as is
         if (status === 'CANCELLED') {
           await (fastify.prisma as any).order.update({
             where: { id: current.orderId },
             data: { status: 'CANCELLED' }
           });
         }
      }

      await logActivity(fastify, {
        entityType: 'RETURN',
        entityId: id,
        action: 'UPDATE_STATUS',
        performedBy: (request as any).user?.id,
        details: { oldStatus: current.status, newStatus: status, notes }
      });

      return updated;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
};

export default returnRoutes;
