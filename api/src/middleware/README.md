# Middleware

This directory contains Lambda middleware functions for cross-cutting concerns.

## Authentication Middleware

The authentication middleware validates JWT tokens and attaches user information to Lambda events.

### Features

- JWT token validation using AuthService
- Automatic token extraction from Authorization header
- User information attachment to event
- Optional authentication support
- Resource ownership validation

### Usage

#### Basic Authentication (Required)

```typescript
import { withAuth, AuthenticatedEvent } from './middleware/auth-middleware';

async function myHandler(event: AuthenticatedEvent) {
  const userId = event.user?.userId;
  const email = event.user?.email;

  // Handler logic with authenticated user
  return {
    statusCode: 200,
    body: JSON.stringify({ userId, email }),
  };
}

export const handler = withAuth(myHandler);
```

#### Optional Authentication

```typescript
import { withOptionalAuth, AuthenticatedEvent } from './middleware/auth-middleware';

async function myHandler(event: AuthenticatedEvent) {
  if (event.user) {
    // User is authenticated
    console.log('Authenticated user:', event.user.userId);
  } else {
    // Anonymous access
    console.log('Anonymous user');
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
}

export const handler = withOptionalAuth(myHandler);
```

#### Resource Ownership Validation

```typescript
import { requireUser } from './middleware/auth-middleware';

async function myHandler(event: AuthenticatedEvent) {
  // Only the resource owner can access this
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' }),
  };
}

export const handler = requireUser(myHandler, (event) => event.pathParameters?.userId);
```

### Token Format

The middleware supports two Authorization header formats:

- `Authorization: Bearer <token>`
- `Authorization: <token>`

### Error Responses

The middleware returns standardized error responses:

#### 401 Unauthorized

```json
{
  "error": "AUTHENTICATION_REQUIRED",
  "message": "Authorization header is required"
}
```

```json
{
  "error": "INVALID_TOKEN",
  "message": "Token validation failed"
}
```

#### 403 Forbidden

```json
{
  "error": "FORBIDDEN",
  "message": "You do not have permission to access this resource"
}
```

### Configuration

The middleware can be configured with custom options:

```typescript
import { withAuth } from './middleware/auth-middleware';
import { createAuthService } from './services/auth-service';

const customAuthService = createAuthService('custom-pool-id', 'us-west-2');

const handler = withAuth(myHandler, {
  authService: customAuthService,
  required: true, // Default: true
});
```

### SOLID Principles

- **Single Responsibility**: Handles only authentication concerns
- **Dependency Inversion**: Depends on `IAuthService` interface
- **Open-Closed**: Can be extended with new middleware functions

### CORS Headers

All error responses include CORS headers:

```
Access-Control-Allow-Origin: *
Content-Type: application/json
```

## Adding New Middleware

When adding new middleware:

1. Follow the same pattern as authentication middleware
2. Accept a handler function and return a wrapped handler
3. Handle errors gracefully with proper status codes
4. Include CORS headers in responses
5. Document usage examples in this README
6. Export from `index.ts`

### Example Middleware Pattern

```typescript
export function withMyMiddleware(
  handler: LambdaHandler,
  config?: MyMiddlewareConfig
): (event: APIGatewayEvent) => Promise<APIGatewayResponse> {
  return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
    try {
      // Pre-processing logic

      // Call handler
      const response = await handler(event);

      // Post-processing logic

      return response;
    } catch (error) {
      // Error handling
      return createErrorResponse(500, 'ERROR', 'Error message');
    }
  };
}
```
