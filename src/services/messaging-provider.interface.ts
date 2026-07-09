import { MessagingProviderType } from '@prisma/client';

export interface MessagingProvider {
  sendMessage(toPhone: string, content: string): Promise<string | null>;
  isConnected(): boolean;
  onMessageReceived(callback: (phone: string, content: string, whatsappMessageId: string) => Promise<void>): void;
  getProviderType(): MessagingProviderType;
}
