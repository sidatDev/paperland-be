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
          coupon: true,
          items: { include: { product: true } },
          address: { include: { country: true }},
          history: {
            orderBy: { createdAt: 'desc' },
            include: { changedByUser: { select: { firstName: true, lastName: true } } }
          }
        }
      });

      if (!order) {
        return reply.code(404).send(createErrorResponse('Order not found'));
      }

      // Fetch Delivery Agent if assigned via Call Log
      const latestCallLog = await prisma.orderCallLog.findFirst({
        where: { orderId: order.id },
        orderBy: { calledAt: 'desc' },
        include: { agent: true }
      });

      // Detect region
      let detectedRegion = region || order.address?.country?.code || 'SA';

      // Get tracking data (External Service)
      let externalTimeline = null;
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
          // Update cache in background
          prisma.order.update({
            where: { id: order.id },
            data: {
              trackingTimeline: trackingResponse,
              shipperRegion: detectedRegion
            }
          }).catch(() => {});
        }
      }

      // Build Dynamic Timeline
      // 1. Internal History
      let combinedTimeline = (order.history || []).map((h: any) => ({
        event: h.status,
        description: h.notes || `Order status updated to ${h.status}`,
        date: h.createdAt,
        location: order.address?.city || 'Processing Center',
        type: 'INTERNAL'
      }));

      // 2. Add External Timeline if available
      if (timelineData && timelineData.timeline) {
        const externalEvents = timelineData.timeline.map((e: any) => ({
          ...e,
          type: 'EXTERNAL'
        }));
        combinedTimeline = [...combinedTimeline, ...externalEvents];
      }

      // Sort by date desc
      combinedTimeline.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const responseData = {
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        estimatedDelivery: order.estimatedDeliveryDate || timelineData?.estimatedDelivery,
        status: order.status,
        carrier: timelineData?.carrier || order.courierPartner || 'Standard Delivery',
        trackingNumber: order.trackingNumber,
        totalAmount: order.totalAmount ? parseFloat(order.totalAmount.toString()) : 0,
        currency: order.currency?.code || 'PKR',
        paymentMethod: order.paymentMethod,
        shippingAddress: {
          fullName: `${order.address?.firstName} ${order.address?.lastName}`,
          streetAddress: order.address?.street1,
          city: order.address?.city,
          country: order.address?.country?.name
        },
        deliveryAgent: latestCallLog?.agent ? {
          name: latestCallLog.agent.name,
          phone: latestCallLog.agent.phone
        } : null,
        timeline: combinedTimeline,
        items: order.items,
        pricingSummary: order.pricingSummary,
        taxAmount: order.taxAmount ? parseFloat(order.taxAmount.toString()) : 0,
        shippingAmount: order.shippingAmount ? parseFloat(order.shippingAmount.toString()) : 0,
        subtotal: order.subtotal ? parseFloat(order.subtotal.toString()) : null,
        couponDiscount: order.couponDiscount ? parseFloat(order.couponDiscount.toString()) : null,
        coupon: order.coupon || null
      };

      return createResponse(responseData);

    } catch (err: any) {
      fastify.log.error('Public tracking error:', err);
      return reply.code(500).send(createErrorResponse('Unable to fetch tracking'));
    }
  });
}
