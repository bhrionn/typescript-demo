/**
 * SessionExpirationHandler Component Tests
 * Tests for session monitoring and expiration handling
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionExpirationHandler } from '../SessionExpirationHandler';
import { AuthProvider } from '../../../contexts/AuthContext';
import { ToastProvider } from '../../../components/common/Toast';
import type { IAuthService } from '../../../services/IAuthService';
import type { User } from '../../../types/auth';

// Test wrapper component
const TestWrapper: React.FC<{
  children: React.ReactNode;
  authService: IAuthService;
  refreshInterval?: number;
  redirectPath?: string;
}> = ({ children, authService, refreshInterval, redirectPath }) => (
  <MemoryRouter>
    <ToastProvider>
      <AuthProvider authService={authService}>
        <SessionExpirationHandler refreshInterval={refreshInterval} redirectPath={redirectPath}>
          {children}
        </SessionExpirationHandler>
      </AuthProvider>
    </ToastProvider>
  </MemoryRouter>
);

describe('SessionExpirationHandler', () => {
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
    } as jest.Mocked<IAuthService>;

    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders children components when authenticated', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue(true);
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      render(
        <TestWrapper authService={mockAuthService}>
          <div data-testid="child-content">Child Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
      });
    });

    it('renders children components when not authenticated', async () => {
      mockAuthService.isAuthenticated.mockResolvedValue(false);
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      render(
        <TestWrapper authService={mockAuthService}>
          <div data-testid="child-content">Child Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('handles authentication errors gracefully', async () => {
      mockAuthService.isAuthenticated.mockRejectedValue(new Error('Auth check failed'));
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      render(
        <TestWrapper authService={mockAuthService}>
          <div data-testid="child-content">Child Content</div>
        </TestWrapper>
      );

      // Component should still render children even with auth errors
      await waitFor(() => {
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
      });
    });
  });
});
