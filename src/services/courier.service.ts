import { PrismaClient } from '@prisma/client';
import { ICourierProvider, BookingRequest, BookingResponse } from './courier/courier.interface';
import { BlueExProvider } from './courier/blueex.provider';
import { LeopardsProvider } from './courier/leopards.provider';
import { emailService } from './email.service';

export class CourierService {
  private prisma: PrismaClient;
  private providers: Map<string, ICourierProvider> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // Register available providers
    this.registerProvider(new BlueExProvider());
    this.registerProvider(new LeopardsProvider());
  }

  private registerProvider(provider: ICourierProvider) {
    this.providers.set(provider.identifier, provider);
  }

  /**
   * Book a shipment using the specified courier
   */
  async bookShipment(orderId: string, courierIdentifier: string): Promise<BookingResponse> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { address: true, user: true }
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

      const provider = this.providers.get(courierIdentifier);
      if (!provider) {
        return { success: false, message: `No implementation found for courier: ${courierIdentifier}` };
      }

      // Construct booking request
      const bookingRequest: BookingRequest = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || 'Customer',
        customerPhone: order.user?.phoneNumber || '0000000000',
        customerAddress: `${order.address?.street1 || ''} ${order.address?.street2 || ''}`.trim() || 'Unknown Address',
        customerCity: order.address?.city || 'Unknown City',
        totalAmount: Number(order.totalAmount),
        isCod: order.paymentMethod?.toUpperCase() === 'COD' || order.paymentStatus !== 'PAID',
        pieces: 1, // Defaulting to 1 for now
        weightInKg: 0.5 // Defaulting to 0.5kg for now
      };

      // Call the provider's booking logic
      const response = await provider.createBooking(bookingRequest, courier.config);

      if (response.success && response.trackingNumber) {
        // Update Order with booking data
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            trackingNumber: response.trackingNumber,
            courierPartner: courier.name,
            shipperBookingId: response.bookingId,
            shipperLabelUrl: response.labelUrl,
            status: 'SHIPPED',
            shippedDate: new Date()
          }
        });

        // Send Status Update Email (SHIPPED)
        if (order.user?.email) {
            try {
                // Refetch to get updated order with tracking info for email
                const updatedOrder = await this.prisma.order.findUnique({
                    where: { id: orderId },
                    include: { user: true, items: { include: { product: true } } }
                });
                if (updatedOrder) {
                    await emailService.sendOrderStatusUpdateEmail(order.user.email, updatedOrder, 'SHIPPED');
                }
            } catch (emailErr) {
                console.error('Failed to send shipping notification email:', emailErr);
            }
        }
      }

      return response;
    } catch (error: any) {
      console.error('Courier booking error:', error);
      return { success: false, message: error.message || 'API Integration error' };
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
