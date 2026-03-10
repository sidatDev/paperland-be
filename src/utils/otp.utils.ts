/**
 * OTP Utility Functions
 * Handles OTP generation, validation, and expiry checks
 */

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get OTP expiry time (10 minutes from now)
 */
export function getOTPExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);
  return expiry;
}

/**
 * Check if OTP has expired
 */
export function isOTPExpired(expiryDate: Date): boolean {
  return new Date() > new Date(expiryDate);
}

/**
 * Validate OTP code format
 */
export function isValidOTPFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Compare OTP codes (constant-time comparison to prevent timing attacks)
 */
export function compareOTP(provided: string, stored: string): boolean {
  if (provided.length !== stored.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < provided.length; i++) {
    result |= provided.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Rate limiting helper - check if enough time has passed since last OTP send
 * @param lastSentTime - Timestamp of last OTP sent
 * @param minIntervalMinutes - Minimum interval between sends (default: 1 minute)
 */
export function canResendOTP(lastSentTime: Date, minIntervalMinutes: number = 1): boolean {
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastSentTime).getTime();
  const diffMinutes = diffMs / (1000 * 60);
  
  return diffMinutes >= minIntervalMinutes;
}

/**
 * Get remaining time in seconds before OTP can be resent
 */
export function getRemainingResendTime(lastSentTime: Date, minIntervalMinutes: number = 1): number {
  const now = new Date();
  const diffMs = now.getTime() - new Date(lastSentTime).getTime();
  const diffSeconds = diffMs / 1000;
  const requiredSeconds = minIntervalMinutes * 60;
  
  return Math.max(0, Math.ceil(requiredSeconds - diffSeconds));
}
