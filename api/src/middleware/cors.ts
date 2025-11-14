/**
 * CORS Middleware for Lambda Functions
 * Adds CORS headers to responses
 * Requirements: 3.7
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';

/**
 * CORS configuration options
 */
export interface CorsConfig {
  allowOrigin?: string | string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  allowCredentials?: boolean;
}

/**
 * Default CORS configuration
 */
const DEFAULT_CORS_CONFIG: CorsConfig = {
  allowOrigin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Amz-Date',
    'X-Api-Key',
    'X-Amz-Security-Token',
    'X-File-Name',
    'X-Mime-Type',
    'X-Metadata',
  ],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
  allowCredentials: false,
};

/**
 * Lambda handler type
 */
export type CorsWrappedHandler = (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Determine allowed origin based on configuration and request
 */
function getAllowedOrigin(config: CorsConfig, event: APIGatewayEvent): string {
  const requestOrigin = event.headers?.origin || event.headers?.Origin;

  // If allowOrigin is '*', return it
  if (config.allowOrigin === '*') {
    return '*';
  }

  // If allowOrigin is an array, check if request origin is in the list
  if (Array.isArray(config.allowOrigin)) {
    if (requestOrigin && config.allowOrigin.includes(requestOrigin)) {
      return requestOrigin;
    }
    // Default to first allowed origin if request origin not in list
    return config.allowOrigin[0] || '*';
  }

  // If allowOrigin is a string, return it
  return config.allowOrigin || '*';
}

/**
 * Build CORS headers based on configuration
 */
function buildCorsHeaders(config: CorsConfig, event: APIGatewayEvent): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': getAllowedOrigin(config, event),
  };

  if (config.allowMethods && config.allowMethods.length > 0) {
    headers['Access-Control-Allow-Methods'] = config.allowMethods.join(', ');
  }

  if (config.allowHeaders && config.allowHeaders.length > 0) {
    headers['Access-Control-Allow-Headers'] = config.allowHeaders.join(', ');
  }

  if (config.exposeHeaders && config.exposeHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposeHeaders.join(', ');
  }

  if (config.maxAge !== undefined) {
    headers['Access-Control-Max-Age'] = config.maxAge.toString();
  }

  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Handle OPTIONS preflight requests
 */
function handlePreflightRequest(config: CorsConfig, event: APIGatewayEvent): APIGatewayResponse {
  return {
    statusCode: 200,
    headers: buildCorsHeaders(config, event),
    body: '',
  };
}

/**
 * CORS middleware
 * Adds CORS headers to all responses and handles preflight requests
 *
 * @param handler - Lambda handler function
 * @param config - CORS configuration (optional)
 * @returns Wrapped handler with CORS support
 *
 * @example
 * ```typescript
 * export const handler = withCors(async (event) => {
 *   return { statusCode: 200, body: JSON.stringify({ message: 'Hello' }) };
 * });
 * ```
 */
export function withCors(handler: CorsWrappedHandler, config: CorsConfig = {}): CorsWrappedHandler {
  const corsConfig = { ...DEFAULT_CORS_CONFIG, ...config };

  return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
    // Handle OPTIONS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return handlePreflightRequest(corsConfig, event);
    }

    // Execute handler
    const response = await handler(event);

    // Add CORS headers to response
    const corsHeaders = buildCorsHeaders(corsConfig, event);

    return {
      ...response,
      headers: {
        ...response.headers,
        ...corsHeaders,
      },
    };
  };
}

/**
 * Get CORS headers for manual use
 * Useful when you need to add CORS headers manually
 *
 * @param event - API Gateway event
 * @param config - CORS configuration (optional)
 * @returns CORS headers object
 */
export function getCorsHeaders(
  event: APIGatewayEvent,
  config: CorsConfig = {}
): Record<string, string> {
  const corsConfig = { ...DEFAULT_CORS_CONFIG, ...config };
  return buildCorsHeaders(corsConfig, event);
}
