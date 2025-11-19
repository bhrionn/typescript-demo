/**
 * ProtectedRoute Component Tests
 * Tests for route protection and authentication behavior
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../../../contexts/AuthContext';
import type { IAuthService } from '../../../services/IAuthService';
import type { User } from '../../../types/auth';

// Test component to display location info
const LocationDisplay: React.FC = () => {
  const location = useLocation();
  return (
    <div>
      <div data-testid="protected-content">Protected Content</div>
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="location-state">{JSON.stringify(location.state)}</div>
    </div>
  );
};

// Test wrapper component
const TestWrapper: React.FC<{
  children: React.ReactNode;
  authService: IAuthService;
  initialRoute?: string;
}> = ({ children, authService, initialRoute = '/' }) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    <AuthProvider authService={authService}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        <Route path="/dashboard" element={<ProtectedRoute>{children}</ProtectedRoute>} />
        <Route
          path="/custom-redirect"
          element={<ProtectedRoute redirectTo="/custom-login">{children}</ProtectedRoute>}
        />
      </Routes>
    </AuthProvider>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  let mockAuthService: jest.Mocked<IAuthService>;
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    provider: 'google',
    name: 'Test User',
  };

  beforeEach(() => {
    // Create mock auth service
    mockAuthService = {
      login: jest.fn(),
      logout: jest.fn(),
      isAuthenticated: jest.fn(),
      getCurrentUser: jest.fn(),
      getToken: jest.fn(),
      refreshToken: jest.fn(),
      signUp: jest.fn(),
      signIn: jest.fn(),
      confirmSignUp: jest.fn(),
      resendConfirmationCode: jest.fn(),
    } as jest.Mocked<IAuthService>;

    jest.clearAllMocks();
  });

  describe('Authenticated User Behavior', () => {
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockResolvedValue(true);
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);
    });

    it('renders protected content when user is authenticated', async () => {
      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('does not redirect when user is authenticated', async () => {
      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard');
      });
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated User Behavior', () => {
    beforeEach(() => {
      mockAuthService.isAuthenticated.mockResolvedValue(false);
      mockAuthService.getCurrentUser.mockResolvedValue(null);
    });

    it('redirects to login when user is not authenticated', async () => {
      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('redirects to custom path when redirectTo prop is provided', async () => {
      render(
        <MemoryRouter initialEntries={['/custom-redirect']}>
          <AuthProvider authService={mockAuthService}>
            <Routes>
              <Route
                path="/custom-login"
                element={<div data-testid="custom-login-page">Custom Login</div>}
              />
              <Route
                path="/custom-redirect"
                element={
                  <ProtectedRoute redirectTo="/custom-login">
                    <LocationDisplay />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-login-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('preserves attempted location in redirect state', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider authService={mockAuthService}>
            <Routes>
              <Route
                path="/login"
                element={
                  <div data-testid="login-page">
                    <LocationDisplay />
                  </div>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div>Protected</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      // Check that location state contains the attempted path
      const locationState = screen.getByTestId('location-state');
      expect(locationState.textContent).toContain('/dashboard');
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator while checking authentication', () => {
      // Mock service to never resolve to keep loading state
      mockAuthService.isAuthenticated.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();
      expect(screen.getByText(/Verifying authentication/i)).toBeInTheDocument();
    });

    it('does not render protected content during loading', () => {
      mockAuthService.isAuthenticated.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('does not redirect during loading', () => {
      mockAuthService.isAuthenticated.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });

  describe('Authentication State Changes', () => {
    it('updates when authentication state changes from loading to authenticated', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue(true);
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      // Should show loading first
      expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();

      // Then show protected content
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('updates when authentication state changes from loading to unauthenticated', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue(false);
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      render(
        <TestWrapper authService={mockAuthService} initialRoute="/dashboard">
          <LocationDisplay />
        </TestWrapper>
      );

      // Should show loading first
      expect(screen.getByTestId('protected-route-loading')).toBeInTheDocument();

      // Then redirect to login
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });
  });
});
