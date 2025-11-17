# Layout Components

This directory contains layout-related components that provide the application structure and error handling.

## Components

### AppLayout

The main layout wrapper component that provides:

- **Responsive Header**: App bar with title and navigation
- **Mobile Navigation**: Drawer menu for mobile devices (< md breakpoint)
- **Desktop Navigation**: Inline navigation menu for desktop
- **User Profile Menu**: Dropdown with user email and logout option
- **Content Container**: Responsive container for page content

**Usage:**

```tsx
import { AppLayout } from '../components/layout';

export const MyPage: React.FC = () => {
  return (
    <AppLayout>
      <h1>Page Content</h1>
      {/* Your page content here */}
    </AppLayout>
  );
};
```

**Features:**

- Responsive design (mobile and desktop)
- Active route highlighting
- Keyboard navigation support
- ARIA labels for accessibility
- Material-UI theming integration

### ErrorBoundary

React error boundary component that catches JavaScript errors in the component tree and displays a fallback UI.

**Usage:**

```tsx
import { ErrorBoundary } from '../components/layout';

// Wrap your app or specific components
<ErrorBoundary onError={handleError}>
  <App />
</ErrorBoundary>;
```

**Features:**

- Catches errors in child components
- Displays user-friendly error message
- Shows error details in development mode
- Provides "Try Again" and "Reload Page" actions
- Optional custom fallback UI
- Optional error callback for logging

### LoadingSpinner

Displays a loading indicator for async operations.

**Usage:**

```tsx
import { LoadingSpinner } from '../components/layout';

// Inline loading
<LoadingSpinner message="Loading data..." />

// Full screen loading
<LoadingSpinner message="Initializing..." fullScreen />
```

**Props:**

- `message` (optional): Text to display below spinner
- `size` (optional): Spinner size in pixels (default: 40)
- `fullScreen` (optional): Display as full-screen overlay (default: false)

## Navigation Configuration

Navigation items are configured in `AppLayout.tsx`:

```typescript
const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: <DashboardIcon />,
  },
  {
    label: 'Upload Files',
    path: '/upload',
    icon: <CloudUploadIcon />,
  },
];
```

To add new navigation items, update this array with the desired label, path, and icon.

## Responsive Breakpoints

The layout uses Material-UI breakpoints:

- **Mobile**: < 900px (md breakpoint)
  - Shows hamburger menu
  - Drawer navigation
  - Compact header

- **Desktop**: >= 900px
  - Inline navigation menu
  - Full header with navigation items

## Accessibility

All layout components follow accessibility best practices:

- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management for menus and drawers
- Screen reader friendly
- Semantic HTML structure

## Integration

The layout is integrated into the application in two places:

1. **App.tsx**: ErrorBoundary wraps the entire application
2. **Page Components**: AppLayout wraps authenticated page content

Example from DashboardPage:

```tsx
export const DashboardPage: React.FC = () => {
  return <AppLayout>{/* Page content */}</AppLayout>;
};
```

## SOLID Principles

These components follow SOLID design principles:

- **Single Responsibility**: Each component has one clear purpose
- **Open-Closed**: Components can be extended without modification
- **Liskov Substitution**: Components are substitutable with their base types
- **Interface Segregation**: Props interfaces are focused and minimal
- **Dependency Inversion**: Components depend on abstractions (hooks, contexts)
