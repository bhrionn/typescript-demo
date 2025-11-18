/**
 * Rate Limiting Middleware for Lambda Functions
 * Implements token bucket algorithm to prevent API abuse
 * Requirements: Security best practices
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';
import { createLogger } from './logging';
import { AppError } from '../types/errors';

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      429,
      true,
      { retryAfter }
    );
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Key extractor function (defaults to IP address)
   */
  keyExtractor?: (event: APIGatewayEvent) => string;

  /**
   * Skip rate limiting for certain requests
   */
  skip?: (event: APIGatewayEvent) => boolean;
}

/**
 * Rate limit bucket entry
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  requestCount: number;
}

/**
 * In-memory rate limit store
 * Note: This is suitable for Lambda but resets on cold starts
 * For production, consider using DynamoDB or Redis
 */
class RateLimitStore {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Get or create a bucket for a key
   */
  getBucket(key: string, maxRequests: number): RateLimitBucket {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        tokens: maxRequests,
        lastRefill: Date.now(),
        requestCount: 0,
      });
    }
    return this.buckets.get(key)!;
  }

  /**
   * Update bucket
   */
  updateBucket(key: string, bucket: RateLimitBucket): void {
    this.buckets.set(key, bucket);
  }

  /**
   * Clean up old entries (older than 1 hour)
   */
  private cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastRefill < oneHourAgo) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Get store size (for monitoring)
   */
  getSize(): number {
    return this.buckets.size;
  }

  /**
   * Clear all buckets (for testing)
   */
  clear(): void {
    this.buckets.clear();
  }

  /**
   * Destroy the store
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }
}

/**
 * Global rate limit store instance
 */
const rateLimitStore = new RateLimitStore();

/**
 * Lambda handler type
 */
export type RateLimitWrappedHandler = (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Default key extractor - uses source IP address
 */
function defaultKeyExtractor(event: APIGatewayEvent): string {
  const sourceIp = event.requestContext?.identity?.sourceIp || 'unknown';
  const path = event.path || '';
  return `${sourceIp}:${path}`;
}

/**
 * Check rate limit for a key
 */
function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateLimitStore.getBucket(key, config.maxRequests);

  // Refill tokens based on time elapsed
  const timeElapsed = (now - bucket.lastRefill) / 1000; // seconds
  const refillRate = config.maxRequests / config.windowSeconds;
  const tokensToAdd = timeElapsed * refillRate;

  bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  // Check if request can be allowed
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    bucket.requestCount += 1;
    rateLimitStore.updateBucket(key, bucket);
    return { allowed: true, retryAfter: 0 };
  }

  // Calculate retry after time
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfter = Math.ceil(tokensNeeded / refillRate);

  return { allowed: false, retryAfter };
}

/**
 * Rate limiting middleware
 * Implements token bucket algorithm to limit requests per IP/user
 *
 * @param config - Rate limit configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * export const handler = compose(
 *   rateLimitMiddleware({ maxRequests: 100, windowSeconds: 60 }),
 *   async (event) => {
 *     // Handler logic
 *     return { statusCode: 200, body: '{}' };
 *   }
 * );
 * ```
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  const logger = createLogger({ middleware: 'rateLimitMiddleware' });

  return function (handler: RateLimitWrappedHandler): RateLimitWrappedHandler {
    return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
      // Skip rate limiting if configured
      if (config.skip && config.skip(event)) {
        return handler(event);
      }

      // Extract key (IP address or custom)
      const keyExtractor = config.keyExtractor || defaultKeyExtractor;
      const key = keyExtractor(event);

      // Check rate limit
      const { allowed, retryAfter } = checkRateLimit(key, config);

      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          key,
          path: event.path,
          method: event.httpMethod,
          retryAfter,
        });

        const error = new RateLimitError(retryAfter);
        return {
          statusCode: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': (Date.now() + retryAfter * 1000).toString(),
          },
          body: JSON.stringify(error.toJSON()),
        };
      }

      // Add rate limit headers to response
      const response = await handler(event);

      // Add rate limit info to headers
      return {
        ...response,
        headers: {
          ...response.headers,
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.floor(
            rateLimitStore.getBucket(key, config.maxRequests).tokens
          ).toString(),
        },
      };
    };
  };
}

/**
 * Get rate limit store (for testing and monitoring)
 */
export function getRateLimitStore(): RateLimitStore {
  return rateLimitStore;
}

/**
 * Clear rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
