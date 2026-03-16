import { FastifyInstance } from 'fastify';

export default async function referralRoutes(fastify: FastifyInstance) {

  // GET all referrals (Admin)
  fastify.get('/admin/referrals', {
    preHandler: [fastify.authenticate, fastify.hasPermission('marketing_view')],
    schema: {
      tags: ['Admin Referrals'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const referrals = await (fastify.prisma as any).customerReferral.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(referrals);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch referrals' });
    }
  });

  // GET referral program settings
  fastify.get('/admin/referrals/settings', {
    preHandler: [fastify.authenticate, fastify.hasPermission('marketing_view')],
    schema: {
      tags: ['Admin Referrals'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const settings = await (fastify.prisma as any).referralProgram.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(settings || { isActive: false, rewardAmount: 0, minOrderAmount: 0 });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch referral settings' });
    }
  });

  // PUT update referral program settings
  fastify.put('/admin/referrals/settings', {
    preHandler: [fastify.authenticate, fastify.hasPermission('marketing_manage')],
    schema: {
      tags: ['Admin Referrals'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['rewardAmount'],
        properties: {
          isActive: { type: 'boolean' },
          rewardAmount: { type: 'number', minimum: 0 },
          minOrderAmount: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { isActive, rewardAmount, minOrderAmount } = request.body as any;

      const existing = await (fastify.prisma as any).referralProgram.findFirst({
        orderBy: { createdAt: 'desc' }
      });

      let updated;
      if (existing) {
        updated = await (fastify.prisma as any).referralProgram.update({
          where: { id: existing.id },
          data: { isActive, rewardAmount, minOrderAmount }
        });
      } else {
        updated = await (fastify.prisma as any).referralProgram.create({
          data: { isActive, rewardAmount, minOrderAmount }
        });
      }

      return reply.send(updated);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update referral settings' });
    }
  });

  // POST mark a referral as rewarded
  fastify.post('/admin/referrals/:id/mark-rewarded', {
    preHandler: [fastify.authenticate, fastify.hasPermission('marketing_manage')],
    schema: {
      tags: ['Admin Referrals'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;

      const referral = await (fastify.prisma as any).customerReferral.findUnique({ where: { id } });
      if (!referral) return reply.status(404).send({ message: 'Referral not found' });

      const updated = await (fastify.prisma as any).customerReferral.update({
        where: { id },
        data: {
          status: 'REWARDED',
          rewardPaid: true
        }
      });

      return reply.send(updated);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to mark referral as rewarded' });
    }
  });

}
