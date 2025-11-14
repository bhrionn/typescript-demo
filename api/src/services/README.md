# Services

This directory contains business logic services following SOLID principles.

## AuthService

The `AuthService` handles JWT token validation and Cognito token verification.

### Features

- JWT token validation with signature verification
- Cognito token verification using JWKS
- Token refresh logic (placeholder for full implementation)
- User information retrieval from Cognito

### Usage

```typescript
import { createAuthService } from './services/auth-service';

const authService = createAuthService();

// Validate token
const result = await authService.validateToken(token);
if (result.isValid) {
  console.log('User ID:', result.userId);
  console.log('Email:', result.email);
}

// Verify and decode token
const payload = await authService.verifyAndDecode(token);
console.log('Token payload:', payload);

// Get user info from Cognito
const userInfo = await authService.getUserInfo(accessToken);
console.log('User info:', userInfo);
```

### Configuration

The service requires the following environment variables:

- `COGNITO_USER_POOL_ID` - Cognito User Pool ID (required)
- `AWS_REGION` - AWS region (defaults to 'us-east-1')

### SOLID Principles

- **Single Responsibility**: Handles only authentication-related operations
- **Dependency Inversion**: Depends on `IAuthService` interface, not concrete implementation
- **Open-Closed**: Can be extended without modifying existing code

### Error Handling

The service throws `AuthenticationError` for authentication failures:

- Invalid token format
- Failed signature verification
- Expired tokens
- Invalid token claims

## Adding New Services

When adding new services:

1. Create an interface defining the service contract
2. Implement the interface in a concrete class
3. Follow Single Responsibility Principle
4. Export both interface and implementation
5. Add factory function for easy instantiation
6. Update this README with usage examples
