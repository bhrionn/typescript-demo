/**
 * Authentication Type Definitions
 * Defines interfaces and types for authentication functionality
 */

/**
 * Supported identity providers
 */
export type IdentityProvider = 'google' | 'microsoft';

/**
 * User information from authentication
 */
export interface User {
  id: string;
  email: string;
  provider: IdentityProvider;
  name?: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

/**
 * Token pair returned from authentication
 */
export interface TokenPair {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

/**
 * Authentication error types
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
