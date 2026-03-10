import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function publicTrackingRoutes(fastify: FastifyInstance) {
  
  // =====================================================
  // PUBLIC ORDER TRACKING ENDPOINT (No Auth Required)
  // =====================================================
  
  fastify.get('/orders/track', {
    schema: {
      description: 'Public Order Tracking - No Authentication Required',
      tags: ['Public'],
      querystring: {
        type: 'object',
        required: ['search'],
        properties: {
          search: { type: 'string', description: 'Order number OR tracking number' },
          region: { type: 'string', enum: ['SA', 'AE', 'PK'], description: 'Region override (optional)' }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const { search, region } = request.query;
      const prisma = fastify.prisma as any;

      if (!search || search.trim().length === 0) {
        return reply.code(400).send(createErrorResponse('Search parameter is required'));
      }

      const searchTerm = search.trim();

      // Smart search: try order number or tracking number
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: searchTerm, mode: 'insensitive' } },
            { trackingNumber: { equals: searchTerm, mode: 'insensitive' } }
          ],
          deletedAt: null
        },
        include: {
          currency: true,
          address: { include: { country: true }}
        }
      });

      if (!order) {
        return reply.code(404).send(createErrorResponse('Order not found'));
      }

      // Detect region
      let detectedRegion = region || order.address?.country?.code || 'SA';

      console.log(`Tracking order: ${order.orderNumber}, Region: ${detectedRegion}`);

      // Get tracking data
      let timelineData = order.trackingTimeline as any;
      const cacheAge = order.updatedAt ? Date.now() - new Date(order.updatedAt).getTime() : Infinity;

      if (!timelineData || cacheAge > 300000) { // 5 min cache
        const { trackingService } = await import('../services/tracking.service');
        const trackingResponse = await trackingService.track(
          order.trackingNumber || order.orderNumber,
          detectedRegion
        );
        
        if (trackingResponse) {
          timelineData = trackingResponse;
          // Update cache in background (fire and forget)
          prisma.order.update({
            where: { id: order.id },
            data: {
              trackingTimeline: trackingResponse,
              shipperRegion: detectedRegion
            }
          }).catch(() => {});
        }
      }

      // Fallback to internal timeline
      if (!timelineData) {
        timelineData = {
          status: order.status,
          carrier: order.courierPartner || 'Standard',
          timeline: [
            { event: 'Order Placed', date: order.createdAt, location: order.address?.city || 'Unknown' }
          ]
        };
      }

      const responseData = {
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        estimatedDelivery: order.estimatedDeliveryDate || timelineData.estimatedDelivery,
        status: order.status,
        carrier: timelineData.carrier || order.courierPartner || 'Standard Delivery',
        trackingNumber: order.trackingNumber,
        totalAmount: order.totalAmount ? parseFloat(order.totalAmount.toString()) : 0,
        currency: order.currency?.code || 'SAR',
        timeline: timelineData.timeline || []
      };

      return createResponse(responseData);

    } catch (err: any) {
      fastify.log.error('Public tracking error:', err);
      return reply.code(500).send(createErrorResponse('Unable to fetch tracking'));
    }
  });
}
