
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function syncRoutes(fastify: FastifyInstance) {

  // GET /admin/sync/price-history
  // Retrieve paginated price sync logs
  fastify.get('/admin/sync/price-history', {
    schema: {
        description: 'Get Price Sync History Logs',
        tags: ['Sync'],
        querystring: {
            type: 'object',
            properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 20 },
                status: { type: 'string' }
            }
        }
    }
  }, async (request: any, reply) => {
    try {
        const { page = 1, limit = 20, status } = request.query;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status && status !== 'all') {
            where.status = status; // SUCCESS, FAILED, PARTIAL
        }

        const [logs, total] = await Promise.all([
            (fastify.prisma as any).priceSyncLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: Number(skip),
                take: Number(limit)
            }),
            (fastify.prisma as any).priceSyncLog.count({ where })
        ]);

        return createResponse(logs, "Sync History Retrieved", {
            page: Number(page),
            limit: Number(limit),
            total
        });

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to fetch sync history: ' + err.message));
    }
  });

  // Helper to manually trigger a log entry (Internal Use or Test Endpoint)
  fastify.post('/admin/sync/log-test', async (request: any, reply) => {
      try {
          const { status, details, triggeredBy } = request.body;
          const log = await (fastify.prisma as any).priceSyncLog.create({
              data: {
                  status: status || 'INFO',
                  details: details || {},
                  triggeredBy: triggeredBy || 'MANUAL_TEST'
              }
          });

          // Log Activity (Unified Audit)
          await logActivity(fastify, {
              entityType: 'SYSTEM',
              entityId: log.id,
              action: 'SYNC_TRIGGER',
              performedBy: (request.user as any)?.id || 'unknown',
              details: { status: log.status, triggeredBy: log.triggeredBy },
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(log, "Log Entry Created");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });
}
