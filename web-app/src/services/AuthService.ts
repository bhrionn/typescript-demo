/**
 * Authentication Service Implementation
 * Implements authentication using AWS Amplify and Cognito
 * Following Single Responsibility Principle - handles only authentication logic
 */

import { Amplify } from 'aws-amplify';
import {
  signInWithRedirect,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import { IAuthService } from './IAuthService';
import { IdentityProvider, User, AuthenticationError } from '../types/auth';
import { environment } from '../config/environment';

/**
 * AWS Amplify-based authentication service
 * Implements IAuthService interface for Cognito integration
 */
export class AuthService implements IAuthService {
  private initialized = false;

  constructor() {
    this.initializeAmplify();
  }

  /**
   * Initializes AWS Amplify with Cognito configuration
   * @private
   */
  private initializeAmplify(): void {
    if (this.initialized) {
      return;
    }

    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: environment.cognitoUserPoolId,
            userPoolClientId: environment.cognitoClientId,
            loginWith: {
              oauth: {
                domain: environment.cognitoDomain,
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [window.location.origin],
                redirectSignOut: [window.location.origin],
                responseType: 'code',
              },
            },
          },
        },
      });

      this.initialized = true;
    } catch (error) {
      throw new AuthenticationError('Failed to initialize authentication service', 'INIT_ERROR');
    }
  }

  /**
   * Initiates federated login with specified provider
   * Redirects user to identity provider login page
   */
  async login(provider: IdentityProvider): Promise<void> {
    try {
      // Map our provider type to Amplify's provider format
      const amplifyProvider = provider === 'google' ? 'Google' : 'Microsoft';

      await signInWithRedirect({
        provider: amplifyProvider as any,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      throw new AuthenticationError(message, 'LOGIN_ERROR');
    }
  }

  /**
   * Logs out the current user
   * Clears all session data and redirects to login
   */
  async logout(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      throw new AuthenticationError(message, 'LOGOUT_ERROR');
    }
  }

  /**
   * Retrieves the current access token
   * @returns Access token or null if not authenticated
   */
  async getToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch (error) {
      // User not authenticated
      return null;
    }
  }

  /**
   * Checks if user is currently authenticated
   * @returns True if authenticated, false otherwise
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      return !!session.tokens?.accessToken;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refreshes the current access token
   * Amplify handles token refresh automatically
   * @returns New access token
   */
  async refreshToken(): Promise<string> {
    try {
      // Force refresh by passing forceRefresh option
      const session = await fetchAuthSession({ forceRefresh: true });
      const token = session.tokens?.accessToken?.toString();

      if (!token) {
        throw new Error('No token available after refresh');
      }

      return token;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      throw new AuthenticationError(message, 'REFRESH_ERROR');
    }
  }

  /**
   * Gets the current authenticated user information
   * @returns User object or null if not authenticated
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      // Determine provider from user attributes
      const identities = attributes.identities ? JSON.parse(attributes.identities as string) : [];
      const provider = identities[0]?.providerName?.toLowerCase() || 'google';

      return {
        id: currentUser.userId,
        email: attributes.email || '',
        provider: provider as IdentityProvider,
        name: attributes.name,
      };
    } catch (error) {
      // User not authenticated
      return null;
    }
  }
}
