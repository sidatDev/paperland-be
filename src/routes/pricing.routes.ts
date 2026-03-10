import { FastifyInstance } from 'fastify';

export default async function pricingRoutes(fastify: FastifyInstance) {

  // GET all discount tiers
  fastify.get('/admin/pricing/tiers', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_view')],
    schema: {
      tags: ['Admin Pricing'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const tiers = await fastify.prisma.discountTier.findMany({
        orderBy: { discountPercent: 'desc' }
      });
      return reply.send(tiers);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch discount tiers' });
    }
  });

  // POST create a new discount tier
  fastify.post('/admin/pricing/tiers', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      tags: ['Admin Pricing'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'discountPercent'],
        properties: {
          name: { type: 'string' },
          discountPercent: { type: 'number', minimum: 0, maximum: 100 },
          isActive: { type: 'boolean', default: true },
          exemptSkus: { type: 'array', items: { type: 'string' }, default: [] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { name, discountPercent, isActive, exemptSkus } = request.body as any;

      const existing = await fastify.prisma.discountTier.findUnique({
        where: { name }
      });

      if (existing) {
        return reply.status(400).send({ message: 'A discount tier with this name already exists' });
      }

      const tier = await fastify.prisma.discountTier.create({
        data: {
          name,
          discountPercent,
          isActive: isActive !== undefined ? isActive : true,
          exemptSkus: exemptSkus || []
        }
      });

      return reply.status(201).send(tier);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to create discount tier' });
    }
  });

  // PUT update a discount tier
  fastify.put('/admin/pricing/tiers/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      tags: ['Admin Pricing'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          discountPercent: { type: 'number', minimum: 0, maximum: 100 },
          isActive: { type: 'boolean' },
          exemptSkus: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { name, discountPercent, isActive, exemptSkus } = request.body as any;

      const tier = await fastify.prisma.discountTier.findUnique({ where: { id } });
      if (!tier) return reply.status(404).send({ message: 'Discount tier not found' });

      if (name && name !== tier.name) {
        const existing = await fastify.prisma.discountTier.findUnique({ where: { name } });
        if (existing) {
          return reply.status(400).send({ message: 'A discount tier with this name already exists' });
        }
      }

      const updated = await fastify.prisma.discountTier.update({
        where: { id },
        data: {
          name,
          discountPercent,
          isActive,
          exemptSkus
        }
      });

      return reply.send(updated);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update discount tier' });
    }
  });

  // DELETE a discount tier
  fastify.delete('/admin/pricing/tiers/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('customer_manage')],
    schema: {
      tags: ['Admin Pricing'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;

      // Check if tier is currently assigned to any B2B Profiles
      const usersWithTier = await fastify.prisma.b2BProfile.count({
        where: { discountTierId: id }
      });

      if (usersWithTier > 0) {
        return reply.status(400).send({ message: 'Cannot delete tier because it is assigned to customers. Please reassign them first.' });
      }

      await fastify.prisma.discountTier.delete({
        where: { id }
      });

      return reply.send({ success: true, message: 'Discount tier deleted successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to delete discount tier' });
    }
  });

}
