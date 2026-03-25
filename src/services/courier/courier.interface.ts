
export interface BookingRequest {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  totalAmount: number;
  weightInKg?: number;
  pieces?: number;
  isCod: boolean;
}

export interface BookingResponse {
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  bookingId?: string;
  message?: string;
}

export interface ICourierProvider {
  name: string;
  identifier: string;
  createBooking(request: BookingRequest, config: any): Promise<BookingResponse>;
}
