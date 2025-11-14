/**
 * Authentication Service Interface
 * Defines the contract for authentication operations following SOLID principles
 * (Interface Segregation Principle - focused interface for auth operations)
 */

import { IdentityProvider, User } from '../types/auth';

/**
 * Interface for authentication service operations
 * Following Dependency Inversion Principle - depend on abstractions
 */
export interface IAuthService {
  /**
   * Initiates login flow with specified identity provider
   * @param provider - The identity provider to use (google or microsoft)
   * @throws AuthenticationError if login fails
   */
  login(provider: IdentityProvider): Promise<void>;

  /**
   * Logs out the current user and clears session
   * @throws AuthenticationError if logout fails
   */
  logout(): Promise<void>;

  /**
   * Gets the current access token
   * @returns The access token or null if not authenticated
   */
  getToken(): Promise<string | null>;

  /**
   * Checks if user is currently authenticated
   * @returns True if user is authenticated, false otherwise
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Refreshes the current access token
   * @returns The new access token
   * @throws AuthenticationError if refresh fails
   */
  refreshToken(): Promise<string>;

  /**
   * Gets the current authenticated user
   * @returns The user object or null if not authenticated
   */
  getCurrentUser(): Promise<User | null>;
}
