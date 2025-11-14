/**
 * Authentication Middleware for Lambda Functions
 * Validates JWT tokens and attaches user information to the event
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';
import { AuthenticationError } from '../types/errors';
import { IAuthService, createAuthService } from '../services/auth-service';

/**
 * Extended API Gateway Event with authenticated user information
 */
export interface AuthenticatedEvent extends APIGatewayEvent {
  user?: {
    userId: string;
    email?: string;
  };
}

/**
 * Lambda handler type
 */
export type LambdaHandler = (event: AuthenticatedEvent) => Promise<APIGatewayResponse>;

/**
 * Authentication middleware configuration
 */
export interface AuthMiddlewareConfig {
  authService?: IAuthService;
  required?: boolean; // If false, allows requests without auth but still validates if present
}

/**
 * Extract token from Authorization header
 * Supports both "Bearer <token>" and "<token>" formats
 */
function extractToken(event: APIGatewayEvent): string | null {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;

  if (!authHeader) {
    return null;
  }

  // Remove 'Bearer ' prefix if present
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

/**
 * Create error response
 */
function createErrorResponse(
  statusCode: number,
  error: string,
  message: string
): APIGatewayResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error,
      message,
    }),
  };
}

/**
 * Authentication middleware factory
 * Returns a middleware function that wraps Lambda handlers
 *
 * @param config - Middleware configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const handler = withAuth(async (event: AuthenticatedEvent) => {
 *   const userId = event.user?.userId;
 *   // ... handler logic
 * });
 * ```
 */
export function withAuth(
  handler: LambdaHandler,
  config: AuthMiddlewareConfig = {}
): (event: APIGatewayEvent) => Promise<APIGatewayResponse> {
  const authService = config.authService || createAuthService();
  const required = config.required !== false; // Default to true

  return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
    try {
      // Extract token from Authorization header
      const token = extractToken(event);

      // If no token and auth is required, return 401
      if (!token && required) {
        return createErrorResponse(
          401,
          'AUTHENTICATION_REQUIRED',
          'Authorization header is required'
        );
      }

      // If token is present, validate it
      if (token) {
        const validationResult = await authService.validateToken(token);

        if (!validationResult.isValid) {
          return createErrorResponse(
            401,
            'INVALID_TOKEN',
            validationResult.error || 'Token validation failed'
          );
        }

        // Attach user information to event
        const authenticatedEvent = event as AuthenticatedEvent;
        authenticatedEvent.user = {
          userId: validationResult.userId!,
          email: validationResult.email,
        };

        // Call the handler with authenticated event
        return await handler(authenticatedEvent);
      }

      // No token but auth not required - proceed without user info
      return await handler(event as AuthenticatedEvent);
    } catch (error) {
      // Handle authentication errors
      if (error instanceof AuthenticationError) {
        return createErrorResponse(error.statusCode, error.code, error.message);
      }

      // Handle unexpected errors
      console.error('Authentication middleware error:', error);
      return createErrorResponse(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred during authentication'
      );
    }
  };
}

/**
 * Optional authentication middleware
 * Validates token if present but doesn't require it
 *
 * @example
 * ```typescript
 * const handler = withOptionalAuth(async (event: AuthenticatedEvent) => {
 *   if (event.user) {
 *     // User is authenticated
 *   } else {
 *     // Anonymous access
 *   }
 * });
 * ```
 */
export function withOptionalAuth(
  handler: LambdaHandler
): (event: APIGatewayEvent) => Promise<APIGatewayResponse> {
  return withAuth(handler, { required: false });
}

/**
 * Require specific user (by userId)
 * Useful for endpoints that should only be accessible by the resource owner
 *
 * @param handler - Lambda handler
 * @param getUserId - Function to extract userId from event (e.g., from path parameters)
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const handler = requireUser(
 *   async (event) => { ... },
 *   (event) => event.pathParameters?.userId
 * );
 * ```
 */
export function requireUser(
  handler: LambdaHandler,
  getUserId: (event: APIGatewayEvent) => string | undefined
): (event: APIGatewayEvent) => Promise<APIGatewayResponse> {
  return withAuth(async (event: AuthenticatedEvent) => {
    const requestedUserId = getUserId(event);
    const authenticatedUserId = event.user?.userId;

    if (!requestedUserId) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'User ID is required');
    }

    if (authenticatedUserId !== requestedUserId) {
      return createErrorResponse(
        403,
        'FORBIDDEN',
        'You do not have permission to access this resource'
      );
    }

    return await handler(event);
  });
}
