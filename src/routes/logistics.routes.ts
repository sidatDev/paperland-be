import { FastifyInstance } from 'fastify';

export default async function logisticsRoutes(fastify: FastifyInstance) {

  // GET all delivery agents (Admin)
  fastify.get('/admin/logistics/agents', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_view')],
    schema: {
      tags: ['Admin Logistics'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const agents = await (fastify.prisma as any).deliveryAgent.findMany({
        orderBy: { name: 'asc' }
      });
      return reply.send(agents);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch delivery agents' });
    }
  });

  // POST create a new delivery agent
  fastify.post('/admin/logistics/agents', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')],
    schema: {
      tags: ['Admin Logistics'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'phone'],
        properties: {
          name: { type: 'string', minLength: 2 },
          phone: { type: 'string', pattern: '^03[0-9]{9}$' },
          cnic: { type: 'string', pattern: '^[0-9]{13}$' },
          city: { type: 'string', default: 'Karachi' },
          isActive: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name, phone, cnic, city, isActive } = request.body as any;

      const agent = await (fastify.prisma as any).deliveryAgent.create({
        data: { name, phone, cnic, city, isActive }
      });

      return reply.status(201).send(agent);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to create delivery agent' });
    }
  });

  // PUT update a delivery agent
  fastify.put('/admin/logistics/agents/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')],
    schema: {
      tags: ['Admin Logistics'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          cnic: { type: 'string' },
          city: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;

      const updated = await (fastify.prisma as any).deliveryAgent.update({
        where: { id },
        data
      });

      return reply.send(updated);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update delivery agent' });
    }
  });

  // GET courier tracking (Placeholder for actual courier integration list)
  fastify.get('/admin/logistics/tracking', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_view')],
    schema: {
      tags: ['Admin Logistics'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      // In a real scenario, this might fetch from an OrderShipment table or external API.
      // For now, we'll return a placeholder or list of recent shipments from Order.
      const shipments = await (fastify.prisma as any).order.findMany({
        where: {
          status: { in: ['SHIPPED', 'DELIVERED'] }
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          updatedAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        take: 50,
        orderBy: { updatedAt: 'desc' }
      });
      return reply.send(shipments);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch tracking data' });
    }
  });

}
