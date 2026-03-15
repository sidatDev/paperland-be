
import { FastifyInstance } from 'fastify';
import { WhatsAppService } from '../services/whatsapp.service';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function whatsappRoutes(fastify: FastifyInstance) {
  const whatsappService = new WhatsAppService(fastify);

  // POST /admin/orders/:id/send-whatsapp
  fastify.post('/admin/orders/:id/send-whatsapp', {
    preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
    schema: {
      description: 'Trigger simulated WhatsApp notification for an order',
      tags: ['WhatsApp'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['confirmation', 'shipping'] }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { type } = request.body;
    const prisma = fastify.prisma as any;

    try {
      // Lookup order
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { id },
            { orderNumber: id }
          ]
        },
        include: { user: true }
      });

      if (!order) {
        return reply.status(404).send(createErrorResponse('Order Not Found'));
      }

      let result;
      if (type === 'confirmation') {
        result = await whatsappService.sendOrderConfirmation(order);
      } else {
        result = await whatsappService.sendShippingUpdate(order);
      }

      return createResponse(result, `WhatsApp ${type} notification simulated successfully`);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
