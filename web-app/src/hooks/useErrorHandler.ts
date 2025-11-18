/**
 * useErrorHandler Hook
 * Provides convenient error handling in components
 * Following Single Responsibility Principle
 */

import { useCallback } from 'react';
import { useErrorHandler as useErrorHandlerContext } from '../contexts/ErrorHandlerContext';
import type { ErrorHandlingOptions } from '../services/ErrorHandler';

/**
 * Hook for error handling in components
 * Returns a function to handle errors with optional configuration
 */
export const useErrorHandler = () => {
  const errorHandler = useErrorHandlerContext();

  /**
   * Handle an error with optional configuration
   */
  const handleError = useCallback(
    (error: unknown, options?: ErrorHandlingOptions) => {
      errorHandler.handle(error, options);
    },
    [errorHandler]
  );

  /**
   * Handle error without showing notification (only log)
   */
  const logError = useCallback(
    (error: unknown, context?: Record<string, any>) => {
      errorHandler.handle(error, {
        showNotification: false,
        logError: true,
        context,
      });
    },
    [errorHandler]
  );

  /**
   * Handle error with custom message
   */
  const handleErrorWithMessage = useCallback(
    (error: unknown, message: string, context?: Record<string, any>) => {
      errorHandler.handle(error, {
        customMessage: message,
        context,
      });
    },
    [errorHandler]
  );

  /**
   * Create an error handler for async operations
   * Useful for wrapping async functions
   */
  const wrapAsync = useCallback(
    <T extends (...args: any[]) => Promise<any>>(fn: T, options?: ErrorHandlingOptions): T => {
      return (async (...args: any[]) => {
        try {
          return await fn(...args);
        } catch (error) {
          errorHandler.handle(error, options);
          throw error; // Re-throw so caller can handle if needed
        }
      }) as T;
    },
    [errorHandler]
  );

  return {
    handleError,
    logError,
    handleErrorWithMessage,
    wrapAsync,
  };
};
