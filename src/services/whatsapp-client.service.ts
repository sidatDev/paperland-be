import { FastifyInstance } from 'fastify';
import { MessagingProvider } from './messaging-provider.interface';
import { WhatsAppWebProvider } from './whatsapp-web-provider.service';
import { CloudApiProvider } from './cloud-api-provider.service';
import { MessagingProviderType, SenderType, MessageDirection } from '@prisma/client';

export class WhatsappClientService {
  private provider: MessagingProvider;

  constructor(private fastify: FastifyInstance) {
    const providerType = (process.env.WHATSAPP_PROVIDER || 'WHATSAPP_WEB').toUpperCase();

    if (providerType === 'WHATSAPP_CLOUD') {
      this.provider = new CloudApiProvider();
    } else {
      this.provider = new WhatsAppWebProvider(this.fastify);
    }

    this.setupIncomingListener();
  }

  private setupIncomingListener() {
    this.provider.onMessageReceived(async (phone, content, whatsappMessageId) => {
      this.fastify.log.info(`[WhatsappClientService] Processing incoming message from ${phone}: ${content}`);

      // Regex to parse prefix: [#PL-XXXXXX] or [#PL-XXXX]
      const match = content.match(/^\[#PL-([A-Za-z0-9]{6})\]\s*(.*)$/i);
      if (!match) {
        this.fastify.log.warn(`[WhatsappClientService] Incoming message ignored (no valid session prefix found): ${content}`);
        return;
      }

      const shortId = match[1].toUpperCase();
      const messageText = match[2].trim();

      const prisma = this.fastify.prisma;
      
      try {
        // Find active or latest session with this shortId
        const session = await prisma.chatSession.findUnique({
          where: { shortId }
        });

        if (!session) {
          this.fastify.log.error(`[WhatsappClientService] Chat session with shortId ${shortId} not found.`);
          return;
        }

        if (session.status === 'CLOSED') {
          this.fastify.log.warn(`[WhatsappClientService] Received reply for closed session ${shortId}. Ignoring.`);
          return;
        }

        // Store message in database as AGENT reply (outbound to customer)
        const chatMessage = await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            direction: MessageDirection.OUTBOUND,
            sender: SenderType.AGENT,
            content: messageText,
            provider: this.provider.getProviderType(),
            providerMessageId: whatsappMessageId,
            isRead: false
          }
        });

        // Broadcast to visitor socket room session:{sessionId}
        if (this.fastify.io) {
          this.fastify.io.to(`session:${session.id}`).emit('chat:new-message', chatMessage);
          
          // Also broadcast to support agents dashboard
          this.fastify.io.to('support-agents').emit('chat:new-message', {
            ...chatMessage,
            sessionShortId: shortId
          });

          // Emit session update to refresh order list or badge in admin portal
          this.fastify.io.to('support-agents').emit('chat:session-updated', session);
        }

        this.fastify.log.info(`[WhatsappClientService] Relayed reply for session ${shortId} to visitor`);
      } catch (err) {
        this.fastify.log.error(err, `[WhatsappClientService] Failed to process message for session ${shortId}`);
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.provider instanceof WhatsAppWebProvider) {
      await this.provider.initialize();
    }
  }

  async getWhatsAppNumber(): Promise<string> {
    try {
      const conn = await this.fastify.prisma.whatsAppConnectionStatus.findUnique({
        where: { id: 'singleton' }
      });
      if (conn?.whatsappNumber) {
        return conn.whatsappNumber.trim();
      }
    } catch (err) {
      this.fastify.log.error(err, '[WhatsappClientService] Failed to retrieve whatsapp number from database');
    }
    return (process.env.WHATSAPP_NUMBER || '').trim();
  }

  async sendOutboundForward(shortId: string, senderName: string, content: string): Promise<string | null> {
    const adminPhone = await this.getWhatsAppNumber();
    if (!adminPhone) {
      this.fastify.log.error('[WhatsappClientService] WhatsApp number is not set in database or environment variables');
      return null;
    }

    const payload = `[#PL-${shortId}] ${senderName}:\n${content}`;
    return this.provider.sendMessage(adminPhone, payload);
  }

  isConnected(): boolean {
    return this.provider.isConnected();
  }

  getProviderType(): MessagingProviderType {
    return this.provider.getProviderType();
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    whatsappClient: WhatsappClientService;
  }
}

