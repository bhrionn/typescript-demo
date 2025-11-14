/**
 * Middleware Composition Utilities
 * Provides helpers to compose multiple middleware functions
 * Requirements: 3.7, 8.16
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';
import { withErrorHandler } from './error-handler';
import { withLogging } from './logging';
import { withCors } from './cors';
import { withAuth } from './auth-middleware';

/**
 * Generic middleware function type
 */
export type Middleware = (
  handler: (event: APIGatewayEvent) => Promise<APIGatewayResponse>
) => (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Compose multiple middleware functions into a single middleware
 * Middleware are applied from right to left (last to first)
 *
 * @param middlewares - Array of middleware functions
 * @returns Composed middleware function
 *
 * @example
 * ```typescript
 * const handler = compose(
 *   withErrorHandler,
 *   withLogging,
 *   withCors,
 *   withAuth
 * )(async (event) => {
 *   return { statusCode: 200, body: '{}' };
 * });
 * ```
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler: (event: APIGatewayEvent) => Promise<APIGatewayResponse>) => {
    return middlewares.reduceRight(
      (wrappedHandler, middleware) => middleware(wrappedHandler),
      handler
    );
  };
}

/**
 * Create a standard handler with common middleware
 * Includes error handling, logging, and CORS by default
 *
 * @param handler - Lambda handler function
 * @param options - Middleware options
 * @returns Wrapped handler with standard middleware
 *
 * @example
 * ```typescript
 * export const handler = createHandler(async (event) => {
 *   return formatSuccessResponse({ message: 'Hello' });
 * });
 * ```
 */
export function createHandler(
  handler: (event: APIGatewayEvent) => Promise<APIGatewayResponse>,
  options: {
    withAuth?: boolean;
    withLogging?: boolean;
    withCors?: boolean;
    withErrorHandler?: boolean;
  } = {}
): (event: APIGatewayEvent) => Promise<APIGatewayResponse> {
  const {
    withAuth: includeAuth = false,
    withLogging: includeLogging = true,
    withCors: includeCors = true,
    withErrorHandler: includeErrorHandler = true,
  } = options;

  const middlewares: Middleware[] = [];

  // Add middleware in order (they will be applied in reverse)
  if (includeErrorHandler) {
    middlewares.push(withErrorHandler);
  }

  if (includeLogging) {
    middlewares.push(withLogging);
  }

  if (includeCors) {
    middlewares.push(withCors);
  }

  if (includeAuth) {
    middlewares.push(withAuth);
  }

  return compose(...middlewares)(handler);
}

/**
 * Create an authenticated handler with standard middleware
 * Includes auth, error handling, logging, and CORS
 *
 * @param handler - Lambda handler function
 * @returns Wrapped handler with auth and standard middleware
 *
 * @example
 * ```typescript
 * export const handler = createAuthenticatedHandler(async (event) => {
 *   const userId = event.user?.userId;
 *   return formatSuccessResponse({ userId });
 * });
 * ```
 */
export function createAuthenticatedHandler(
  handler: (event: APIGatewayEvent) => Promise<APIGatewayResponse>
): (event: APIGatewayEvent) => Promise<APIGatewayResponse> {
  return createHandler(handler, { withAuth: true });
}
