import { MessagingProvider } from './messaging-provider.interface';
import { MessagingProviderType } from '@prisma/client';
import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import path from 'path';
import { FastifyInstance } from 'fastify';

export class WhatsAppWebProvider implements MessagingProvider {
  private client: Client;
  private messageCallback: ((phone: string, content: string, whatsappMessageId: string) => Promise<void>) | null = null;
  private ready = false;

  constructor(private fastify: FastifyInstance) {
    const sessionDir = path.join(process.cwd(), '.wwebjs_auth');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: sessionDir
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      }
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on('qr', async (qr) => {
      this.fastify.log.info('[WhatsAppWebProvider] QR Code received');
      try {
        const qrCodeDataUri = await QRCode.toDataURL(qr);
        await this.updateConnectionStatus('CONNECTING', qrCodeDataUri);
        
        // Notify via Socket.IO if registered
        if (this.fastify.io) {
          this.fastify.io.to('support-agents').emit('chat:whatsapp-status', {
            status: 'CONNECTING',
            qrCode: qrCodeDataUri
          });
        }
      } catch (err) {
        this.fastify.log.error(err, '[WhatsAppWebProvider] Failed to generate/save QR code');
      }
    });

    this.client.on('ready', async () => {
      this.fastify.log.info('[WhatsAppWebProvider] Client is ready');
      this.ready = true;
      await this.updateConnectionStatus('CONNECTED', null);
      if (this.fastify.io) {
        this.fastify.io.to('support-agents').emit('chat:whatsapp-status', {
          status: 'CONNECTED',
          qrCode: null
        });
      }
    });

    this.client.on('authenticated', () => {
      this.fastify.log.info('[WhatsAppWebProvider] Authenticated successfully');
    });

    this.client.on('auth_failure', async (msg) => {
      this.fastify.log.error(`[WhatsAppWebProvider] Authentication failure: ${msg}`);
      this.ready = false;
      await this.updateConnectionStatus('AUTH_FAILURE', null);
      if (this.fastify.io) {
        this.fastify.io.to('support-agents').emit('chat:whatsapp-status', {
          status: 'AUTH_FAILURE',
          qrCode: null
        });
      }
    });

    this.client.on('disconnected', async (reason) => {
      this.fastify.log.warn(`[WhatsAppWebProvider] Disconnected: ${reason}`);
      this.ready = false;
      await this.updateConnectionStatus('DISCONNECTED', null);
      if (this.fastify.io) {
        this.fastify.io.to('support-agents').emit('chat:whatsapp-status', {
          status: 'DISCONNECTED',
          qrCode: null
        });
      }
    });

    this.client.on('message', async (msg) => {
      // Check if message is from the configured support number, is not from me, and has the prefix
      const adminPhone = (process.env.WHATSAPP_NUMBER || '').trim();
      const cleanFrom = msg.from.replace('@c.us', '');
      
      const isAdminMessage = cleanFrom === adminPhone || msg.from.includes(adminPhone);
      
      if (!msg.fromMe && isAdminMessage && this.messageCallback) {
        this.fastify.log.info(`[WhatsAppWebProvider] Received message from Admin Phone: ${msg.body}`);
        await this.messageCallback(msg.from, msg.body, msg.id.id);
      }
    });
  }

  async initialize(): Promise<void> {
    this.fastify.log.info('[WhatsAppWebProvider] Initializing client...');
    await this.updateConnectionStatus('CONNECTING', null);
    
    // We wrap initialize in a try/catch, but run it asynchronously
    this.client.initialize().catch((err) => {
      this.fastify.log.error(err, '[WhatsAppWebProvider] Initialization failed');
    });
  }

  async sendMessage(toPhone: string, content: string): Promise<string | null> {
    if (!this.ready) {
      this.fastify.log.warn('[WhatsAppWebProvider] Client not ready. Cannot send message.');
      return null;
    }

    try {
      let formattedPhone = toPhone.trim();
      if (!formattedPhone.endsWith('@c.us')) {
        formattedPhone = formattedPhone.replace(/[\s\-\+\(\)]/g, ''); // strip formatting
        formattedPhone = `${formattedPhone}@c.us`;
      }

      this.fastify.log.info(`[WhatsAppWebProvider] Sending message to ${formattedPhone}`);
      const response = await this.client.sendMessage(formattedPhone, content);
      return response.id.id;
    } catch (err) {
      this.fastify.log.error(err, '[WhatsAppWebProvider] Error sending message');
      return null;
    }
  }

  isConnected(): boolean {
    return this.ready;
  }

  onMessageReceived(callback: (phone: string, content: string, whatsappMessageId: string) => Promise<void>): void {
    this.messageCallback = callback;
  }

  getProviderType(): MessagingProviderType {
    return MessagingProviderType.WHATSAPP_WEB;
  }

  private async updateConnectionStatus(status: string, qrCode: string | null) {
    try {
      const prisma = this.fastify.prisma;
      await prisma.whatsAppConnectionStatus.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          status,
          qrCode,
          updatedAt: new Date()
        },
        update: {
          status,
          qrCode,
          updatedAt: new Date()
        }
      });
    } catch (err) {
      this.fastify.log.error(err, '[WhatsAppWebProvider] Failed to update connection status in DB');
    }
  }
}
