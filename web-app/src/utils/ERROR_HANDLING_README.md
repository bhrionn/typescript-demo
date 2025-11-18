# Error Handling System

This document describes the global error handling and notification system implemented in the web application.

## Overview

The error handling system follows SOLID principles and provides:

1. **Comprehensive Error Hierarchy** - Typed error classes for different scenarios
2. **Global Error Handler** - Centralized error handling with notification and logging
3. **Error Logging Service** - Logs errors to CloudWatch via API
4. **Notification Service** - User-friendly error notifications
5. **Error Boundary** - React error boundary for catching render errors

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Code                        │
│                  (throws errors)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ErrorHandler                             │
│  - Determines error type                                    │
│  - Applies appropriate strategy                             │
│  - Coordinates notification and logging                     │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────┐   ┌───────────────────────────────┐
│  NotificationService   │   │   ErrorLoggingService         │
│  - Shows toast         │   │   - Logs to CloudWatch        │
│  - User feedback       │   │   - Via API endpoint          │
└────────────────────────┘   └───────────────────────────────┘
```

## Error Hierarchy

All custom errors extend `AppError`:

### Base Error

- **AppError** - Base class for all application errors

### Specific Error Types

- **AuthenticationError** - Authentication failures (401)
- **ValidationError** - Input validation errors (400)
- **NetworkError** - Network/connectivity issues
- **NotFoundError** - Resource not found (404)
- **ForbiddenError** - Permission denied (403)
- **FileUploadError** - File upload failures
- **SessionExpiredError** - Session expiration
- **RateLimitError** - Rate limiting (429)
- **ServerError** - Server errors (500)
- **ConfigurationError** - Configuration/programming errors

## Usage

### In Components

```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ValidationError } from '../types';

function MyComponent() {
  const { handleError, handleErrorWithMessage } = useErrorHandler();

  const handleSubmit = async () => {
    try {
      await someApiCall();
    } catch (error) {
      // Simple error handling
      handleError(error);

      // Or with custom message
      handleErrorWithMessage(error, 'Failed to submit form');
    }
  };

  return <button onClick={handleSubmit}>Submit</button>;
}
```

### Throwing Custom Errors

```typescript
import { ValidationError, FileUploadError } from '../types';

// Validation error
if (!file) {
  throw new ValidationError('File is required', {
    file: 'This field is required',
  });
}

// File upload error
if (file.size > MAX_SIZE) {
  throw new FileUploadError('File is too large', {
    maxSize: MAX_SIZE,
    actualSize: file.size,
  });
}
```

### Wrapping Async Functions

```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';

function MyComponent() {
  const { wrapAsync } = useErrorHandler();

  // Automatically handles errors
  const handleUpload = wrapAsync(async (file: File) => {
    await uploadFile(file);
  }, {
    customMessage: 'Failed to upload file'
  });

  return <button onClick={() => handleUpload(file)}>Upload</button>;
}
```

### Error Boundary

The `ErrorBoundary` component catches React render errors:

```typescript
import { ErrorBoundary } from './components/layout';

function App() {
  return (
    <ErrorBoundary>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

## Error Handling Strategies

The `ErrorHandler` uses the Strategy pattern to handle different error types:

1. **AuthenticationError** - Shows "Please log in again" message
2. **ValidationError** - Shows validation details with field errors
3. **NetworkError** - Shows "Check your connection" message
4. **NotFoundError** - Shows resource not found warning
5. **ForbiddenError** - Shows permission denied message
6. **FileUploadError** - Shows upload-specific error
7. **SessionExpiredError** - Shows session expiration warning
8. **RateLimitError** - Shows rate limit message with retry time
9. **ServerError** - Shows generic server error message
10. **Default** - Fallback for unknown errors

## Error Logging

Errors are automatically logged to CloudWatch via the API:

```typescript
// Error log structure
{
  code: 'VALIDATION_ERROR',
  message: 'File is required',
  statusCode: 400,
  context: { /* additional context */ },
  user: { id: 'user-123', email: 'user@example.com' },
  environment: {
    userAgent: 'Mozilla/5.0...',
    url: 'https://app.example.com/upload',
    timestamp: '2024-01-01T12:00:00.000Z'
  },
  stack: '...' // Stack trace (sanitized in production)
}
```

### Operational vs Programming Errors

- **Operational Errors** (`isOperational: true`) - Expected errors that should be logged
  - Authentication failures
  - Validation errors
  - Network errors
  - Not found errors

- **Programming Errors** (`isOperational: false`) - Unexpected errors
  - Configuration errors
  - Unhandled exceptions
  - Always logged with full details

## Global Error Handlers

The system automatically catches:

1. **Unhandled Promise Rejections**

   ```javascript
   window.addEventListener('unhandledrejection', handler);
   ```

2. **Global JavaScript Errors**

   ```javascript
   window.addEventListener('error', handler);
   ```

3. **React Render Errors** (via ErrorBoundary)

## Configuration

### Notification Duration

```typescript
// Default durations
- Success: 6000ms
- Info: 6000ms
- Warning: 6000ms
- Error: 8000ms (longer for errors)
```

### Error Logging

Errors are logged to: `/api/logs/errors`

The API forwards logs to CloudWatch Logs.

## Best Practices

1. **Use Specific Error Types**

   ```typescript
   // Good
   throw new ValidationError('Invalid email', { email: 'Must be valid' });

   // Avoid
   throw new Error('Invalid email');
   ```

2. **Provide Context**

   ```typescript
   throw new FileUploadError('Upload failed', {
     fileName: file.name,
     fileSize: file.size,
     reason: 'Network timeout',
   });
   ```

3. **Handle Errors at Appropriate Level**

   ```typescript
   // Handle at component level for user feedback
   try {
     await uploadFile(file);
   } catch (error) {
     handleError(error);
   }
   ```

4. **Don't Swallow Errors**

   ```typescript
   // Bad
   try {
     await something();
   } catch (error) {
     // Silent failure
   }

   // Good
   try {
     await something();
   } catch (error) {
     handleError(error);
   }
   ```

5. **Use Custom Messages for User-Facing Errors**
   ```typescript
   handleErrorWithMessage(error, "We couldn't save your changes. Please try again.");
   ```

## Testing

### Testing Error Handling

```typescript
import { render, screen } from '@testing-library/react';
import { ValidationError } from '../types';

test('handles validation error', async () => {
  const { handleError } = useErrorHandler();

  const error = new ValidationError('Invalid input');
  handleError(error);

  expect(screen.getByText(/Invalid input/i)).toBeInTheDocument();
});
```

## Integration with Existing Code

The error handling system integrates with:

1. **ApiClient** - Automatically converts API errors to AppError types
2. **AuthService** - Throws AuthenticationError for auth failures
3. **FileUploadService** - Throws FileUploadError for upload issues
4. **Toast System** - Uses existing toast notifications
5. **ErrorBoundary** - Catches React render errors

## Future Enhancements

Potential improvements:

1. Error recovery strategies
2. Retry mechanisms for transient errors
3. Error analytics and reporting
4. User error feedback collection
5. Offline error queuing
6. Error correlation IDs for debugging
