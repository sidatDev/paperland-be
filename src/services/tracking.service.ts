import { FastifyInstance } from 'fastify';

// ===== TYPES =====

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

// ===== SHIPPER ADAPTER INTERFACE =====

export interface IShipperAdapter {
  getTracking(trackingNumber: string): Promise<TrackingResponse>;
  getCarrierName(): string;
}

// ===== MOCK SHIPPER ADAPTERS =====

class AramexSAAdapter implements IShipperAdapter {
  getCarrierName(): string {
    return 'Aramex Saudi Arabia';
  }

  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    //  Mock response simulating Aramex API
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay

    return {
      status: 'IN_TRANSIT',
      carrier: this.getCarrierName(),
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          event: 'Order Received',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Riyadh, Saudi Arabia',
          description: 'Package received at origin facility'
        },
        {
          event: 'In Transit',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Jeddah Hub',
          description: 'Package in transit to destination city'
        },
        {
          event: 'Out for Delivery',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Dammam, Saudi Arabia',
          description: 'Package out for delivery'
        }
      ]
    };
  }
}

class EmiratesPostUAEAdapter implements IShipperAdapter {
  getCarrierName(): string {
    return 'Emirates Post';
  }

  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    // Mock response simulating Emirates Post API
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      status: 'SHIPPED',
      carrier: this.getCarrierName(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          event: 'Order Placed',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Dubai, UAE',
          description: 'Shipment created'
        },
        {
          event: 'Picked Up',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Dubai Sorting Center',
          description: 'Package picked up from sender'
        },
        {
          event: 'In Transit',
          date: new Date().toISOString(),
          location: 'Abu Dhabi Hub',
          description: 'Package in transit'
        }
      ]
    };
  }
}

class TCSPakistanAdapter implements IShipperAdapter {
  getCarrierName(): string {
    return 'TCS Pakistan';
  }

  async getTracking(trackingNumber: string): Promise<TrackingResponse> {
    // Mock response simulating TCS API
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
          location: 'Islamabad',
          description: 'Package out for delivery to customer'
        }
      ]
    };
  }
}

// ===== TRACKING SERVICE =====

export class TrackingService {
  private shipperAdapters: Map<string, IShipperAdapter> = new Map();

  constructor() {
    // Register regional shippers
    this.shipperAdapters.set('ARAMEX_SA', new AramexSAAdapter());
    this.shipperAdapters.set('EMIRATES_POST_UAE', new EmiratesPostUAEAdapter());
    this.shipperAdapters.set('TCS_PK', new TCSPakistanAdapter());
  }

  /**
   * Get shipper adapter based on region
   */
  getShipperByRegion(region: string): IShipperAdapter | null {
    const regionMap: Record<string, string> = {
      'SA': 'ARAMEX_SA',
      'AE': 'EMIRATES_POST_UAE',
      'PK': 'TCS_PK'
    };

    const shipperCode = regionMap[region];
    return shipperCode ? this.shipperAdapters.get(shipperCode) || null : null;
  }

  /**
   * Get shipper adapter by code
   */
  getShipperByCode(shipperCode: string): IShipperAdapter | null {
    return this.shipperAdapters.get(shipperCode) || null;
  }

  /**
   * Track shipment using region or shipper code
   */
  async track(trackingNumber: string, regionOrShipperCode: string): Promise<TrackingResponse | null> {
    try {
      // Try as region first
      let adapter = this.getShipperByRegion(regionOrShipperCode);
      
      // If not found, try as shipper code
      if (!adapter) {
        adapter = this.getShipperByCode(regionOrShipperCode);
      }

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

// Export singleton instance
export const trackingService = new TrackingService();
