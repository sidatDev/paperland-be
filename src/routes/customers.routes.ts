import { FastifyInstance } from 'fastify';

export default async function customerRoutes(fastify: FastifyInstance) {

  // GET all call logs (Admin)
  fastify.get('/admin/customers/calls', {
    preHandler: [fastify.authenticate, fastify.hasPermission('crm_view')],
    schema: {
      tags: ['Admin Customers'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { orderId } = request.query as any;
      const logs = await (fastify.prisma as any).orderCallLog.findMany({
        where: orderId ? { orderId } : {},
        include: {
          agent: {
            select: { name: true }
          }
        },
        orderBy: { calledAt: 'desc' }
      });
      return reply.send(logs);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch call logs' });
    }
  });

  // POST create a new call log
  fastify.post('/admin/customers/calls', {
    preHandler: [fastify.authenticate, fastify.hasPermission('crm_manage')],
    schema: {
      tags: ['Admin Customers'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['orderId', 'callType'],
        properties: {
          orderId: { type: 'string' },
          agentId: { type: 'string' },
          callType: { type: 'string', enum: ['PRE_DISPATCH', 'POST_DELIVERY'] },
          outcome: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { orderId, agentId, callType, outcome, notes } = request.body as any;

      const log = await (fastify.prisma as any).orderCallLog.create({
        data: {
          orderId,
          agentId,
          callType,
          outcome,
          notes,
          calledAt: new Date()
        }
      });

      return reply.status(201).send(log);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to create call log' });
    }
  });

  // GET all security deposits (Admin)
  fastify.get('/admin/customers/deposits', {
    preHandler: [fastify.authenticate, fastify.hasPermission('crm_view')],
    schema: {
      tags: ['Admin Customers'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const deposits = await (fastify.prisma as any).securityDeposit.findMany({
        include: {
          b2bProfile: {
            select: {
              companyName: true
            }
          }
        },
        orderBy: { depositDate: 'desc' }
      });
      return reply.send(deposits);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch security deposits' });
    }
  });

  // POST record a new security deposit
  fastify.post('/admin/customers/deposits', {
    preHandler: [fastify.authenticate, fastify.hasPermission('crm_manage')],
    schema: {
      tags: ['Admin Customers'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['b2bProfileId', 'amount', 'depositDate'],
        properties: {
          b2bProfileId: { type: 'string' },
          amount: { type: 'number', minimum: 0 },
          depositDate: { type: 'string' },
          receiptUrl: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { b2bProfileId, amount, depositDate, receiptUrl, notes } = request.body as any;

      const deposit = await (fastify.prisma as any).securityDeposit.create({
        data: {
          b2bProfileId,
          amount,
          depositDate: new Date(depositDate),
          receiptUrl,
          notes,
          status: 'ACTIVE'
        }
      });

      return reply.status(201).send(deposit);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to record security deposit' });
    }
  });

  // PUT update deposit status
  fastify.put('/admin/customers/deposits/:id/status', {
    preHandler: [fastify.authenticate, fastify.hasPermission('crm_manage')],
    schema: {
      tags: ['Admin Customers'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'REFUNDED', 'FORFEITED'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { status } = request.body as any;

      const updated = await (fastify.prisma as any).securityDeposit.update({
        where: { id },
        data: { status }
      });

      return reply.send(updated);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update deposit status' });
    }
  });

}
