# Page Components

This directory contains page-level components that represent full application views.

## Pages

### LoginPage

The authentication page that provides federated login options.

**Features:**

- Provider selection buttons (Google, Microsoft)
- OAuth redirect handling
- Loading states during authentication
- Error display for authentication failures
- Auto-redirect to intended destination after login
- Responsive design for mobile and desktop

**Route:** `/login`

**Usage:**

```tsx
import { LoginPage } from './pages';

<Route path="/login" element={<LoginPage />} />;
```

**Requirements Satisfied:**

- **1.1**: Displays authentication options for Google and Microsoft identity providers
- **1.2**: Redirects user to Cognito for federated authentication
- **1.4**: Displays error message and allows retry on authentication failure
- **9.2**: Clear visual feedback for user actions
- **9.4**: Loading states during asynchronous operations
- **9.5**: Graceful error handling with user-friendly messages

### DashboardPage

The main authenticated page displaying user information and application features.

**Features:**

- User profile display
- Navigation bar with account menu
- Logout functionality
- Responsive layout
- Protected by authentication

**Route:** `/` (protected)

**Usage:**

```tsx
import { DashboardPage } from './pages';
import { ProtectedRoute } from './components/auth';

<Route
  path="/"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>;
```

## Design Principles

All pages follow SOLID principles:

- **Single Responsibility**: Each page handles one specific view
- **Open-Closed**: Pages can be extended without modification
- **Dependency Inversion**: Pages depend on abstractions (hooks, services)

## Authentication Flow

1. User navigates to protected route
2. `ProtectedRoute` checks authentication status
3. If not authenticated, redirects to `/login`
4. User selects identity provider (Google or Microsoft)
5. `LoginPage` calls `login()` from `useAuth` hook
6. User is redirected to Cognito/provider for authentication
7. After successful authentication, user returns to app
8. `AuthContext` initializes with user data
9. User is redirected to originally intended route
10. `SessionExpirationHandler` monitors session and refreshes tokens

## Error Handling

Pages implement comprehensive error handling:

- Authentication errors displayed via toast notifications
- Loading states prevent user interaction during async operations
- Session expiration triggers automatic redirect to login
- Network errors show user-friendly messages

## Accessibility

All pages follow accessibility best practices:

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus management
