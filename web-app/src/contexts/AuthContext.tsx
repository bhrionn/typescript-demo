/**
 * Authentication Context
 * Provides authentication state and operations throughout the application
 * Following Single Responsibility Principle - manages only auth state
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { IAuthService } from '../services/IAuthService';
import { AuthService } from '../services/AuthService';
import {
  AuthState,
  IdentityProvider,
  SignUpCredentials,
  SignInCredentials,
  SignUpResult,
  ConfirmSignUpResult,
} from '../types/auth';

/**
 * Authentication context value interface
 * Exposes auth state and operations to consuming components
 */
interface AuthContextValue extends AuthState {
  login: (provider: IdentityProvider) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string>;
  getToken: () => Promise<string | null>;
  signUp: (credentials: SignUpCredentials) => Promise<SignUpResult>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<ConfirmSignUpResult>;
  resendConfirmationCode: (email: string) => Promise<void>;
}

/**
 * Authentication context
 * Following Dependency Inversion - context depends on IAuthService abstraction
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props for AuthProvider component
 */
interface AuthProviderProps {
  children: React.ReactNode;
  authService?: IAuthService; // Optional for testing/dependency injection
}

/**
 * Authentication Provider Component
 * Manages authentication state and provides it to child components
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children, authService }) => {
  // Create auth service instance once
  const [service] = useState(() => authService || new AuthService());

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
  });

  /**
   * Initialize auth state on component mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

        const isAuthenticated = await service.isAuthenticated();

        if (isAuthenticated) {
          const user = await service.getCurrentUser();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            error: null,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            error: null,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication check failed';
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: message,
        });
      }
    };

    initializeAuth();
  }, [service]);

  /**
   * Handles user login with specified provider
   */
  const login = useCallback(
    async (provider: IdentityProvider): Promise<void> => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        await service.login(provider);
        // Note: After redirect, the page will reload and initialization will run
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw error;
      }
    },
    [service]
  );

  /**
   * Handles user logout
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
      await service.logout();
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw error;
    }
  }, [service]);

  /**
   * Refreshes the authentication token
   */
  const refreshToken = useCallback(async (): Promise<string> => {
    try {
      return await service.refreshToken();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      setAuthState((prev) => ({
        ...prev,
        error: message,
      }));
      throw error;
    }
  }, [service]);

  /**
   * Gets the current access token
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    return await service.getToken();
  }, [service]);

  /**
   * Signs up a new user with email and password
   */
  const signUp = useCallback(
    async (credentials: SignUpCredentials): Promise<SignUpResult> => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        const result = await service.signUp(credentials);
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign up failed';
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw error;
      }
    },
    [service]
  );

  /**
   * Signs in a user with email and password
   */
  const signIn = useCallback(
    async (credentials: SignInCredentials): Promise<void> => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        await service.signIn(credentials);

        // After successful sign in, fetch user data
        const user = await service.getCurrentUser();
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign in failed';
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw error;
      }
    },
    [service]
  );

  /**
   * Confirms a user's sign up with verification code
   */
  const confirmSignUp = useCallback(
    async (email: string, code: string): Promise<ConfirmSignUpResult> => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        const result = await service.confirmSignUp(email, code);
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Confirmation failed';
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw error;
      }
    },
    [service]
  );

  /**
   * Resends the confirmation code to user's email
   */
  const resendConfirmationCode = useCallback(
    async (email: string): Promise<void> => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
        await service.resendConfirmationCode(email);
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to resend code';
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        throw error;
      }
    },
    [service]
  );

  const contextValue: AuthContextValue = {
    ...authState,
    login,
    logout,
    refreshToken,
    getToken,
    signUp,
    signIn,
    confirmSignUp,
    resendConfirmationCode,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access authentication context
 * Following Single Responsibility - provides easy access to auth context
 * @throws Error if used outside AuthProvider
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
