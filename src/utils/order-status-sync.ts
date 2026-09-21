export interface OrderStatusSyncContext {
  status?: string | null;
  deliveryStatus?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  logisticsType?: string | null;
  processingDate?: Date | null;
  shippedDate?: Date | null;
  deliveredDate?: Date | null;
}

/**
 * Computes synchronized updates across order status, delivery status, payment status, and milestone dates.
 * Follows DRY principal so single updates, bulk updates, and logistics updates stay 100% consistent.
 */
export function computeSynchronizedOrderFields(
  currentOrder: OrderStatusSyncContext,
  incoming: {
    status?: string;
    deliveryStatus?: string;
    paymentStatus?: string;
  }
): Record<string, any> {
  const result: Record<string, any> = {};

  // Normalize inputs
  const targetStatus = incoming.status?.toUpperCase();
  const targetDeliveryStatus = incoming.deliveryStatus?.toUpperCase();
  const currentPaymentStatus = currentOrder.paymentStatus?.toUpperCase();
  const isCod =
    currentOrder.paymentMethod?.toUpperCase() === 'COD' ||
    currentOrder.paymentMethod?.toLowerCase().includes('cash');

  // Case 1: Overall Order Status is explicitly updated
  if (targetStatus) {
    result.status = targetStatus;

    switch (targetStatus) {
      case 'PROCESSING':
        if (!currentOrder.processingDate) {
          result.processingDate = new Date();
        }
        if (!currentOrder.deliveryStatus || currentOrder.deliveryStatus.toUpperCase() === 'PENDING') {
          result.deliveryStatus = 'PENDING';
        }
        break;

      case 'SHIPPED':
        if (!currentOrder.shippedDate) {
          result.shippedDate = new Date();
        }
        result.deliveryStatus =
          currentOrder.logisticsType === 'SELF_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'SHIPPED';
        break;

      case 'DELIVERED':
      case 'COMPLETED':
        if (!currentOrder.deliveredDate) {
          result.deliveredDate = new Date();
        }
        result.deliveryStatus = 'DELIVERED';
        // When delivered, if order is Cash on Delivery and payment was unpaid/pending, mark as PAID
        if (isCod && currentPaymentStatus !== 'PAID') {
          result.paymentStatus = 'PAID';
        }
        break;

      case 'CANCELLED':
        if (currentOrder.deliveryStatus?.toUpperCase() !== 'DELIVERED') {
          result.deliveryStatus = 'CANCELLED';
        }
        break;

      case 'RETURN_REQUESTED':
        result.deliveryStatus = 'RETURN_REQUESTED';
        break;

      case 'REFUNDED':
        result.paymentStatus = 'REFUNDED';
        break;
    }
  }

  // Case 2: Delivery Status is explicitly updated (e.g. from logistics management)
  if (targetDeliveryStatus) {
    result.deliveryStatus = targetDeliveryStatus;

    switch (targetDeliveryStatus) {
      case 'DELIVERED':
        result.status = 'DELIVERED';
        if (!currentOrder.deliveredDate) {
          result.deliveredDate = new Date();
        }
        if (isCod && currentPaymentStatus !== 'PAID') {
          result.paymentStatus = 'PAID';
        }
        break;

      case 'SHIPPED':
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
        if (!targetStatus && (currentOrder.status === 'PENDING' || currentOrder.status === 'PROCESSING')) {
          result.status = 'SHIPPED';
          if (!currentOrder.shippedDate) {
            result.shippedDate = new Date();
          }
        }
        break;

      case 'RETURNED':
        if (currentOrder.status !== 'CANCELLED' && currentOrder.status !== 'REFUNDED') {
          result.status = 'RETURN_REQUESTED';
        }
        break;
    }
  }

  // Case 3: Explicit payment status override
  if (incoming.paymentStatus) {
    result.paymentStatus = incoming.paymentStatus;
  }

  return result;
}
