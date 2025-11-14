# Lambda Middleware and Utilities Guide

This guide explains how to use the middleware and utility functions for Lambda handlers.

## Overview

The middleware system provides a composable way to add cross-cutting concerns to Lambda handlers:

- **Error Handling**: Consistent error responses
- **Logging**: Structured request/response logging
- **CORS**: Cross-Origin Resource Sharing headers
- **Authentication**: JWT token validation
- **Input Sanitization**: Prevent injection attacks
- **Response Formatting**: Consistent response structure

## Middleware

### Error Handler

Catches and formats errors consistently across all handlers.

```typescript
import { withErrorHandler } from './middleware';

export const handler = withErrorHandler(async (event) => {
  throw new ValidationError('Invalid input');
  // Returns: { statusCode: 400, body: { error: 'VALIDATION_ERROR', message: 'Invalid input' } }
});
```

### Logging

Provides structured logging with request/response details.

```typescript
import { withLogging, createLogger } from './middleware';

export const handler = withLogging(async (event) => {
  const logger = createLogger({ requestId: event.requestContext.requestId });
  logger.info('Processing request');
  return { statusCode: 200, body: '{}' };
});
```

### CORS

Adds CORS headers and handles preflight requests.

```typescript
import { withCors } from './middleware';

// Default CORS (allow all origins)
export const handler = withCors(async (event) => {
  return { statusCode: 200, body: '{}' };
});

// Custom CORS configuration
export const handler = withCors(
  async (event) => {
    return { statusCode: 200, body: '{}' };
  },
  {
    allowOrigin: ['https://example.com'],
    allowMethods: ['GET', 'POST'],
    allowCredentials: true,
  }
);
```

### Authentication

Validates JWT tokens and attaches user information to the event.

```typescript
import { withAuth, AuthenticatedEvent } from './middleware';

export const handler = withAuth(async (event: AuthenticatedEvent) => {
  const userId = event.user?.userId;
  const email = event.user?.email;
  return { statusCode: 200, body: JSON.stringify({ userId, email }) };
});
```

### Middleware Composition

Combine multiple middleware using `compose` or `createHandler`.

```typescript
import { compose, withErrorHandler, withLogging, withCors, withAuth } from './middleware';

// Manual composition
export const handler = compose(
  withErrorHandler,
  withLogging,
  withCors,
  withAuth
)(async (event) => {
  return { statusCode: 200, body: '{}' };
});

// Using createHandler (recommended)
import { createHandler, createAuthenticatedHandler } from './middleware';

// Standard handler (error handling, logging, CORS)
export const handler = createHandler(async (event) => {
  return { statusCode: 200, body: '{}' };
});

// Authenticated handler (includes auth + standard middleware)
export const handler = createAuthenticatedHandler(async (event) => {
  const userId = event.user?.userId;
  return { statusCode: 200, body: JSON.stringify({ userId }) };
});
```

## Utilities

### Response Formatter

Provides consistent response formatting.

```typescript
import {
  formatSuccessResponse,
  formatCreatedResponse,
  formatErrorResponse,
  formatValidationErrorResponse,
  formatPaginatedResponse,
  withCacheHeaders,
} from './utils';

// Success response (200)
return formatSuccessResponse({ message: 'Success' });
// { statusCode: 200, body: { success: true, data: { message: 'Success' } } }

// Created response (201)
return formatCreatedResponse({ id: '123' });
// { statusCode: 201, body: { success: true, data: { id: '123' } } }

// Validation error (400)
return formatValidationErrorResponse('Invalid input', ['Field is required']);
// { statusCode: 400, body: { error: 'VALIDATION_ERROR', message: 'Invalid input', details: [...] } }

// Paginated response
return formatPaginatedResponse(items, { page: 1, limit: 20, total: 100 });
// { statusCode: 200, body: { success: true, data: { items: [...], pagination: {...} } } }

// Add cache headers
const response = formatSuccessResponse({ data: 'cached' });
return withCacheHeaders(response, 300); // Cache for 5 minutes
```

### Input Sanitization

Sanitize and validate user inputs to prevent injection attacks.

```typescript
import {
  sanitizeString,
  sanitizeFileName,
  sanitizeEmail,
  sanitizeUuid,
  sanitizeInteger,
  sanitizePaginationParams,
  sanitizeObject,
} from './utils';

// Sanitize string (removes dangerous characters)
const name = sanitizeString(event.queryStringParameters?.name);

// Sanitize file name (prevents path traversal)
const fileName = sanitizeFileName(event.headers['x-file-name']);

// Validate and sanitize email
try {
  const email = sanitizeEmail(event.queryStringParameters?.email);
} catch (error) {
  // Invalid email format
}

// Validate UUID
try {
  const id = sanitizeUuid(event.pathParameters?.id);
} catch (error) {
  // Invalid UUID format
}

// Sanitize integer with constraints
const age = sanitizeInteger(event.queryStringParameters?.age, {
  min: 0,
  max: 150,
});

// Sanitize pagination parameters
const { page, limit } = sanitizePaginationParams({
  page: event.queryStringParameters?.page,
  limit: event.queryStringParameters?.limit,
});

// Sanitize object (removes null/undefined, limits depth)
const metadata = sanitizeObject(JSON.parse(event.body));
```

## Complete Example

Here's a complete example combining middleware and utilities:

```typescript
import { createAuthenticatedHandler, AuthenticatedEvent } from './middleware';
import {
  formatSuccessResponse,
  formatValidationErrorResponse,
  sanitizeString,
  sanitizeInteger,
} from './utils';
import { ValidationError } from './types/errors';

export const handler = createAuthenticatedHandler(async (event: AuthenticatedEvent) => {
  try {
    // Get authenticated user
    const userId = event.user?.userId;

    // Sanitize inputs
    const name = sanitizeString(event.queryStringParameters?.name || '');
    const age = sanitizeInteger(event.queryStringParameters?.age, {
      min: 0,
      max: 150,
    });

    // Business logic
    const result = {
      userId,
      name,
      age,
      timestamp: new Date().toISOString(),
    };

    return formatSuccessResponse(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return formatValidationErrorResponse(error.message);
    }
    throw error; // Will be caught by error handler middleware
  }
});
```

## Best Practices

1. **Always use middleware composition**: Use `createHandler` or `createAuthenticatedHandler` for consistent behavior
2. **Sanitize all inputs**: Never trust user input, always sanitize
3. **Use typed responses**: Use response formatter utilities for consistency
4. **Handle errors properly**: Use custom error classes (ValidationError, etc.)
5. **Log important events**: Use the Logger class for structured logging
6. **Validate early**: Validate and sanitize inputs at the start of handlers
7. **Use prepared statements**: Always use prepared statements for database queries (sanitization is defense-in-depth)

## Security Considerations

- **Input Sanitization**: Always sanitize user inputs to prevent XSS and injection attacks
- **SQL Injection**: Use prepared statements (sanitization is not enough)
- **Path Traversal**: Use `sanitizeFileName` for file operations
- **CORS**: Configure CORS properly for your use case
- **Authentication**: Always validate JWT tokens for protected endpoints
- **Error Messages**: Don't expose sensitive information in error messages
- **Logging**: Don't log sensitive data (passwords, tokens, PII)

## Requirements Mapping

- **Requirement 3.7**: CORS configuration, input sanitization, response formatting
- **Requirement 8.16**: Structured logging with CloudWatch integration
