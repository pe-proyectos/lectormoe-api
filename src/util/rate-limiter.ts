/**
 * Simple in-memory rate limiter for protecting sensitive endpoints
 * SECURITY: Prevents brute force attacks on authentication and payment endpoints
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: Timer;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.requests.entries()) {
        if (now > entry.resetAt) {
          this.requests.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed based on rate limits
   * @param identifier - Unique identifier (IP address, user ID, email, etc.)
   * @param maxRequests - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns { allowed: boolean, remainingRequests: number, resetAt: number }
   */
  checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; remainingRequests: number; resetAt: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    // If no entry exists or the window has expired, create a new entry
    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowMs;
      this.requests.set(identifier, {
        count: 1,
        resetAt,
      });
      return {
        allowed: true,
        remainingRequests: maxRequests - 1,
        resetAt,
      };
    }

    // If limit exceeded, deny the request
    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetAt: entry.resetAt,
      };
    }

    // Increment the count
    entry.count++;
    this.requests.set(identifier, entry);

    return {
      allowed: true,
      remainingRequests: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   * Useful after successful login to reset failed attempt counter
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Get current status for an identifier without incrementing count
   */
  getStatus(identifier: string): { count: number; resetAt: number } | null {
    return this.requests.get(identifier) || null;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Auth endpoints: 5 requests per 15 minutes per IP
  AUTH_LOGIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 },

  // Password reset: 3 requests per hour per email
  PASSWORD_RESET: { maxRequests: 3, windowMs: 60 * 60 * 1000 },

  // Registration: 3 accounts per hour per IP
  REGISTRATION: { maxRequests: 3, windowMs: 60 * 60 * 1000 },

  // Subscription webhook: 100 requests per minute per endpoint
  WEBHOOK: { maxRequests: 100, windowMs: 60 * 1000 },
};
