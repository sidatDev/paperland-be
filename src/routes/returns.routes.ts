/** Return Management Routes */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../utils/audit';

const returnRequestSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  refundAmount: z.number().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
    condition: z.string().optional(),
  })),
});

const returnStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'PICKED', 'REFUNDED', 'REJECTED']),
  notes: z.string().optional(),
  trackingNumber: z.string().optional(),
  refundAmount: z.number().optional(),
});

const returnRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

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

  // POST /admin/returns - Manual create
  fastify.post('/admin/returns', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const validatedBody = returnRequestSchema.parse(request.body);
    const { orderId, userId, reason, notes, refundAmount, items } = validatedBody;

    try {
      const returnRequest = await (fastify.prisma as any).returnRequest.create({
        data: {
          orderId,
          userId,
          reason,
          notes,
          refundAmount,
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

      await logActivity(fastify, {
        entityType: 'RETURN',
        entityId: returnRequest.id,
        action: 'CREATE',
        performedBy: (request as any).user?.id,
        details: { returnRequest }
      });

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

      const updated = await (fastify.prisma as any).returnRequest.update({
        where: { id },
        data: { 
          status, 
          notes: notes || current.notes,
          trackingNumber: trackingNumber || current.trackingNumber,
          refundAmount: refundAmount !== undefined ? refundAmount : current.refundAmount
        }
      });

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
