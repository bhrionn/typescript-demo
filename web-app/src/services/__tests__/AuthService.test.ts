/**
 * AuthService Unit Tests
 * Tests for authentication service implementation
 */

import { AuthService } from '../AuthService';
import { AuthenticationError } from '../../types/auth';
import { Amplify } from 'aws-amplify';
import {
  signInWithRedirect,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth';

// Mock AWS Amplify modules
jest.mock('aws-amplify', () => ({
  Amplify: {
    configure: jest.fn(),
  },
}));

jest.mock('aws-amplify/auth', () => ({
  signInWithRedirect: jest.fn(),
  signOut: jest.fn(),
  fetchAuthSession: jest.fn(),
  getCurrentUser: jest.fn(),
  fetchUserAttributes: jest.fn(),
}));

// Mock environment
jest.mock('../../config/environment', () => ({
  environment: {
    cognitoUserPoolId: 'test-pool-id',
    cognitoClientId: 'test-client-id',
    cognitoDomain: 'test-domain.auth.us-east-1.amazoncognito.com',
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('initialization', () => {
    it('should initialize Amplify with correct configuration', () => {
      expect(Amplify.configure).toHaveBeenCalledWith({
        Auth: {
          Cognito: {
            userPoolId: 'test-pool-id',
            userPoolClientId: 'test-client-id',
            loginWith: {
              oauth: {
                domain: 'test-domain.auth.us-east-1.amazoncognito.com',
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [window.location.origin],
                redirectSignOut: [window.location.origin],
                responseType: 'code',
              },
            },
          },
        },
      });
    });
  });

  describe('login', () => {
    it('should initiate login with Google provider', async () => {
      await authService.login('google');

      expect(signInWithRedirect).toHaveBeenCalledWith({
        provider: 'Google',
      });
    });

    it('should initiate login with Microsoft provider', async () => {
      await authService.login('microsoft');

      expect(signInWithRedirect).toHaveBeenCalledWith({
        provider: 'Microsoft',
      });
    });

    it('should throw AuthenticationError on login failure', async () => {
      const error = new Error('Login failed');
      (signInWithRedirect as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.login('google')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('logout', () => {
    it('should call signOut successfully', async () => {
      (signOut as jest.Mock).mockResolvedValueOnce(undefined);

      await authService.logout();

      expect(signOut).toHaveBeenCalled();
    });

    it('should throw AuthenticationError on logout failure', async () => {
      const error = new Error('Logout failed');
      (signOut as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.logout()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('getToken', () => {
    it('should return access token when authenticated', async () => {
      const mockToken = 'mock-access-token';
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          accessToken: {
            toString: () => mockToken,
          },
        },
      });

      const token = await authService.getToken();

      expect(token).toBe(mockToken);
      expect(fetchAuthSession).toHaveBeenCalled();
    });

    it('should return null when no token available', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: null,
      });

      const token = await authService.getToken();

      expect(token).toBeNull();
    });

    it('should return null when session fetch fails', async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValueOnce(new Error('Not authenticated'));

      const token = await authService.getToken();

      expect(token).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user has valid token', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          accessToken: {
            toString: () => 'mock-token',
          },
        },
      });

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false when no token available', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: null,
      });

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });

    it('should return false when session fetch fails', async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValueOnce(new Error('Not authenticated'));

      const isAuth = await authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should refresh and return new token', async () => {
      const mockToken = 'new-access-token';
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          accessToken: {
            toString: () => mockToken,
          },
        },
      });

      const token = await authService.refreshToken();

      expect(token).toBe(mockToken);
      expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
    });

    it('should throw AuthenticationError when refresh fails', async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(authService.refreshToken()).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when no token after refresh', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: null,
      });

      await expect(authService.refreshToken()).rejects.toThrow(AuthenticationError);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user information when authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce({
        userId: 'user-123',
      });

      (fetchUserAttributes as jest.Mock).mockResolvedValueOnce({
        email: 'test@example.com',
        name: 'Test User',
        identities: JSON.stringify([{ providerName: 'Google' }]),
      });

      const user = await authService.getCurrentUser();

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
      });
    });

    it('should handle Microsoft provider', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce({
        userId: 'user-456',
      });

      (fetchUserAttributes as jest.Mock).mockResolvedValueOnce({
        email: 'test@microsoft.com',
        identities: JSON.stringify([{ providerName: 'Microsoft' }]),
      });

      const user = await authService.getCurrentUser();

      expect(user?.provider).toBe('microsoft');
    });

    it('should return null when not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockRejectedValueOnce(new Error('Not authenticated'));

      const user = await authService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('should handle missing email attribute', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValueOnce({
        userId: 'user-789',
      });

      (fetchUserAttributes as jest.Mock).mockResolvedValueOnce({
        identities: JSON.stringify([{ providerName: 'Google' }]),
      });

      const user = await authService.getCurrentUser();

      expect(user?.email).toBe('');
    });
  });
});
