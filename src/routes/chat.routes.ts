import { FastifyInstance } from 'fastify';
import { ChatService } from '../services/chat.service';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function chatRoutes(fastify: FastifyInstance) {
  const chatService = new ChatService(fastify);

  // POST /api/v1/chat/session
  // Public - Create or fetch active session
  fastify.post('/chat/session', {
    schema: {
      description: 'Create or fetch active support chat session',
      tags: ['Support Chat'],
      body: {
        type: 'object',
        properties: {
          visitorToken: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { visitorToken } = request.body || {};
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip;

    try {
      const result = await chatService.getOrCreateSession(visitorToken, userAgent, ipAddress);
      return createResponse(result, 'Session retrieved successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /api/v1/chat/message
  // Public (Visitor sends message) - Authenticated via visitorToken in body
  fastify.post('/chat/message', {
    schema: {
      description: 'Send a message from website visitor to support',
      tags: ['Support Chat'],
      body: {
        type: 'object',
        required: ['sessionId', 'visitorToken', 'content'],
        properties: {
          sessionId: { type: 'string' },
          visitorToken: { type: 'string' },
          content: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { sessionId, visitorToken, content } = request.body;

    if (!content || !content.trim()) {
      return reply.status(400).send(createErrorResponse('Message content cannot be empty'));
    }

    try {
      const message = await chatService.postVisitorMessage(sessionId, visitorToken, content);
      return createResponse(message, 'Message sent successfully');
    } catch (err: any) {
      fastify.log.error(err);
      if (err.message === 'RATE_LIMIT_EXCEEDED') {
        return reply.status(429).send(createErrorResponse('Too many messages. Please wait 10 seconds before sending more.'));
      }
      if (err.message === 'CHAT_SERVICE_TEMPORARILY_UNAVAILABLE') {
        return reply.status(503).send(createErrorResponse('Support chat is temporarily unavailable. Please try again later.'));
      }
      if (err.message === 'UNAUTHORIZED_VISITOR_TOKEN' || err.message === 'FORBIDDEN_SESSION_OWNERSHIP') {
        return reply.status(403).send(createErrorResponse('Unauthorized access to this chat session.'));
      }
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /api/v1/chat/agent/message
  // Private (Admin sends message) - Authenticated via JWT
  fastify.post('/chat/agent/message', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_manage')],
    schema: {
      description: 'Reply to visitor from support agent',
      tags: ['Support Chat'],
      body: {
        type: 'object',
        required: ['sessionId', 'content'],
        properties: {
          sessionId: { type: 'string' },
          content: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { sessionId, content } = request.body;
    const adminUser = request.user;

    if (!content || !content.trim()) {
      return reply.status(400).send(createErrorResponse('Message content cannot be empty'));
    }

    try {
      const message = await chatService.postAgentReply(sessionId, adminUser, content);
      return createResponse(message, 'Reply sent successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /api/v1/chat/messages
  // Public/Private - Fetch message history
  fastify.get('/chat/messages', {
    schema: {
      description: 'Get conversation history for a chat session',
      tags: ['Support Chat'],
      querystring: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
          visitorToken: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { sessionId, visitorToken } = request.query;

    let isAuthorized = false;

    // 1. Try Admin verification
    try {
      await request.jwtVerify();
      const user = request.user;
      if (user && (user.role?.toUpperCase() === 'SUPER_ADMIN' || (user.permissions && user.permissions.includes('support_view')))) {
        isAuthorized = true;
      }
    } catch (e) {
      // Not an admin, check visitor token ownership
    }

    // 2. If not admin, check visitor ownership
    if (!isAuthorized) {
      if (!visitorToken) {
        return reply.status(401).send(createErrorResponse('Unauthorized. Token is required.'));
      }

      const verified = chatService.verifyVisitorToken(visitorToken);
      if (!verified) {
        return reply.status(401).send(createErrorResponse('Unauthorized. Invalid visitor token.'));
      }

      // Check session ownership
      const session = await fastify.prisma.chatSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || session.visitorId !== verified.visitorId) {
        return reply.status(403).send(createErrorResponse('Forbidden. You do not own this session.'));
      }
    }

    try {
      const messages = await chatService.getMessages(sessionId);
      return createResponse(messages);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /api/v1/chat/admin/sessions
  // Private (Admin view) - Get all chat sessions
  fastify.get('/chat/admin/sessions', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_view')],
    schema: {
      description: 'Get all chat sessions for agents dashboard',
      tags: ['Support Chat'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'CLOSED'] }
        }
      }
    }
  }, async (request: any, reply) => {
    const { status } = request.query;
    const prisma = fastify.prisma;

    try {
      const where: any = {};
      if (status) {
        where.status = status;
      }

      const sessions = await prisma.chatSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      return createResponse(sessions);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /api/v1/chat/session/:id/close
  // Private (Admin action) - Close session
  fastify.post('/api/v1/chat/session/:id/close', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_manage')],
    schema: {
      description: 'Close an active chat session',
      tags: ['Support Chat'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', enum: ['RESOLVED', 'CUSTOMER_INACTIVE', 'SPAM', 'DUPLICATE'], default: 'RESOLVED' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { reason } = request.body;
    const adminUser = request.user;
    const closedBy = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email || 'Admin';

    try {
      const session = await chatService.closeSession(id, closedBy, reason);
      return createResponse(session, 'Session closed successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /api/v1/chat/whatsapp/status
  // Private (Admin view) - Get connection status
  fastify.get('/chat/whatsapp/status', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_view')],
    schema: {
      description: 'Get WhatsApp client connection status',
      tags: ['Support Chat']
    }
  }, async (request, reply) => {
    const prisma = fastify.prisma;
    try {
      const conn = await prisma.whatsAppConnectionStatus.findUnique({
        where: { id: 'singleton' }
      });
      return createResponse(conn || { status: 'DISCONNECTED', qrCode: null, whatsappNumber: null });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /api/v1/chat/whatsapp/number
  // Private (Admin view) - Update support whatsapp number
  fastify.post('/chat/whatsapp/number', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_manage')],
    schema: {
      description: 'Update WhatsApp support number',
      tags: ['Support Chat'],
      body: {
        type: 'object',
        required: ['whatsappNumber'],
        properties: {
          whatsappNumber: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const prisma = fastify.prisma;
    const { whatsappNumber } = request.body;
    try {
      const conn = await prisma.whatsAppConnectionStatus.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          status: 'DISCONNECTED',
          whatsappNumber: whatsappNumber.trim(),
          updatedAt: new Date()
        },
        update: {
          whatsappNumber: whatsappNumber.trim(),
          updatedAt: new Date()
        }
      });
      return createResponse(conn, 'WhatsApp support number updated successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /api/v1/chat/whatsapp/qr
  // Private (Admin view) - Get QR Code
  fastify.get('/api/v1/chat/whatsapp/qr', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_view')],
    schema: {
      description: 'Get WhatsApp QR Code for pairing',
      tags: ['Support Chat']
    }
  }, async (request, reply) => {
    const prisma = fastify.prisma;
    try {
      const conn = await prisma.whatsAppConnectionStatus.findUnique({
        where: { id: 'singleton' }
      });
      return createResponse({
        qrCode: conn?.qrCode || null,
        status: conn?.status || 'DISCONNECTED'
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // POST /api/v1/chat/webhook
  // Public - WhatsApp Cloud API Webhook placeholder
  fastify.post('/chat/webhook', async (request: any, reply) => {
    fastify.log.info('[Cloud API Webhook] Received webhook payload', request.body);
    return reply.status(200).send({ status: 'received' });
  });

  // GET /api/v1/chat/webhook
  // Public - WhatsApp Cloud API Webhook Verification verification helper
  fastify.get('/chat/webhook', async (request: any, reply) => {
    const query = request.query;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      fastify.log.info('[Cloud API Webhook] Webhook verified successfully');
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send(createErrorResponse('Forbidden. Webhook verification failed.'));
  });
}
