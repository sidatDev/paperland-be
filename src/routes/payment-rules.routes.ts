import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import { PaymentResolver } from '../services/payment-resolver.service';

export default async function paymentRuleRoutes(fastify: FastifyInstance) {
  
  // GET all Payment Rules
  fastify.get('/admin/payment-rules', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Get all payment rules',
        tags: ['Admin Payment Management'],
    }
  }, async (request, reply) => {
    try {
        const rules = await (fastify.prisma as any).paymentRule.findMany({
            include: { 
              zone: { select: { id: true, name: true } },
              gateway: { select: { id: true, name: true, identifier: true } }
            },
            orderBy: [
              { zoneId: 'asc' },
              { priority: 'asc' }
            ]
        });
        return createResponse(rules, 'Payment rules retrieved successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // CREATE Payment Rule
  fastify.post('/admin/payment-rules', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Create new payment rule',
        tags: ['Admin Payment Management'],
        body: {
            type: 'object',
            required: ['paymentType'],
            properties: {
                zoneId: { type: 'string', nullable: true },
                paymentType: { type: 'string' },
                gatewayId: { type: 'string', nullable: true },
                isEnabled: { type: 'boolean' },
                minOrderValue: { type: 'number', nullable: true },
                maxOrderValue: { type: 'number', nullable: true },
                extraCharge: { type: 'number', nullable: true },
                priority: { type: 'integer' }
            }
        }
    }
  }, async (request: any, reply) => {
    try {
        const rule = await (fastify.prisma as any).paymentRule.create({
            data: request.body
        });
        
        await logActivity(fastify, {
            entityType: 'PAYMENT_RULE',
            entityId: rule.id,
            action: 'CREATE',
            performedBy: request.user?.id,
            details: request.body,
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return createResponse(rule, 'Payment rule created successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // UPDATE Payment Rule
  fastify.put('/admin/payment-rules/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Update payment rule',
          tags: ['Admin Payment Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              additionalProperties: true
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          const rule = await (fastify.prisma as any).paymentRule.update({
              where: { id },
              data: request.body
          });

          await logActivity(fastify, {
              entityType: 'PAYMENT_RULE',
              entityId: id,
              action: 'UPDATE',
              performedBy: request.user?.id,
              details: request.body,
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(rule, 'Payment rule updated successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });

  // DELETE Payment Rule
  fastify.delete('/admin/payment-rules/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Delete payment rule',
          tags: ['Admin Payment Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          await (fastify.prisma as any).paymentRule.delete({ where: { id } });
          
          await logActivity(fastify, {
            entityType: 'PAYMENT_RULE',
            entityId: id,
            action: 'DELETE',
            performedBy: request.user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          return createResponse(null, 'Payment rule deleted successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });

  // Admin Preview Mode
  fastify.get('/admin/payment-rules/preview', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Preview payment methods for a specific city and amount',
          tags: ['Admin Payment Management'],
          query: {
              type: 'object',
              required: ['city', 'amount'],
              properties: {
                  city: { type: 'string' },
                  amount: { type: 'number' }
              }
          }
      }
  }, async (request: any, reply) => {
      const { city, amount } = request.query;
      try {
          const methods = await PaymentResolver.getAvailableMethods(
              city, 
              amount, 
              fastify.prisma as any
          );
          return createResponse(methods, 'Preview results generated');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });
}
