/**
 * Error Handling Middleware for Lambda Functions
 * Provides consistent error responses across all handlers
 * Requirements: 3.7, 8.16
 * Following SOLID principles: Single Responsibility
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { APIGatewayResponse } from '../types/api';
import { AppError } from '../types/errors';
import { createLogger } from './logging';

/**
 * Lambda handler type that may throw errors
 */
export type ErrorHandlerWrappedHandler = (...args: any[]) => Promise<APIGatewayResponse>;

/**
 * Format error response with proper structure
 */
function formatErrorResponse(error: Error, requestId?: string): APIGatewayResponse {
  const logger = createLogger({ requestId });

  // Handle known AppError types
  if (error instanceof AppError) {
    logger.error('Application error occurred', {
      errorType: error.name,
      errorCode: error.code,
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    });

    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(error.toJSON()),
    };
  }

  // Handle unexpected errors - don't expose internal details
  logger.error('Unexpected error occurred', {
    errorType: error.name,
    message: error.message,
    stack: error.stack,
  });

  return {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }),
  };
}

/**
 * Error handling middleware
 * Wraps Lambda handlers to catch and format errors consistently
 *
 * @param handler - Lambda handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```typescript
 * export const handler = withErrorHandler(async (event) => {
 *   // Handler logic that may throw errors
 *   throw new ValidationError('Invalid input');
 * });
 * ```
 */
export function withErrorHandler(handler: ErrorHandlerWrappedHandler): ErrorHandlerWrappedHandler {
  return async (...args: any[]): Promise<APIGatewayResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Try to extract requestId from the first argument (event)
      const event = args[0];
      const requestId = event?.requestContext?.requestId;
      return formatErrorResponse(error as Error, requestId);
    }
  };
}

/**
 * Async error wrapper for promise-based operations
 * Useful for wrapping async operations that may throw
 *
 * @param fn - Async function to wrap
 * @returns Wrapped function that catches errors
 */
export async function catchAsync<T>(fn: () => Promise<T>): Promise<[Error | null, T | null]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (error) {
    return [error as Error, null];
  }
}
