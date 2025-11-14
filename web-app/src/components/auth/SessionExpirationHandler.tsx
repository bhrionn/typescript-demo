/**
 * Session Expiration Handler Component
 * Monitors authentication state and handles session expiration
 * Following Single Responsibility Principle - handles only session monitoring
 */

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';

/**
 * Props for SessionExpirationHandler
 */
export interface ISessionExpirationHandlerProps {
  /**
   * Children components to render
   */
  children: React.ReactNode;

  /**
   * Token refresh interval in milliseconds
   * Default: 5 minutes (300000ms)
   */
  refreshInterval?: number;

  /**
   * Path to redirect on session expiration
   * Default: '/login'
   */
  redirectPath?: string;
}

/**
 * Session Expiration Handler Component
 * Automatically refreshes tokens and handles session expiration
 */
export const SessionExpirationHandler: React.FC<ISessionExpirationHandlerProps> = ({
  children,
  refreshInterval = 300000, // 5 minutes
  redirectPath = '/login',
}) => {
  const { isAuthenticated, refreshToken, error } = useAuth();
  const navigate = useNavigate();
  const { showWarning, showError } = useToast();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownExpirationWarning = useRef(false);

  /**
   * Set up automatic token refresh
   */
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear interval if user is not authenticated
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Set up periodic token refresh
    refreshIntervalRef.current = setInterval(async () => {
      try {
        await refreshToken();
      } catch (err) {
        console.error('Token refresh failed:', err);
        // Error will be handled by the error effect below
      }
    }, refreshInterval);

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isAuthenticated, refreshToken, refreshInterval]);

  /**
   * Handle authentication errors (including session expiration)
   */
  useEffect(() => {
    if (error && isAuthenticated) {
      // Check if error is related to token/session expiration
      const isSessionError =
        error.includes('token') ||
        error.includes('session') ||
        error.includes('expired') ||
        error.includes('unauthorized');

      if (isSessionError && !hasShownExpirationWarning.current) {
        hasShownExpirationWarning.current = true;
        showWarning('Your session has expired. Please sign in again.');

        // Redirect to login after a short delay
        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, 2000);
      } else if (!isSessionError) {
        // Show generic error for non-session errors
        showError(error);
      }
    }

    // Reset warning flag when error is cleared
    if (!error) {
      hasShownExpirationWarning.current = false;
    }
  }, [error, isAuthenticated, navigate, redirectPath, showWarning, showError]);

  return <>{children}</>;
};
