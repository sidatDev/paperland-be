import { FastifyInstance } from 'fastify';
import { CourierService } from '../services/courier.service';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function shipmentRoutes(fastify: FastifyInstance) {
  const courierService = new CourierService(fastify.prisma);

  // POST Book Shipment
  fastify.post('/admin/orders/:id/book-shipment', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Book a shipment with a courier partner',
        tags: ['Admin Order Management'],
        params: { type: 'object', properties: { id: { type: 'string' } } },
        body: {
            type: 'object',
            required: ['courierIdentifier'],
            properties: {
                courierIdentifier: { type: 'string' }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            trackingNumber: { type: 'string' },
                            labelUrl: { type: 'string' },
                            message: { type: 'string' }
                        }
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'null' }
                }
            },
            500: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'null' }
                }
            }
        }
    }
  }, async (request: any, reply) => {
    const { id: orderId } = request.params;
    const { courierIdentifier } = request.body;

    try {
        const result = await courierService.bookShipment(orderId, courierIdentifier);

        if (!result.success) {
            return reply.status(400).send(createErrorResponse(result.message || 'Booking failed'));
        }

        await logActivity(fastify, {
            entityType: 'ORDER',
            entityId: orderId,
            action: 'BOOK_SHIPMENT',
            performedBy: request.user?.id,
            details: { courierIdentifier, trackingNumber: result.trackingNumber },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return createResponse(result, 'Shipment booked successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // GET Active Couriers
  fastify.get('/admin/shipping/active-couriers', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Get list of active couriers for booking',
          tags: ['Admin Shipping Management'],
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
                                  identifier: { type: 'string' }
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
                      message: { type: 'string' },
                      data: { type: 'null' }
                  }
              }
          }
      }
  }, async (request, reply) => {
      try {
          const couriers = await courierService.getActiveCouriers();
          return createResponse(couriers, 'Active couriers retrieved successfully');
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse('Internal Server Error'));
      }
  });
}
