import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatSession, 
  ChatMessage, 
  ChatStatus, 
  MessageDirection, 
  SenderType 
} from '@prisma/client';

export class ChatService {
  private jwtSecret: string;
  private rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

  constructor(private fastify: FastifyInstance) {
    this.jwtSecret = process.env.JWT_SECRET || 'njdksandksacmvjgjdn38fdja2gs8cjn';
  }

  // --- Security & Token Management ---

  generateVisitorToken(visitorId: string): string {
    return jwt.sign({ visitorId }, this.jwtSecret, { expiresIn: '365d' });
  }

  verifyVisitorToken(token: string): { visitorId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (decoded && decoded.visitorId) {
        return { visitorId: decoded.visitorId };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  generateSocketToken(visitorId: string, sessionId: string): string {
    return jwt.sign({ visitorId, sessionId }, this.jwtSecret, { expiresIn: '24h' });
  }

  verifySocketToken(token: string): { visitorId: string; sessionId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (decoded && decoded.visitorId && decoded.sessionId) {
        return { visitorId: decoded.visitorId, sessionId: decoded.sessionId };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // --- Session Management ---

  async getOrCreateSession(
    visitorToken: string | null,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ 
    session: ChatSession; 
    visitorToken: string; 
    socketToken: string; 
    isNew: boolean;
  }> {
    let visitorId: string;
    let isTokenNew = false;
    let verified = visitorToken ? this.verifyVisitorToken(visitorToken) : null;

    if (!verified) {
      visitorId = uuidv4();
      isTokenNew = true;
    } else {
      visitorId = verified.visitorId;
    }

    const prisma = this.fastify.prisma;

    // Get the latest session for this visitor
    let session = await prisma.chatSession.findFirst({
      where: { visitorId },
      orderBy: { createdAt: 'desc' }
    });

    let isNewSession = false;

    // Reopen logic: if no session or latest is CLOSED, start a new one
    if (!session || session.status === ChatStatus.CLOSED) {
      const shortId = await this.generateUniqueShortId();
      session = await prisma.chatSession.create({
        data: {
          visitorId,
          shortId,
          status: ChatStatus.ACTIVE,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null
        }
      });
      isNewSession = true;

      // Emit new session to admin portal support agents
      if (this.fastify.io) {
        this.fastify.io.to('support-agents').emit('chat:session-created', session);
      }
    }

    const token = isTokenNew ? this.generateVisitorToken(visitorId) : visitorToken!;
    const socketToken = this.generateSocketToken(visitorId, session.id);

    return {
      session,
      visitorToken: token,
      socketToken,
      isNew: isNewSession
    };
  }

  private async generateUniqueShortId(): Promise<string> {
    const prisma = this.fastify.prisma;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    let shortId = '';

    while (!isUnique) {
      shortId = 'PL-';
      for (let i = 0; i < 6; i++) {
        shortId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await prisma.chatSession.findUnique({
        where: { shortId }
      });
      if (!existing) {
        isUnique = true;
      }
    }

    return shortId;
  }

  // --- Message Actions ---

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const prisma = this.fastify.prisma;
    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async postVisitorMessage(
    sessionId: string,
    visitorToken: string,
    content: string
  ): Promise<ChatMessage> {
    // 1. Verify visitor token
    const verified = this.verifyVisitorToken(visitorToken);
    if (!verified) {
      throw new Error('UNAUTHORIZED_VISITOR_TOKEN');
    }

    const prisma = this.fastify.prisma;

    // 2. Lookup session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // 3. Verify ownership
    if (session.visitorId !== verified.visitorId) {
      throw new Error('FORBIDDEN_SESSION_OWNERSHIP');
    }

    if (session.status === ChatStatus.CLOSED) {
      throw new Error('SESSION_CLOSED');
    }

    // 4. Enforce Rate Limiting (5 messages / 10s per visitor ID)
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    let messageCount = 0;

    if (redisEnabled && this.fastify.redis) {
      const redisKey = `chat:rate-limit:${verified.visitorId}`;
      try {
        messageCount = await this.fastify.redis.incr(redisKey);
        if (messageCount === 1) {
          await this.fastify.redis.expire(redisKey, 10);
        }
      } catch (err) {
        this.fastify.log.warn(err, '[ChatService] Redis operation failed, falling back to in-memory rate limiting');
        // Fallback inside catch
        const now = Date.now();
        const visitorKey = verified.visitorId;
        const current = this.rateLimitMap.get(visitorKey);
        if (!current || now > current.expiresAt) {
          messageCount = 1;
          this.rateLimitMap.set(visitorKey, { count: 1, expiresAt: now + 10000 });
        } else {
          current.count += 1;
          messageCount = current.count;
        }
      }
    } else {
      // Fallback to in-memory rate limiting
      const now = Date.now();
      const visitorKey = verified.visitorId;
      const current = this.rateLimitMap.get(visitorKey);

      if (!current || now > current.expiresAt) {
        messageCount = 1;
        this.rateLimitMap.set(visitorKey, { count: 1, expiresAt: now + 10000 });
      } else {
        current.count += 1;
        messageCount = current.count;
      }
    }

    if (messageCount > 5) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    // 5. Store message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        direction: MessageDirection.INBOUND,
        sender: SenderType.VISITOR,
        content,
        provider: this.fastify.whatsappClient.getProviderType()
      }
    });

    // 6. Broadcast via Socket.IO
    if (this.fastify.io) {
      this.fastify.io.to(`session:${sessionId}`).emit('chat:new-message', chatMessage);
      this.fastify.io.to('support-agents').emit('chat:new-message', {
        ...chatMessage,
        sessionShortId: session.shortId
      });
      // Update session activity
      this.fastify.io.to('support-agents').emit('chat:session-updated', session);
    }

    // 7. Forward to WhatsApp with prefix asynchronously
    this.fastify.whatsappClient
      .sendOutboundForward(session.shortId, 'Visitor', content)
      .then((whatsappMsgId: string | null) => {
        if (whatsappMsgId) {
          prisma.chatMessage.update({
            where: { id: chatMessage.id },
            data: { providerMessageId: whatsappMsgId }
          }).catch((e: any) => this.fastify.log.error(e, 'Failed to update WhatsApp msg ID in DB'));
        }
      })
      .catch((err: any) => {
        this.fastify.log.error(err, '[ChatService] Failed to relay message to WhatsApp');
      });

    return chatMessage;
  }

  async postAgentReply(
    sessionId: string,
    adminUser: any,
    content: string
  ): Promise<ChatMessage> {
    const prisma = this.fastify.prisma;

    // Lookup session
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    if (session.status === ChatStatus.CLOSED) {
      throw new Error('SESSION_CLOSED');
    }

    // Store message as Agent reply
    const chatMessage = await prisma.chatMessage.create({
      data: {
        sessionId,
        direction: MessageDirection.OUTBOUND,
        sender: SenderType.AGENT,
        content,
        provider: this.fastify.whatsappClient.getProviderType()
      }
    });

    // Broadcast via Socket.IO
    if (this.fastify.io) {
      this.fastify.io.to(`session:${sessionId}`).emit('chat:new-message', chatMessage);
      this.fastify.io.to('support-agents').emit('chat:new-message', {
        ...chatMessage,
        sessionShortId: session.shortId
      });
      this.fastify.io.to('support-agents').emit('chat:session-updated', session);
    }

    // Forward to WhatsApp with prefix and SenderName automatically
    const agentName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email || 'Admin';
    this.fastify.whatsappClient
      .sendOutboundForward(session.shortId, agentName, content)
      .then((whatsappMsgId: string | null) => {
        if (whatsappMsgId) {
          prisma.chatMessage.update({
            where: { id: chatMessage.id },
            data: { providerMessageId: whatsappMsgId }
          }).catch((e: any) => this.fastify.log.error(e, 'Failed to update WhatsApp msg ID in DB'));
        }
      })
      .catch((err: any) => {
        this.fastify.log.error(err, '[ChatService] Failed to relay agent reply to WhatsApp');
      });

    return chatMessage;
  }

  async closeSession(
    sessionId: string,
    closedBy: string,
    reason: string
  ): Promise<ChatSession> {
    const prisma = this.fastify.prisma;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const updatedSession = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: ChatStatus.CLOSED,
        closedAt: new Date(),
        closedBy,
        closeReason: reason
      }
    });

    // Store a system notification message inside chat logs
    await prisma.chatMessage.create({
      data: {
        sessionId,
        direction: MessageDirection.OUTBOUND,
        sender: SenderType.SYSTEM,
        content: `This chat session has been closed (${reason}).`
      }
    });

    // Broadcast close update to visitor socket and support agents dashboard
    if (this.fastify.io) {
      this.fastify.io.to(`session:${sessionId}`).emit('chat:session-updated', updatedSession);
      this.fastify.io.to('support-agents').emit('chat:session-updated', updatedSession);
    }

    // Send closing WhatsApp message to WHATSAPP_NUMBER
    this.fastify.whatsappClient
      .sendOutboundForward(session.shortId, 'System', `This session has been closed by ${closedBy} (${reason}).`)
      .catch((err: any) => {
        this.fastify.log.error(err, '[ChatService] Failed to send closing notification to WhatsApp');
      });

    return updatedSession;
  }
}
