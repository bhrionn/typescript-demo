/**
 * Response Formatter Utilities
 * Provides consistent response formatting for Lambda functions
 * Requirements: 3.7
 * Following SOLID principles: Single Responsibility
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { APIGatewayResponse } from '../types/api';
import { AppError } from '../types/errors';

/**
 * Standard response headers
 */
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Response formatter options
 */
interface ResponseOptions {
  headers?: Record<string, string>;
  statusCode?: number;
}

/**
 * Format success response with data
 *
 * @param data - Response data
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatSuccessResponse<T = any>(
  data: T,
  options: ResponseOptions = {}
): APIGatewayResponse {
  return {
    statusCode: options.statusCode || 200,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

/**
 * Format created response (201)
 *
 * @param data - Created resource data
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatCreatedResponse<T = any>(
  data: T,
  options: ResponseOptions = {}
): APIGatewayResponse {
  return formatSuccessResponse(data, {
    ...options,
    statusCode: 201,
  });
}

/**
 * Format no content response (204)
 *
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatNoContentResponse(options: ResponseOptions = {}): APIGatewayResponse {
  return {
    statusCode: 204,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: '',
  };
}

/**
 * Format error response
 *
 * @param error - Error object or message
 * @param statusCode - HTTP status code (default: 500)
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatErrorResponse(
  error: Error | string,
  statusCode: number = 500,
  options: ResponseOptions = {}
): APIGatewayResponse {
  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      body: JSON.stringify(error.toJSON()),
    };
  }

  // Handle Error instances
  if (error instanceof Error) {
    return {
      statusCode,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      body: JSON.stringify({
        error: 'ERROR',
        message: error.message,
      }),
    };
  }

  // Handle string errors
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: JSON.stringify({
      error: 'ERROR',
      message: error,
    }),
  };
}

/**
 * Format validation error response (400)
 *
 * @param message - Error message
 * @param errors - Validation errors array
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatValidationErrorResponse(
  message: string,
  errors?: string[],
  options: ResponseOptions = {}
): APIGatewayResponse {
  return {
    statusCode: 400,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: JSON.stringify({
      error: 'VALIDATION_ERROR',
      message,
      details: errors,
    }),
  };
}

/**
 * Format unauthorized response (401)
 *
 * @param message - Error message
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatUnauthorizedResponse(
  message: string = 'Authentication required',
  options: ResponseOptions = {}
): APIGatewayResponse {
  return {
    statusCode: 401,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: JSON.stringify({
      error: 'UNAUTHORIZED',
      message,
    }),
  };
}

/**
 * Format forbidden response (403)
 *
 * @param message - Error message
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatForbiddenResponse(
  message: string = 'Access denied',
  options: ResponseOptions = {}
): APIGatewayResponse {
  return {
    statusCode: 403,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: JSON.stringify({
      error: 'FORBIDDEN',
      message,
    }),
  };
}

/**
 * Format not found response (404)
 *
 * @param resource - Resource name
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatNotFoundResponse(
  resource: string = 'Resource',
  options: ResponseOptions = {}
): APIGatewayResponse {
  return {
    statusCode: 404,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
    body: JSON.stringify({
      error: 'NOT_FOUND',
      message: `${resource} not found`,
    }),
  };
}

/**
 * Format paginated response
 *
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatPaginatedResponse<T = any>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  },
  options: ResponseOptions = {}
): APIGatewayResponse {
  const totalPages = pagination.totalPages || Math.ceil(pagination.total / pagination.limit);

  return formatSuccessResponse(
    {
      items: data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    },
    options
  );
}

/**
 * Format redirect response (302)
 *
 * @param location - Redirect URL
 * @param options - Additional response options
 * @returns Formatted API Gateway response
 */
export function formatRedirectResponse(
  location: string,
  options: ResponseOptions = {}
): APIGatewayResponse {
  return {
    statusCode: 302,
    headers: {
      ...DEFAULT_HEADERS,
      Location: location,
      ...options.headers,
    },
    body: '',
  };
}

/**
 * Add cache headers to response
 *
 * @param response - API Gateway response
 * @param maxAge - Cache max age in seconds
 * @returns Response with cache headers
 */
export function withCacheHeaders(response: APIGatewayResponse, maxAge: number): APIGatewayResponse {
  return {
    ...response,
    headers: {
      ...response.headers,
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  };
}

/**
 * Add no-cache headers to response
 *
 * @param response - API Gateway response
 * @returns Response with no-cache headers
 */
export function withNoCacheHeaders(response: APIGatewayResponse): APIGatewayResponse {
  return {
    ...response,
    headers: {
      ...response.headers,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  };
}
