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
  signUp,
  signIn,
  confirmSignUp,
  resendSignUpCode,
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
  signUp: jest.fn(),
  signIn: jest.fn(),
  confirmSignUp: jest.fn(),
  resendSignUpCode: jest.fn(),
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

  describe('signUp', () => {
    it('should sign up a new user with email and password', async () => {
      const mockResult = {
        isSignUpComplete: false,
        userId: 'new-user-123',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      };
      (signUp as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(signUp).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'TestPassword123!',
        options: {
          userAttributes: {
            email: 'test@example.com',
          },
          autoSignIn: true,
        },
      });
      expect(result).toEqual({
        isConfirmed: false,
        userId: 'new-user-123',
      });
    });

    it('should sign up with optional name attribute', async () => {
      const mockResult = {
        isSignUpComplete: false,
        userId: 'new-user-456',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      };
      (signUp as jest.Mock).mockResolvedValueOnce(mockResult);

      await authService.signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      });

      expect(signUp).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'TestPassword123!',
        options: {
          userAttributes: {
            email: 'test@example.com',
            name: 'Test User',
          },
          autoSignIn: true,
        },
      });
    });

    it('should return confirmed status when no confirmation needed', async () => {
      const mockResult = {
        isSignUpComplete: true,
        userId: 'auto-confirmed-user',
        nextStep: { signUpStep: 'DONE' },
      };
      (signUp as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(result.isConfirmed).toBe(true);
    });

    it('should throw AuthenticationError on sign up failure', async () => {
      const error = new Error('User already exists');
      (signUp as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        authService.signUp({
          email: 'existing@example.com',
          password: 'TestPassword123!',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError with correct code', async () => {
      const error = new Error('Invalid password');
      (signUp as jest.Mock).mockRejectedValueOnce(error);

      try {
        await authService.signUp({
          email: 'test@example.com',
          password: 'weak',
        });
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthenticationError);
        expect((e as AuthenticationError).code).toBe('SIGNUP_ERROR');
      }
    });
  });

  describe('signIn', () => {
    it('should sign in user with email and password', async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' },
      });

      await authService.signIn({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(signIn).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'TestPassword123!',
      });
    });

    it('should throw AuthenticationError on sign in failure', async () => {
      const error = new Error('Incorrect username or password');
      (signIn as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        authService.signIn({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError with correct code', async () => {
      const error = new Error('User not found');
      (signIn as jest.Mock).mockRejectedValueOnce(error);

      try {
        await authService.signIn({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        });
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthenticationError);
        expect((e as AuthenticationError).code).toBe('SIGNIN_ERROR');
      }
    });

    it('should throw AuthenticationError when user not confirmed', async () => {
      const error = new Error('User is not confirmed');
      (signIn as jest.Mock).mockRejectedValueOnce(error);

      await expect(
        authService.signIn({
          email: 'unconfirmed@example.com',
          password: 'TestPassword123!',
        })
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('confirmSignUp', () => {
    it('should confirm sign up with verification code', async () => {
      (confirmSignUp as jest.Mock).mockResolvedValueOnce({
        isSignUpComplete: true,
        nextStep: { signUpStep: 'DONE' },
      });

      const result = await authService.confirmSignUp('test@example.com', '123456');

      expect(confirmSignUp).toHaveBeenCalledWith({
        username: 'test@example.com',
        confirmationCode: '123456',
      });
      expect(result).toEqual({
        isConfirmed: true,
      });
    });

    it('should return not confirmed when more steps needed', async () => {
      (confirmSignUp as jest.Mock).mockResolvedValueOnce({
        isSignUpComplete: false,
        nextStep: { signUpStep: 'COMPLETE_AUTO_SIGN_IN' },
      });

      const result = await authService.confirmSignUp('test@example.com', '123456');

      expect(result.isConfirmed).toBe(false);
    });

    it('should throw AuthenticationError on invalid code', async () => {
      const error = new Error('Invalid verification code');
      (confirmSignUp as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.confirmSignUp('test@example.com', 'invalid')).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw AuthenticationError with correct code', async () => {
      const error = new Error('Code expired');
      (confirmSignUp as jest.Mock).mockRejectedValueOnce(error);

      try {
        await authService.confirmSignUp('test@example.com', 'expired');
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthenticationError);
        expect((e as AuthenticationError).code).toBe('CONFIRM_ERROR');
      }
    });

    it('should throw AuthenticationError for already confirmed user', async () => {
      const error = new Error('User is already confirmed');
      (confirmSignUp as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.confirmSignUp('confirmed@example.com', '123456')).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe('resendConfirmationCode', () => {
    it('should resend confirmation code successfully', async () => {
      (resendSignUpCode as jest.Mock).mockResolvedValueOnce({
        destination: 'test@example.com',
        deliveryMedium: 'EMAIL',
      });

      await authService.resendConfirmationCode('test@example.com');

      expect(resendSignUpCode).toHaveBeenCalledWith({
        username: 'test@example.com',
      });
    });

    it('should throw AuthenticationError on failure', async () => {
      const error = new Error('Limit exceeded');
      (resendSignUpCode as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.resendConfirmationCode('test@example.com')).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw AuthenticationError with correct code', async () => {
      const error = new Error('User not found');
      (resendSignUpCode as jest.Mock).mockRejectedValueOnce(error);

      try {
        await authService.resendConfirmationCode('nonexistent@example.com');
        fail('Expected error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthenticationError);
        expect((e as AuthenticationError).code).toBe('RESEND_CODE_ERROR');
      }
    });

    it('should throw AuthenticationError for already confirmed user', async () => {
      const error = new Error('User is already confirmed');
      (resendSignUpCode as jest.Mock).mockRejectedValueOnce(error);

      await expect(authService.resendConfirmationCode('confirmed@example.com')).rejects.toThrow(
        AuthenticationError
      );
    });
  });
});
