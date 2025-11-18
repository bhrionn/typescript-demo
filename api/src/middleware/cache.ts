/**
 * Response Caching Middleware for Lambda Functions
 * Implements in-memory caching with TTL
 * Requirements: Performance optimization
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';
import { createLogger } from './logging';

/**
 * Cache entry
 */
interface CacheEntry {
  response: APIGatewayResponse;
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Time to live in seconds
   */
  ttl: number;

  /**
   * Key generator function
   */
  keyGenerator?: (event: APIGatewayEvent) => string;

  /**
   * Methods to cache (default: GET only)
   */
  methods?: string[];

  /**
   * Skip caching for certain requests
   */
  skip?: (event: APIGatewayEvent) => boolean;

  /**
   * Only cache responses with these status codes
   */
  statusCodes?: number[];

  /**
   * Include query parameters in cache key
   */
  includeQueryParams?: boolean;

  /**
   * Include headers in cache key (e.g., for authorization)
   */
  includeHeaders?: string[];
}

/**
 * Cache store
 */
class CacheStore {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Get cached entry
   */
  get(key: string): APIGatewayResponse | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    // Increment hit counter
    entry.hits++;

    return entry.response;
  }

  /**
   * Set cache entry
   */
  set(key: string, response: APIGatewayResponse, ttl: number): void {
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    });
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        entriesToDelete.push(key);
      }
    }

    for (const key of entriesToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Math.floor((now - entry.timestamp) / 1000),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Destroy the store
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Global cache store
 */
const cacheStore = new CacheStore();

/**
 * Lambda handler type
 */
export type CacheWrappedHandler = (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Default key generator
 */
function defaultKeyGenerator(
  event: APIGatewayEvent,
  includeQueryParams: boolean = true,
  includeHeaders: string[] = []
): string {
  const parts: string[] = [event.httpMethod || '', event.path || ''];

  // Include query parameters
  if (includeQueryParams && event.queryStringParameters) {
    const sortedParams = Object.entries(event.queryStringParameters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    if (sortedParams) {
      parts.push(sortedParams);
    }
  }

  // Include specific headers
  if (includeHeaders.length > 0 && event.headers) {
    for (const header of includeHeaders) {
      const value = event.headers[header] || event.headers[header.toLowerCase()];
      if (value) {
        parts.push(`${header}:${value}`);
      }
    }
  }

  return parts.join('|');
}

/**
 * Cache middleware
 * Caches API responses to improve performance
 *
 * @param config - Cache configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * export const handler = compose(
 *   cacheMiddleware({ ttl: 300, methods: ['GET'] }),
 *   async (event) => {
 *     // Handler logic
 *     return { statusCode: 200, body: '{}' };
 *   }
 * );
 * ```
 */
export function cacheMiddleware(config: CacheConfig) {
  const logger = createLogger({ middleware: 'cacheMiddleware' });

  const {
    ttl,
    keyGenerator,
    methods = ['GET'],
    skip,
    statusCodes = [200],
    includeQueryParams = true,
    includeHeaders = [],
  } = config;

  return function (handler: CacheWrappedHandler): CacheWrappedHandler {
    return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
      const method = event.httpMethod || '';

      // Skip if method not in allowed list
      if (!methods.includes(method)) {
        return handler(event);
      }

      // Skip if custom skip function returns true
      if (skip && skip(event)) {
        return handler(event);
      }

      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator(event)
        : defaultKeyGenerator(event, includeQueryParams, includeHeaders);

      // Try to get from cache
      const cached = cacheStore.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit', { cacheKey, path: event.path });

        // Add cache hit header
        return {
          ...cached,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
          },
        };
      }

      logger.debug('Cache miss', { cacheKey, path: event.path });

      // Execute handler
      const response = await handler(event);

      // Cache response if status code matches
      if (statusCodes.includes(response.statusCode)) {
        cacheStore.set(cacheKey, response, ttl);
        logger.debug('Response cached', { cacheKey, ttl, statusCode: response.statusCode });
      }

      // Add cache miss header
      return {
        ...response,
        headers: {
          ...response.headers,
          'X-Cache': 'MISS',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      };
    };
  };
}

/**
 * Get cache store (for cache management)
 */
export function getCacheStore(): CacheStore {
  return cacheStore;
}

/**
 * Invalidate cache entry
 */
export function invalidateCache(key: string): void {
  cacheStore.delete(key);
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCacheByPattern(pattern: RegExp): number {
  const stats = cacheStore.getStats();
  let count = 0;

  for (const entry of stats.entries) {
    if (pattern.test(entry.key)) {
      cacheStore.delete(entry.key);
      count++;
    }
  }

  return count;
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cacheStore.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; hits: number; age: number }>;
} {
  return cacheStore.getStats();
}
