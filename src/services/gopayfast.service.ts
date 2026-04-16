import crypto from 'crypto';

// ── GoPayFast API Endpoints ─────────────────────────────────
export const GOPAYFAST_SANDBOX_URL = 'https://sandbox.gopayfast.com/api/v1/payment';
export const GOPAYFAST_LIVE_URL    = 'https://gopayfast.com/api/v1/payment';

/**
 * Mask a GoPayFast secure key for safe display in admin UI.
 * Shows first 4 and last 4 chars with asterisks in between.
 */
export function maskGoPayFastKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}

/**
 * Returns true if the value is a masked placeholder (contains '*').
 */
export function isGoPayFastKeyMasked(value: string): boolean {
    return typeof value === 'string' && value.includes('*');
}

/**
 * SHA-256 hash generation.
 * Field order: merchant_id + order_id + amount + secure_key
 * (must match GoPayFast documentation exactly)
 */
export function generateGoPayFastHash(
    merchantId: string,
    orderId: string,
    amount: string,
    secureKey: string
): string {
    const raw = `${merchantId}${orderId}${amount}${secureKey}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Verifies the hash received in an IPN call.
 * Returns true if hash is valid, false otherwise.
 */
export function verifyGoPayFastIpn(payload: {
    merchantId: string;
    orderId: string;
    amount: string;
    secureKey: string;
    receivedHash: string;
}): boolean {
    const computed = generateGoPayFastHash(
        payload.merchantId,
        payload.orderId,
        payload.amount,
        payload.secureKey
    );
    // Use timingSafeEqual to prevent timing attacks
    try {
        const a = Buffer.from(computed, 'utf8');
        const b = Buffer.from(payload.receivedHash, 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

/**
 * Builds the GoPayFast payment session.
 * Returns:
 *   - paymentUrl: the GoPayFast hosted payment page URL
 *   - formFields: signed form fields to POST to paymentUrl
 */
export function buildGoPayFastSession(
    config: {
        merchantId: string;
        secureKey: string;
        mode: 'sandbox' | 'live';
        returnUrl: string;
        ipnUrl: string;
    },
    order: {
        id: string;
        orderNumber: string;
        totalAmount: number;
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string;
    }
): { paymentUrl: string; formFields: Record<string, string> } {
    const paymentUrl = config.mode === 'live' ? GOPAYFAST_LIVE_URL : GOPAYFAST_SANDBOX_URL;
    const amount     = order.totalAmount.toFixed(2);
    const hash       = generateGoPayFastHash(config.merchantId, order.id, amount, config.secureKey);

    const formFields: Record<string, string> = {
        merchant_id:   config.merchantId,
        order_id:      order.id,
        amount,
        currency:      'PKR',
        description:   `Order ${order.orderNumber} - PaperLand`,
        customer_name: (order.customerName || 'Customer').slice(0, 64),
        customer_email: order.customerEmail || '',
        customer_phone: order.customerPhone || '',
        return_url:    config.returnUrl,
        ipn_url:       config.ipnUrl,
        hash,
    };

    return { paymentUrl, formFields };
}
