/**
 * Middleware and Utilities Usage Examples
 * Demonstrates how to use the various middleware and utility functions
 */

import { APIGatewayEvent } from '../types/api';
import {
  withAuth,
  withErrorHandler,
  withLogging,
  withCors,
  compose,
  createHandler,
  createAuthenticatedHandler,
  AuthenticatedEvent,
} from '../middleware';
import {
  formatSuccessResponse,
  formatCreatedResponse,
  formatErrorResponse,
  formatValidationErrorResponse,
  formatPaginatedResponse,
  withCacheHeaders,
} from '../utils/response-formatter';
import {
  sanitizeString,
  sanitizeFileName,
  sanitizeEmail,
  sanitizeUuid,
  sanitizeInteger,
  sanitizePaginationParams,
} from '../utils/sanitization';
import { ValidationError } from '../types/errors';

/**
 * Example 1: Simple handler with standard middleware
 * Includes error handling, logging, and CORS
 */
export const simpleHandler = createHandler(async (_event: APIGatewayEvent) => {
  return formatSuccessResponse({
    message: 'Hello, World!',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Example 2: Authenticated handler
 * Includes auth, error handling, logging, and CORS
 */
export const authenticatedHandler = createAuthenticatedHandler(
  async (event: AuthenticatedEvent) => {
    return formatSuccessResponse({
      message: 'Authenticated successfully',
      userId: event.user?.userId,
      email: event.user?.email,
    });
  }
);

/**
 * Example 3: Manual middleware composition
 * Compose specific middleware in custom order
 */
export const customComposedHandler = compose(
  withErrorHandler,
  withLogging,
  withCors,
  withAuth
)(async (event: AuthenticatedEvent) => {
  return formatSuccessResponse({
    userId: event.user?.userId,
  });
});

/**
 * Example 4: Handler with input sanitization
 */
export const sanitizedInputHandler = createHandler(async (event: APIGatewayEvent) => {
  // Parse and sanitize query parameters
  const rawName = event.queryStringParameters?.name || '';
  const rawEmail = event.queryStringParameters?.email || '';

  const name = sanitizeString(rawName);

  // Validate and sanitize email
  try {
    const email = sanitizeEmail(rawEmail);

    return formatSuccessResponse({
      name,
      email,
      message: 'Input sanitized successfully',
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatValidationErrorResponse(error.message);
    }
    throw error;
  }
});

/**
 * Example 5: Paginated list handler
 */
export const paginatedListHandler = createAuthenticatedHandler(
  async (event: AuthenticatedEvent) => {
    // Sanitize pagination parameters
    const { page, limit } = sanitizePaginationParams({
      page: event.queryStringParameters?.page,
      limit: event.queryStringParameters?.limit,
    });

    // Mock data - in real implementation, fetch from database
    const mockItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Item ${i + 1}`,
    }));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = mockItems.slice(startIndex, endIndex);

    return formatPaginatedResponse(items, {
      page,
      limit,
      total: mockItems.length,
    });
  }
);

/**
 * Example 6: File upload with sanitization
 */
export const fileUploadExampleHandler = createAuthenticatedHandler(
  async (event: AuthenticatedEvent) => {
    const rawFileName = event.headers['x-file-name'] || '';

    try {
      // Sanitize file name
      const fileName = sanitizeFileName(rawFileName);

      // Mock file upload logic
      const fileId = 'mock-file-id';

      return formatCreatedResponse({
        fileId,
        fileName,
        message: 'File uploaded successfully',
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return formatValidationErrorResponse(error.message);
      }
      throw error;
    }
  }
);

/**
 * Example 7: Resource retrieval with UUID validation
 */
export const getResourceHandler = createAuthenticatedHandler(async (event: AuthenticatedEvent) => {
  const rawResourceId = event.pathParameters?.id || '';

  try {
    // Validate and sanitize UUID
    const resourceId = sanitizeUuid(rawResourceId);

    // Mock resource retrieval
    const resource = {
      id: resourceId,
      name: 'Example Resource',
      createdAt: new Date().toISOString(),
    };

    // Return with cache headers
    const response = formatSuccessResponse(resource);
    return withCacheHeaders(response, 300); // Cache for 5 minutes
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatValidationErrorResponse(error.message);
    }
    throw error;
  }
});

/**
 * Example 8: Handler with custom error handling
 */
export const customErrorHandler = createHandler(async (event: APIGatewayEvent) => {
  const action = event.queryStringParameters?.action;

  if (!action) {
    return formatValidationErrorResponse('Action parameter is required');
  }

  switch (action) {
    case 'success':
      return formatSuccessResponse({ message: 'Action completed successfully' });

    case 'error':
      throw new ValidationError('This is a validation error example');

    case 'notfound':
      return formatErrorResponse('Resource not found', 404);

    default:
      return formatValidationErrorResponse('Invalid action', [
        'Valid actions: success, error, notfound',
      ]);
  }
});

/**
 * Example 9: Integer parameter validation
 */
export const integerParamHandler = createHandler(async (event: APIGatewayEvent) => {
  try {
    const age = sanitizeInteger(event.queryStringParameters?.age, {
      min: 0,
      max: 150,
    });

    return formatSuccessResponse({
      age,
      message: 'Age validated successfully',
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatValidationErrorResponse(error.message);
    }
    throw error;
  }
});

/**
 * Example 10: CORS with custom configuration
 */
export const customCorsHandler = withCors(
  async (_event: APIGatewayEvent) => {
    return formatSuccessResponse({
      message: 'CORS configured',
    });
  },
  {
    allowOrigin: ['https://example.com', 'https://app.example.com'],
    allowMethods: ['GET', 'POST'],
    allowCredentials: true,
  }
);
