export interface TrackingTimeline {
  event: string;
  date: string;
  location: string;
  description?: string;
}

export interface TrackingResponse {
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  timeline: TrackingTimeline[];
  carrier?: string;
  estimatedDelivery?: string;
}

export interface IShipperAdapter {
  getTracking(trackingNumber: string): Promise<TrackingResponse>;
  getCarrierName(): string;
}

// ===== MOCK PAKISTAN SHIPPER ADAPTERS (TCS, LEOPARDS, TRAX) =====

class TCSPakistanAdapter implements IShipperAdapter {
  getCarrierName(): string {
    return 'TCS Pakistan';
  }

  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'OUT_FOR_DELIVERY',
      carrier: this.getCarrierName(),
      estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          event: 'Booking Confirmed',
          date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Karachi, Pakistan',
          description: 'Shipment booked'
        },
        {
          event: 'In Transit',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Lahore Hub',
          description: 'Package arrived at sorting facility'
        },
        {
          event: 'Out for Delivery',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Destination City',
          description: 'Package out for delivery to customer'
        }
      ]
    };
  }
}

class LeopardsAdapter implements IShipperAdapter {
  getCarrierName(): string {
    return 'Leopards Courier Service';
  }

  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'SHIPPED',
      carrier: this.getCarrierName(),
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          event: 'Order Picked Up',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Karachi, Pakistan',
          description: 'Package picked up from sender'
        },
        {
          event: 'In Transit',
          date: new Date().toISOString(),
          location: 'Islamabad Hub',
          description: 'Package in transit'
        }
      ]
    };
  }
}

class TraxAdapter implements IShipperAdapter {
  getCarrierName(): string {
    return 'Trax Courier';
  }

  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'IN_TRANSIT',
      carrier: this.getCarrierName(),
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          event: 'Booking Registered',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Karachi, Pakistan',
          description: 'Shipment created'
        }
      ]
    };
  }
}

export class TrackingService {
  private shipperAdapters: Map<string, IShipperAdapter> = new Map();

  constructor() {
    this.shipperAdapters.set('TCS_PK', new TCSPakistanAdapter());
    this.shipperAdapters.set('LEOPARDS_PK', new LeopardsAdapter());
    this.shipperAdapters.set('TRAX_PK', new TraxAdapter());
  }

  getShipperByCode(shipperCode: string): IShipperAdapter | null {
    return this.shipperAdapters.get(shipperCode) || null;
  }

  async track(trackingNumber: string, shipperCode: string): Promise<TrackingResponse | null> {
    try {
      const adapter = this.getShipperByCode(shipperCode);
      if (!adapter) {
        return null;
      }
      return await adapter.getTracking(trackingNumber);
    } catch (error) {
      console.error('Tracking service error:', error);
      return null;
    }
  }
}

export const trackingService = new TrackingService();
