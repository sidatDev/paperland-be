import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function countryRoutes(fastify: FastifyInstance) {
  
  fastify.get('/countries', {
    schema: {
      description: 'Get all active countries',
      tags: ['System'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  code: { type: 'string' },
                  currencyId: { type: 'string' },
                  currency: {
                    type: 'object',
                    properties: {
                      code: { type: 'string' },
                      symbol: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const countries = await fastify.prisma.country.findMany({
        where: { isActive: true },
        include: { currency: true },
        orderBy: { name: 'asc' }
      });
      return createResponse(countries, 'Countries retrieved successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
