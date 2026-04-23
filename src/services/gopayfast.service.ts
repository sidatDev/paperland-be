import crypto from 'crypto';
import axios from 'axios';

// ── APPS (PayFast Pakistan) API Endpoints ────────────────────
export const APPS_TOKEN_UAT_URL       = 'https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken';
export const APPS_TOKEN_LIVE_URL      = 'https://ipg.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken';

export const APPS_TRANSACTION_UAT_URL = 'https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction';
export const APPS_TRANSACTION_LIVE_URL = 'https://ipg.apps.net.pk/Ecommerce/api/Transaction/PostTransaction';

/**
 * Mask a sensitive key for safe display in admin UI.
 */
export function maskGoPayFastKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`;
}

/**
 * Returns true if the value is a masked placeholder.
 */
export function isGoPayFastKeyMasked(value: string): boolean {
    return typeof value === 'string' && value.includes('*');
}

/**
 * Fetch Access Token from APPS IPG.
 */
export async function getAppsAccessToken(
    merchantId: string,
    securedKey: string,
    mode: 'sandbox' | 'live' = 'sandbox'
): Promise<string> {
    const url = mode === 'live' ? APPS_TOKEN_LIVE_URL : APPS_TOKEN_UAT_URL;
    
    try {
        const response = await axios.post(url, {
            MERCHANT_ID: merchantId,
            SECURED_KEY: securedKey
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data && response.data.ACCESS_TOKEN) {
            return response.data.ACCESS_TOKEN;
        }
        
        throw new Error(response.data?.MESSAGE || 'Failed to retrieve access token from APPS');
    } catch (err: any) {
        const msg = err.response?.data?.MESSAGE || err.message;
        throw new Error(`APPS Token Error: ${msg}`);
    }
}

/**
 * Verification for IPN (Webhook) - Hashing style varies by gateway version.
 * For APPS IPG, they usually send back a set of fields that we can verify.
 */
export function verifyGoPayFastIpn(payload: {
    merchantId: string;
    orderId: string;
    amount: string;
    secureKey: string;
    receivedHash: string;
}): boolean {
    // Note: APPS IPN verification might use a different logic. 
    // This is a placeholder for now until exact IPN format is confirmed.
    const raw = `${payload.merchantId}${payload.orderId}${payload.amount}${payload.secureKey}`;
    const computed = crypto.createHash('sha256').update(raw).digest('hex');
    
    try {
        const a = Buffer.from(computed, 'utf8');
        const b = Buffer.from(payload.receivedHash, 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}
