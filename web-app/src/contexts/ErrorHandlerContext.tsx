/**
 * Error Handler Context
 * Provides global error handling throughout the application
 * Following Dependency Inversion Principle
 */

import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { ErrorHandler } from '../services/ErrorHandler';
import { NotificationService } from '../services/NotificationService';
import { ErrorLoggingService } from '../services/ErrorLoggingService';
import { useToast } from '../components/common/Toast';
import { ApiClient } from '../services/ApiClient';
import { useAuth } from '../hooks/useAuth';

/**
 * Error Handler Context Interface
 */
interface IErrorHandlerContext {
  errorHandler: ErrorHandler;
}

// Create context
const ErrorHandlerContext = createContext<IErrorHandlerContext | undefined>(undefined);

/**
 * Error Handler Provider Props
 */
interface ErrorHandlerProviderProps {
  children: ReactNode;
  apiClient: ApiClient;
}

/**
 * Error Handler Provider
 * Provides error handling services to the entire application
 */
export const ErrorHandlerProvider: React.FC<ErrorHandlerProviderProps> = ({
  children,
  apiClient,
}) => {
  const toastContext = useToast();
  const { user } = useAuth();

  // Create services
  const notificationService = useMemo(() => new NotificationService(toastContext), [toastContext]);

  const loggingService = useMemo(() => new ErrorLoggingService(apiClient), [apiClient]);

  // Create error handler
  const errorHandler = useMemo(
    () => new ErrorHandler(notificationService, loggingService),
    [notificationService, loggingService]
  );

  // Update user context when user changes
  useEffect(() => {
    if (user) {
      loggingService.setUserContext(user.id, user.email);
    } else {
      loggingService.clearUserContext();
    }
  }, [user, loggingService]);

  // Set up global error handlers
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      errorHandler.handleUnhandledRejection(event);
    };

    const handleGlobalError = (event: ErrorEvent) => {
      errorHandler.handleGlobalError(event);
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, [errorHandler]);

  const contextValue: IErrorHandlerContext = {
    errorHandler,
  };

  return (
    <ErrorHandlerContext.Provider value={contextValue}>{children}</ErrorHandlerContext.Provider>
  );
};

/**
 * Hook to use error handler
 */
export const useErrorHandler = (): ErrorHandler => {
  const context = useContext(ErrorHandlerContext);
  if (!context) {
    throw new Error('useErrorHandler must be used within an ErrorHandlerProvider');
  }
  return context.errorHandler;
};
