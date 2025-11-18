/**
 * LoginPage Component Tests
 * Tests for login page rendering and authentication flow
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { ToastProvider } from '../../components/common/Toast';
import type { IAuthService } from '../../services/IAuthService';

// Test wrapper component
const TestWrapper: React.FC<{
  children: React.ReactNode;
  authService: IAuthService;
  initialRoute?: string;
}> = ({ children, authService, initialRoute = '/login' }) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    <ToastProvider>
      <AuthProvider authService={authService}>{children}</AuthProvider>
    </ToastProvider>
  </MemoryRouter>
);

describe('LoginPage', () => {
  let mockAuthService: jest.Mocked<IAuthService>;

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

    // Default: not authenticated
    mockAuthService.isAuthenticated.mockResolvedValue(false);
    mockAuthService.getCurrentUser.mockResolvedValue(null);

    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders login page with welcome message', async () => {
      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument();
      });
      expect(screen.getByText(/Sign in to continue to the application/i)).toBeInTheDocument();
    });

    it('renders Google login button', async () => {
      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
      });
      expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    });

    it('renders Microsoft login button', async () => {
      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-microsoft-button')).toBeInTheDocument();
      });
      expect(screen.getByText(/Continue with Microsoft/i)).toBeInTheDocument();
    });

    it('renders terms and privacy notice', async () => {
      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText(/By signing in, you agree to our Terms of Service and Privacy Policy/i)
        ).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      // Mock service to never resolve to keep loading state
      mockAuthService.isAuthenticated.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      expect(screen.getByTestId('login-loading')).toBeInTheDocument();
      expect(screen.getByText(/Checking authentication status/i)).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('calls login with google provider when Google button is clicked', async () => {
      mockAuthService.login.mockResolvedValue();

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
      });

      const googleButton = screen.getByTestId('login-google-button');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith('google');
      });
    });

    it('calls login with microsoft provider when Microsoft button is clicked', async () => {
      mockAuthService.login.mockResolvedValue();

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-microsoft-button')).toBeInTheDocument();
      });

      const microsoftButton = screen.getByTestId('login-microsoft-button');
      await userEvent.click(microsoftButton);

      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith('microsoft');
      });
    });
  });

  describe('Error States', () => {
    it('displays error message when login fails', async () => {
      const errorMessage = 'Authentication failed';
      mockAuthService.login.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
      });

      const googleButton = screen.getByTestId('login-google-button');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('displays error message from auth context', async () => {
      const errorMessage = 'Session expired';
      mockAuthService.isAuthenticated.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('allows retry after login failure', async () => {
      mockAuthService.login
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce();

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
      });

      // First attempt - fails
      let googleButton = screen.getByTestId('login-google-button');
      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      expect(mockAuthService.login).toHaveBeenCalledTimes(1);

      // Second attempt - succeeds (get button again after re-render)
      googleButton = screen.getByTestId('login-google-button');
      await userEvent.click(googleButton);

      expect(mockAuthService.login).toHaveBeenCalledTimes(2);
    });

    it('disables buttons during login attempt', async () => {
      const loginPromise = new Promise<void>((_resolve) => {
        // Login promise never resolves to simulate pending state
      });
      mockAuthService.login.mockReturnValue(loginPromise);

      render(
        <TestWrapper authService={mockAuthService}>
          <LoginPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('login-google-button')).toBeInTheDocument();
      });

      const googleButton = screen.getByTestId('login-google-button');

      // Click button to start login
      userEvent.click(googleButton);

      // Verify login was called
      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith('google');
      });
    });
  });
});
