
import { FastifyInstance } from 'fastify';

export interface WhatsAppMessageResponse {
  success: boolean;
  messageId?: string;
  recipients?: string[];
  status: 'sent' | 'failed' | 'simulated';
  timestamp: string;
}

export class WhatsAppService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Simulate sending a WhatsApp message
   */
  private async simulateSend(phone: string, templateName: string, variables: any): Promise<WhatsAppMessageResponse> {
    // Artificial delay to simulate network request
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.fastify.log.info(`[WhatsApp Simulation] Sending ${templateName} to ${phone} with vars: ${JSON.stringify(variables)}`);

    return {
      success: true,
      messageId: `wamid.HBgL${Math.random().toString(36).substring(7).toUpperCase()}`,
      recipients: [phone],
      status: 'simulated',
      timestamp: new Date().toISOString()
    };
  }

  async sendOrderConfirmation(order: any): Promise<WhatsAppMessageResponse> {
    const phone = order.user?.phoneNumber || order.user?.phone || order.billingSnapshot?.phone || order.shippingSnapshot?.phone || 'Unknown';
    const customerName = order.user?.firstName || order.billingSnapshot?.name || 'Customer';
    
    return this.simulateSend(phone, 'order_confirmation_template', {
      customer_name: customerName,
      order_number: order.orderNumber,
      total_amount: order.totalAmount
    });
  }

  async sendShippingUpdate(order: any): Promise<WhatsAppMessageResponse> {
    const phone = order.user?.phoneNumber || order.user?.phone || order.shippingSnapshot?.phone || 'Unknown';
    const customerName = order.user?.firstName || order.shippingSnapshot?.name || 'Customer';

    return this.simulateSend(phone, 'shipping_update_template', {
      customer_name: customerName,
      order_number: order.orderNumber,
      tracking_number: order.trackingNumber || 'N/A',
      courier_name: order.courierPartner || 'N/A',
      tracking_link: `https://paperland.com.pk/track/${order.orderNumber}`
    });
  }
}
