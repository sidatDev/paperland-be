import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function paymentZoneRoutes(fastify: FastifyInstance) {
  
  // GET all Payment Zones
  fastify.get('/admin/payment-zones', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Get all payment zones',
        tags: ['Admin Payment Management'],
    }
  }, async (request, reply) => {
    try {
        const zones = await (fastify.prisma as any).paymentZone.findMany({
            orderBy: { name: 'asc' }
        });
        return createResponse(zones, 'Payment zones retrieved successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // CREATE Payment Zone
  fastify.post('/admin/payment-zones', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Create new payment zone',
        tags: ['Admin Payment Management'],
        body: {
            type: 'object',
            required: ['name', 'cities'],
            properties: {
                name: { type: 'string' },
                cities: { type: 'array', items: { type: 'string' } },
                isActive: { type: 'boolean' }
            }
        }
    }
  }, async (request: any, reply) => {
    const { name, cities, isActive } = request.body;
    try {
        // Normalize cities: lowercase + trim
        const normalizedCities = cities.map((c: string) => c.toLowerCase().trim());
        
        const zone = await (fastify.prisma as any).paymentZone.create({
            data: {
                name,
                cities: normalizedCities,
                isActive: isActive !== undefined ? isActive : true
            }
        });
        
        await logActivity(fastify, {
            entityType: 'PAYMENT_ZONE',
            entityId: zone.id,
            action: 'CREATE',
            performedBy: request.user?.id,
            details: { name, cities: normalizedCities },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return createResponse(zone, 'Payment zone created successfully');
    } catch (err: any) {
        fastify.log.error(err);
        if (err.code === 'P2002') {
            return reply.status(400).send(createErrorResponse('A zone with this name already exists'));
        }
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // UPDATE Payment Zone
  fastify.put('/admin/payment-zones/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Update payment zone',
          tags: ['Admin Payment Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              properties: {
                  name: { type: 'string' },
                  cities: { type: 'array', items: { type: 'string' } },
                  isActive: { type: 'boolean' }
              }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { name, cities, isActive } = request.body;
      try {
          const updateData: any = {};
          if (name) updateData.name = name;
          if (cities) updateData.cities = cities.map((c: string) => c.toLowerCase().trim());
          if (isActive !== undefined) updateData.isActive = isActive;

          const zone = await (fastify.prisma as any).paymentZone.update({
              where: { id },
              data: updateData
          });

          await logActivity(fastify, {
              entityType: 'PAYMENT_ZONE',
              entityId: id,
              action: 'UPDATE',
              performedBy: request.user?.id,
              details: request.body,
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(zone, 'Payment zone updated successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });

  // DELETE Payment Zone
  fastify.delete('/admin/payment-zones/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Delete payment zone',
          tags: ['Admin Payment Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          // Check if any rules are using this zone
          const rulesCount = await (fastify.prisma as any).paymentRule.count({
              where: { zoneId: id }
          });

          if (rulesCount > 0) {
              return reply.status(400).send(createErrorResponse('Cannot delete zone while it has active payment rules. Delete the rules first.'));
          }

          await (fastify.prisma as any).paymentZone.delete({ where: { id } });
          
          await logActivity(fastify, {
            entityType: 'PAYMENT_ZONE',
            entityId: id,
            action: 'DELETE',
            performedBy: request.user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          return createResponse(null, 'Payment zone deleted successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });
}
