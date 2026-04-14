// eslint-disable-next-line @typescript-eslint/no-var-requires
import Stripe from 'stripe';

/**
 * Helper to mask a sensitive key for display.
 * Shows first 10 chars and last 4 chars with asterisks in between.
 */
export function maskStripeKey(key: string): string {
    if (!key || key.length < 14) return '****';
    return `${key.slice(0, 10)}${'*'.repeat(key.length - 14)}${key.slice(-4)}`;
}

/**
 * Checks if a value is a masked key (i.e., not a real updated key)
 */
export function isMaskedKey(value: string): boolean {
    return typeof value === 'string' && value.includes('*');
}

/**
 * Initializes a Stripe client using the provided secret key.
 * Return type is inferred by TypeScript.
 */
export function createStripeClient(secretKey: string) {
    return new Stripe(secretKey, {
        apiVersion: '2024-11-20.acacia' as any,
        typescript: true
    });
}

/**
 * Creates a Stripe PaymentIntent.
 *
 * @param secretKey      Stripe secret key from gateway config
 * @param amountInCents  Amount in smallest currency unit (cents for USD)
 * @param currency       ISO currency code, e.g. 'usd'
 * @param orderId        Internal order ID for metadata
 * @param metadata       Additional metadata to attach
 */
export async function createPaymentIntent(
    secretKey: string,
    amountInCents: number,
    currency: string,
    orderId: string,
    metadata: Record<string, string> = {}
) {
    const stripe = createStripeClient(secretKey);
    const intent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: { orderId, ...metadata },
        automatic_payment_methods: { enabled: true }
    });
    return intent;
}

/**
 * Retrieves a Stripe PaymentIntent to verify its status.
 */
export async function retrievePaymentIntent(
    secretKey: string,
    paymentIntentId: string
) {
    const stripe = createStripeClient(secretKey);
    return await stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Constructs a Stripe webhook event from raw request body and signature.
 */
export function constructWebhookEvent(
    secretKey: string,
    webhookSecret: string,
    rawBody: Buffer,
    signature: string
) {
    const stripe = createStripeClient(secretKey);
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
