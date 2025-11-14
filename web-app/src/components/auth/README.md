# Authentication Components

This directory contains authentication-related UI components following SOLID design principles.

## Components

### ProtectedRoute

A route wrapper component that restricts access to authenticated users only.

**Features:**

- Redirects unauthenticated users to login page
- Preserves intended destination for post-login redirect
- Shows loading state during authentication check
- Follows Single Responsibility Principle

**Usage:**

```tsx
import { ProtectedRoute } from './components/auth';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>;
```

**Props:**

- `children`: React.ReactNode - Components to render if authenticated
- `redirectTo`: string (optional) - Path to redirect unauthenticated users (default: '/login')

### SessionExpirationHandler

A wrapper component that monitors authentication state and handles session expiration.

**Features:**

- Automatic token refresh at configurable intervals
- Detects session expiration and redirects to login
- Shows user-friendly notifications
- Follows Single Responsibility Principle

**Usage:**

```tsx
import { SessionExpirationHandler } from './components/auth';

<SessionExpirationHandler refreshInterval={300000}>
  <App />
</SessionExpirationHandler>;
```

**Props:**

- `children`: React.ReactNode - Components to wrap
- `refreshInterval`: number (optional) - Token refresh interval in ms (default: 300000 = 5 minutes)
- `redirectPath`: string (optional) - Path to redirect on expiration (default: '/login')

## Requirements Satisfied

- **1.1**: Displays authentication options for Google and Microsoft
- **1.2**: Redirects to Cognito for federated authentication
- **1.4**: Displays error messages and allows retry
- **1.5**: Redirects to login on session expiration
- **9.2**: Clear visual feedback for user actions
- **9.4**: Loading states during async operations
- **9.5**: Graceful error handling with user-friendly messages

## Design Principles

All components follow SOLID principles:

- **Single Responsibility**: Each component has one clear purpose
- **Open-Closed**: Components can be extended without modification
- **Liskov Substitution**: Components are substitutable with their base types
- **Interface Segregation**: Props interfaces are focused and minimal
- **Dependency Inversion**: Components depend on abstractions (hooks, contexts)

## Testing

Components are designed to be testable with:

- Clear prop interfaces
- Dependency injection support
- Predictable behavior
- Accessible test IDs
