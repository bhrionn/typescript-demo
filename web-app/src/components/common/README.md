# UI Component Library

This directory contains reusable UI components built with Material-UI, following SOLID design principles.

## Components

### Button

A flexible button component with multiple variants and loading states.

**Variants:**

- `primary` - Primary action button (default)
- `secondary` - Secondary action button
- `outlined` - Outlined button
- `text` - Text-only button
- `danger` - Destructive action button

**Example:**

```tsx
import { Button } from './components/common';

<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>

<Button variant="danger" loading={isLoading}>
  Delete
</Button>
```

### Input

An input component with built-in validation and password visibility toggle.

**Features:**

- Type validation
- Custom validation rules
- Password visibility toggle
- Helper text
- Start/end adornments

**Example:**

```tsx
import { Input } from './components/common';

<Input
  label="Email"
  type="email"
  value={email}
  onChange={setEmail}
  required
  validationRules={[
    {
      validate: (value) => value.includes('@'),
      message: 'Please enter a valid email',
    },
  ]}
/>

<Input
  label="Password"
  type="password"
  value={password}
  onChange={setPassword}
  required
/>
```

### Card

A card component for displaying content in a contained format.

**Features:**

- Optional header with title and subtitle
- Media support (images)
- Actions section
- Clickable cards
- Elevation and outlined variants

**Example:**

```tsx
import { Card, Button } from './components/common';

<Card
  title="Card Title"
  subtitle="Card subtitle"
  media={{
    image: '/path/to/image.jpg',
    alt: 'Description',
  }}
  actions={
    <>
      <Button variant="text">Cancel</Button>
      <Button variant="primary">Save</Button>
    </>
  }
>
  <p>Card content goes here</p>
</Card>;
```

### Modal

An accessible modal dialog component with focus management.

**Features:**

- Keyboard navigation (Escape to close)
- Focus management
- Backdrop click handling
- Multiple sizes
- Dividers

**Example:**

```tsx
import { Modal, Button } from './components/common';

const [open, setOpen] = useState(false);

<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Confirm Action"
  size="sm"
  actions={
    <>
      <Button variant="text" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleConfirm}>
        Confirm
      </Button>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</Modal>;
```

### Toast

A toast notification system for displaying temporary messages.

**Features:**

- Multiple types (success, error, warning, info)
- Auto-dismiss
- Stacking support
- Convenience methods

**Example:**

```tsx
import { ToastProvider, useToast } from './components/common';

// Wrap your app with ToastProvider
<ToastProvider>
  <App />
</ToastProvider>;

// Use in components
function MyComponent() {
  const toast = useToast();

  const handleSuccess = () => {
    toast.showSuccess('Operation completed successfully!');
  };

  const handleError = () => {
    toast.showError('Something went wrong');
  };

  return (
    <>
      <Button onClick={handleSuccess}>Success</Button>
      <Button onClick={handleError}>Error</Button>
    </>
  );
}
```

## SOLID Principles

All components follow SOLID design principles:

### Single Responsibility Principle

Each component has a single, well-defined purpose. For example, the Input component handles input display and validation, while the Button component handles button rendering and click events.

### Open-Closed Principle

Components are open for extension but closed for modification. You can extend components with new variants or behaviors without changing existing code.

```tsx
// Extend Button with custom styling
<Button className="my-custom-button" variant="primary">
  Custom Button
</Button>
```

### Liskov Substitution Principle

All components implement base interfaces (IBaseComponent) and can be used interchangeably where those interfaces are expected.

### Interface Segregation Principle

Components use focused interfaces (IBaseComponent, ILoadable, IValidatable) rather than one large interface, allowing components to implement only what they need.

### Dependency Inversion Principle

Components depend on abstractions (interfaces) rather than concrete implementations. For example, the Toast system uses IToastContext interface.

## Accessibility

All components include accessibility features:

- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader announcements
- Semantic HTML

## Testing

Components can be tested using React Testing Library:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './components/common';

test('button handles click', () => {
  const handleClick = jest.fn();
  render(<Button onClick={handleClick}>Click Me</Button>);

  fireEvent.click(screen.getByText('Click Me'));
  expect(handleClick).toHaveBeenCalled();
});
```

## Styling

Components use Material-UI's styling system. You can customize them using:

1. **className prop** - Add custom CSS classes
2. **Material-UI theme** - Customize the global theme
3. **sx prop** (for MUI components) - Inline styling

```tsx
// Custom theme
import { createTheme, ThemeProvider } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>;
```
