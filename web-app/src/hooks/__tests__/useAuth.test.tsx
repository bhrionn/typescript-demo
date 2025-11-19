/**
 * useAuth Hook Unit Tests
 * Tests for authentication context and hook
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { IAuthService } from '../../services/IAuthService';
import {
  User,
  AuthenticationError,
  SignUpCredentials,
  SignInCredentials,
  SignUpResult,
  ConfirmSignUpResult,
} from '../../types/auth';
import React from 'react';

// Mock auth service for testing
class MockAuthService implements IAuthService {
  private mockUser: User | null = null;
  private mockToken: string | null = null;
  private mockIsAuthenticated = false;

  setMockUser(user: User | null) {
    this.mockUser = user;
    this.mockIsAuthenticated = !!user;
  }

  setMockToken(token: string | null) {
    this.mockToken = token;
  }

  async login(): Promise<void> {
    // Mock implementation
  }

  async logout(): Promise<void> {
    this.mockUser = null;
    this.mockToken = null;
    this.mockIsAuthenticated = false;
  }

  async getToken(): Promise<string | null> {
    return this.mockToken;
  }

  async isAuthenticated(): Promise<boolean> {
    return this.mockIsAuthenticated;
  }

  async refreshToken(): Promise<string> {
    if (!this.mockToken) {
      throw new AuthenticationError('No token to refresh', 'REFRESH_ERROR');
    }
    return this.mockToken;
  }

  async getCurrentUser(): Promise<User | null> {
    return this.mockUser;
  }

  async signUp(credentials: SignUpCredentials): Promise<SignUpResult> {
    return {
      isConfirmed: false,
      userId: 'new-user-' + credentials.email,
    };
  }

  async signIn(credentials: SignInCredentials): Promise<void> {
    if (credentials.email && credentials.password) {
      this.mockIsAuthenticated = true;
      this.mockUser = {
        id: 'signed-in-user',
        email: credentials.email,
        provider: 'cognito',
      };
      this.mockToken = 'mock-token';
    }
  }

  async confirmSignUp(_email: string, _code: string): Promise<ConfirmSignUpResult> {
    return {
      isConfirmed: true,
    };
  }

  async resendConfirmationCode(_email: string): Promise<void> {
    // Mock implementation
  }
}

describe('useAuth Hook', () => {
  let mockAuthService: MockAuthService;

  beforeEach(() => {
    mockAuthService = new MockAuthService();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider authService={mockAuthService}>{children}</AuthProvider>
  );

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should set authenticated state when user is logged in', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        provider: 'google',
        name: 'Test User',
      };

      mockAuthService.setMockUser(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });

    it('should set unauthenticated state when no user', async () => {
      mockAuthService.setMockUser(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('login', () => {
    it('should call login on auth service', async () => {
      const loginSpy = jest.spyOn(mockAuthService, 'login');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('google');
      });

      expect(loginSpy).toHaveBeenCalledWith('google');
    });

    it('should set loading state during login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.login('microsoft');
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should handle login errors', async () => {
      const loginError = new AuthenticationError('Login failed', 'LOGIN_ERROR');
      jest.spyOn(mockAuthService, 'login').mockRejectedValueOnce(loginError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login('google');
        })
      ).rejects.toThrow('Login failed');
    });
  });

  describe('logout', () => {
    it('should call logout on auth service', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        provider: 'google',
      };

      mockAuthService.setMockUser(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should handle logout errors', async () => {
      const logoutError = new AuthenticationError('Logout failed', 'LOGOUT_ERROR');
      jest.spyOn(mockAuthService, 'logout').mockRejectedValueOnce(logoutError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.logout();
        })
      ).rejects.toThrow('Logout failed');
    });
  });

  describe('getToken', () => {
    it('should return token from auth service', async () => {
      const mockToken = 'mock-access-token';
      mockAuthService.setMockToken(mockToken);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getToken();

      expect(token).toBe(mockToken);
    });

    it('should return null when no token available', async () => {
      mockAuthService.setMockToken(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getToken();

      expect(token).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh and return new token', async () => {
      const mockToken = 'refreshed-token';
      mockAuthService.setMockToken(mockToken);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.refreshToken();

      expect(token).toBe(mockToken);
    });

    it('should handle refresh errors', async () => {
      mockAuthService.setMockToken(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.refreshToken()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('signUp', () => {
    it('should call signUp on auth service', async () => {
      const signUpSpy = jest.spyOn(mockAuthService, 'signUp');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const credentials: SignUpCredentials = {
        email: 'newuser@example.com',
        password: 'TestPassword123!',
        name: 'New User',
      };

      await act(async () => {
        const signUpResult = await result.current.signUp(credentials);
        expect(signUpResult.isConfirmed).toBe(false);
        expect(signUpResult.userId).toBe('new-user-newuser@example.com');
      });

      expect(signUpSpy).toHaveBeenCalledWith(credentials);
    });

    it('should handle signUp errors', async () => {
      const signUpError = new AuthenticationError('User already exists', 'SIGNUP_ERROR');
      jest.spyOn(mockAuthService, 'signUp').mockRejectedValueOnce(signUpError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.signUp({
            email: 'existing@example.com',
            password: 'TestPassword123!',
          });
        } catch (error) {
          caughtError = error as Error;
        }
      });

      expect(caughtError?.message).toBe('User already exists');
      expect(result.current.error).toBe('User already exists');
    });

    it('should set loading state during signUp', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.signUp({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('signIn', () => {
    it('should call signIn on auth service and update state', async () => {
      const signInSpy = jest.spyOn(mockAuthService, 'signIn');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const credentials: SignInCredentials = {
        email: 'user@example.com',
        password: 'TestPassword123!',
      };

      await act(async () => {
        await result.current.signIn(credentials);
      });

      expect(signInSpy).toHaveBeenCalledWith(credentials);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('user@example.com');
    });

    it('should handle signIn errors', async () => {
      const signInError = new AuthenticationError('Incorrect password', 'SIGNIN_ERROR');
      jest.spyOn(mockAuthService, 'signIn').mockRejectedValueOnce(signInError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.signIn({
            email: 'user@example.com',
            password: 'WrongPassword',
          });
        } catch (error) {
          caughtError = error as Error;
        }
      });

      expect(caughtError?.message).toBe('Incorrect password');
      expect(result.current.error).toBe('Incorrect password');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should set loading state during signIn', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.signIn({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('confirmSignUp', () => {
    it('should call confirmSignUp on auth service', async () => {
      const confirmSpy = jest.spyOn(mockAuthService, 'confirmSignUp');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        const confirmResult = await result.current.confirmSignUp('test@example.com', '123456');
        expect(confirmResult.isConfirmed).toBe(true);
      });

      expect(confirmSpy).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should handle confirmSignUp errors', async () => {
      const confirmError = new AuthenticationError('Invalid code', 'CONFIRM_ERROR');
      jest.spyOn(mockAuthService, 'confirmSignUp').mockRejectedValueOnce(confirmError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.confirmSignUp('test@example.com', 'invalid');
        } catch (error) {
          caughtError = error as Error;
        }
      });

      expect(caughtError?.message).toBe('Invalid code');
      expect(result.current.error).toBe('Invalid code');
    });

    it('should set loading state during confirmSignUp', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.confirmSignUp('test@example.com', '123456');
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('resendConfirmationCode', () => {
    it('should call resendConfirmationCode on auth service', async () => {
      const resendSpy = jest.spyOn(mockAuthService, 'resendConfirmationCode');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.resendConfirmationCode('test@example.com');
      });

      expect(resendSpy).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle resendConfirmationCode errors', async () => {
      const resendError = new AuthenticationError('Limit exceeded', 'RESEND_CODE_ERROR');
      jest.spyOn(mockAuthService, 'resendConfirmationCode').mockRejectedValueOnce(resendError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let caughtError: Error | undefined;
      await act(async () => {
        try {
          await result.current.resendConfirmationCode('test@example.com');
        } catch (error) {
          caughtError = error as Error;
        }
      });

      expect(caughtError?.message).toBe('Limit exceeded');
      expect(result.current.error).toBe('Limit exceeded');
    });

    it('should set loading state during resendConfirmationCode', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.resendConfirmationCode('test@example.com');
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('state management', () => {
    it('should maintain state across multiple operations', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        provider: 'google',
      };

      mockAuthService.setMockUser(mockUser);
      mockAuthService.setMockToken('mock-token');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Get token
      const token = await result.current.getToken();
      expect(token).toBe('mock-token');

      // State should remain consistent
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should maintain consistent state across operations', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        provider: 'google',
      };

      mockAuthService.setMockUser(mockUser);
      mockAuthService.setMockToken('mock-token');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Verify initial state
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
    });

    it('should update state correctly after signIn', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initially not authenticated
      expect(result.current.isAuthenticated).toBe(false);

      // Sign in
      await act(async () => {
        await result.current.signIn({
          email: 'test@example.com',
          password: 'TestPassword123!',
        });
      });

      // Should be authenticated now
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
      expect(result.current.user?.provider).toBe('cognito');
    });
  });
});
