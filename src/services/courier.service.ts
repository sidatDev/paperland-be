
import { PrismaClient } from '@prisma/client';

export interface BookingResponse {
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  message?: string;
}

export class CourierService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Mock booking logic for demo purposes
   */
  async bookShipment(orderId: string, courierIdentifier: string): Promise<BookingResponse> {
    try {
      const order = await this.prisma.order.findFirst({
        where: { 
            OR: [
                { id: orderId },
                { orderNumber: orderId }
            ]
        },
        include: { address: true }
      });

      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      const courier = await this.prisma.shippingCourier.findUnique({
        where: { identifier: courierIdentifier }
      });

      if (!courier || !courier.isActive) {
        return { success: false, message: 'Courier not found or inactive' };
      }

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate a mock tracking number
      const trackingPrefix = courierIdentifier.toUpperCase();
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const trackingNumber = `DEMO-${trackingPrefix}-${randomDigits}`;

      // Update Order with mock booking data
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          trackingNumber: trackingNumber,
          courierPartner: courier.name,
          shipperBookingId: `BOOK-${randomDigits}`,
          shipperLabelUrl: `https://example.com/labels/${trackingNumber}.pdf`,
          status: 'SHIPPED', // Update status to SHIPPED for the demo
          shippedDate: new Date()
        }
      });

      // Log the activity
      // Note: In a real app, we'd use the logActivity utility here
      
      return {
        success: true,
        trackingNumber: trackingNumber,
        labelUrl: `https://example.com/labels/${trackingNumber}.pdf`,
        message: `Shipment successfully booked with ${courier.name}`
      };
    } catch (error: any) {
      console.error('Courier booking error:', error);
      return { success: false, message: error.message || 'Internal simulation error' };
    }
  }

  /**
   * Get list of active couriers
   */
  async getActiveCouriers() {
    return this.prisma.shippingCourier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }
}
