
import { FastifyInstance } from 'fastify';
import { CourierService } from '../services/courier.service';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function courierRoutes(fastify: FastifyInstance) {
  const courierService = new CourierService(fastify.prisma as any);

  // GET /admin/couriers - List all couriers
  fastify.get('/admin/couriers', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const couriers = await courierService.getActiveCouriers();
      return createResponse(couriers, "Couriers retrieved successfully");
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /admin/orders/:id/book-shipment - Book a shipment (Demo)
  fastify.post('/admin/orders/:id/book-shipment', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['courierId'],
        properties: {
          courierId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { courierId } = request.body;

    try {
      const result = await courierService.bookShipment(id, courierId);

      if (result.success) {
        await logActivity(fastify, {
          entityType: 'ORDER',
          entityId: id,
          action: 'BOOK_SHIPMENT',
          performedBy: request.user?.id,
          details: { courierId, trackingNumber: result.trackingNumber },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return createResponse(result, result.message);
      } else {
        return reply.status(400).send(createErrorResponse(result.message || "Booking failed"));
      }
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
