import crypto from 'crypto';

/**
 * Generates a robust, unique Order Number.
 * Format: ORD-YYMM-[RANDOM_4_CHARS]
 * Example: ORD-2605-A7B2
 */
export function generateOrderNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Generate 4 random alphanumeric characters
    const randomChars = crypto.randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
    
    return `ORD-${year}${month}-${randomChars}`;
}
