import { MessagingProvider } from './messaging-provider.interface';
import { MessagingProviderType } from '@prisma/client';

export class CloudApiProvider implements MessagingProvider {
  private messageCallback: ((phone: string, content: string, whatsappMessageId: string) => Promise<void>) | null = null;

  async sendMessage(toPhone: string, content: string): Promise<string | null> {
    console.warn(`[CloudApiProvider] Attempted to send message to ${toPhone} (Not Implemented Yet)`);
    // Simulated behavior / Throw if strictly preferred. We can return dummy message ID or throw.
    throw new Error('CloudApiProvider is not fully implemented yet.');
  }

  isConnected(): boolean {
    // Return false for now, or true to simulate online state.
    return false;
  }

  onMessageReceived(callback: (phone: string, content: string, whatsappMessageId: string) => Promise<void>): void {
    this.messageCallback = callback;
  }

  getProviderType(): MessagingProviderType {
    return MessagingProviderType.WHATSAPP_CLOUD;
  }

  // Helper for simulating webhook triggers locally
  async receiveWebhookMessage(phone: string, content: string, messageId: string) {
    if (this.messageCallback) {
      await this.messageCallback(phone, content, messageId);
    }
  }
}
