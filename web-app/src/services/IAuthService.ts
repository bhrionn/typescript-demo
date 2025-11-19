/**
 * Authentication Service Interface
 * Defines the contract for authentication operations following SOLID principles
 * (Interface Segregation Principle - focused interface for auth operations)
 */

import {
  IdentityProvider,
  User,
  SignUpCredentials,
  SignInCredentials,
  SignUpResult,
  ConfirmSignUpResult,
} from '../types/auth';

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

  /**
   * Signs up a new user with email and password
   * @param credentials - The sign up credentials
   * @returns Sign up result with confirmation status
   * @throws AuthenticationError if sign up fails
   */
  signUp(credentials: SignUpCredentials): Promise<SignUpResult>;

  /**
   * Signs in a user with email and password
   * @param credentials - The sign in credentials
   * @throws AuthenticationError if sign in fails
   */
  signIn(credentials: SignInCredentials): Promise<void>;

  /**
   * Confirms a user's sign up with verification code
   * @param email - The user's email
   * @param code - The confirmation code
   * @returns Confirmation result
   * @throws AuthenticationError if confirmation fails
   */
  confirmSignUp(email: string, code: string): Promise<ConfirmSignUpResult>;

  /**
   * Resends the confirmation code to user's email
   * @param email - The user's email
   * @throws AuthenticationError if resend fails
   */
  resendConfirmationCode(email: string): Promise<void>;
}
