import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function bankAccountRoutes(fastify: FastifyInstance) {
  
  // GET all Bank Accounts
  fastify.get('/admin/bank-accounts', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Get all bank accounts',
        tags: ['Admin Payment Management'],
    }
  }, async (request, reply) => {
    try {
        const accounts = await (fastify.prisma as any).bankAccount.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        return createResponse(accounts, 'Bank accounts retrieved successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // CREATE Bank Account
  fastify.post('/admin/bank-accounts', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Create new bank account',
        tags: ['Admin Payment Management'],
        body: {
            type: 'object',
            required: ['bankName', 'accountTitle', 'accountNumber'],
            properties: {
                bankName: { type: 'string' },
                accountTitle: { type: 'string' },
                accountNumber: { type: 'string' },
                iban: { type: 'string', nullable: true },
                branch: { type: 'string', nullable: true },
                isActive: { type: 'boolean' },
                sortOrder: { type: 'integer' }
            }
        }
    }
  }, async (request: any, reply) => {
    try {
        const account = await (fastify.prisma as any).bankAccount.create({
            data: request.body
        });
        
        await logActivity(fastify, {
            entityType: 'BANK_ACCOUNT',
            entityId: account.id,
            action: 'CREATE',
            performedBy: request.user?.id,
            details: request.body,
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return createResponse(account, 'Bank account created successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // UPDATE Bank Account
  fastify.put('/admin/bank-accounts/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Update bank account',
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
          const account = await (fastify.prisma as any).bankAccount.update({
              where: { id },
              data: request.body
          });

          await logActivity(fastify, {
              entityType: 'BANK_ACCOUNT',
              entityId: id,
              action: 'UPDATE',
              performedBy: request.user?.id,
              details: request.body,
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(account, 'Bank account updated successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });

  // DELETE Bank Account
  fastify.delete('/admin/bank-accounts/:id', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Delete bank account',
          tags: ['Admin Payment Management'],
          params: { type: 'object', properties: { id: { type: 'string' } } }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          // Soft delete or status change is safer, but plan says DELETE
          await (fastify.prisma as any).bankAccount.delete({ where: { id } });
          
          await logActivity(fastify, {
            entityType: 'BANK_ACCOUNT',
            entityId: id,
            action: 'DELETE',
            performedBy: request.user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent']
          });

          return createResponse(null, 'Bank account deleted successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });
}
