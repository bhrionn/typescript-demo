/**
 * Global Error Handler
 * Following SOLID principles:
 * - Single Responsibility: Centralized error handling logic
 * - Open-Closed: Can be extended with new error handling strategies
 * - Dependency Inversion: Depends on abstractions (INotificationService, IErrorLoggingService)
 */

import type { INotificationService } from './INotificationService';
import type { IErrorLoggingService } from './IErrorLoggingService';
import {
  AppError,
  AuthenticationError,
  ValidationError,
  NetworkError,
  NotFoundError,
  ForbiddenError,
  FileUploadError,
  SessionExpiredError,
  RateLimitError,
  ServerError,
  isAppError,
  isOperationalError,
  toAppError,
} from '../utils/errors';

/**
 * Error handling options
 */
export interface ErrorHandlingOptions {
  /**
   * Whether to show notification to user
   */
  showNotification?: boolean;

  /**
   * Whether to log error to remote service
   */
  logError?: boolean;

  /**
   * Custom notification message (overrides default)
   */
  customMessage?: string;

  /**
   * Additional context for logging
   */
  context?: Record<string, any>;

  /**
   * Callback after error is handled
   */
  onHandled?: (error: AppError) => void;
}

/**
 * Error Handler Strategy Interface
 * Following Strategy Pattern for different error handling approaches
 */
interface IErrorHandlingStrategy {
  canHandle(error: AppError): boolean;
  handle(error: AppError, options: ErrorHandlingOptions): void;
}

/**
 * Global Error Handler
 * Centralized error handling with notification and logging
 */
export class ErrorHandler {
  private notificationService: INotificationService;
  private loggingService: IErrorLoggingService;
  private strategies: IErrorHandlingStrategy[] = [];

  constructor(notificationService: INotificationService, loggingService: IErrorLoggingService) {
    this.notificationService = notificationService;
    this.loggingService = loggingService;
    this.initializeStrategies();
  }

  /**
   * Initialize error handling strategies
   */
  private initializeStrategies(): void {
    this.strategies = [
      new AuthenticationErrorStrategy(this.notificationService),
      new ValidationErrorStrategy(this.notificationService),
      new NetworkErrorStrategy(this.notificationService),
      new NotFoundErrorStrategy(this.notificationService),
      new ForbiddenErrorStrategy(this.notificationService),
      new FileUploadErrorStrategy(this.notificationService),
      new SessionExpiredErrorStrategy(this.notificationService),
      new RateLimitErrorStrategy(this.notificationService),
      new ServerErrorStrategy(this.notificationService),
      new DefaultErrorStrategy(this.notificationService),
    ];
  }

  /**
   * Handle an error
   */
  async handle(error: unknown, options: ErrorHandlingOptions = {}): Promise<void> {
    // Convert to AppError
    const appError = isAppError(error) ? error : toAppError(error);

    // Default options
    const finalOptions: ErrorHandlingOptions = {
      showNotification: true,
      logError: true,
      ...options,
    };

    try {
      // Log error if enabled
      if (finalOptions.logError) {
        await this.logError(appError, finalOptions.context);
      }

      // Show notification if enabled
      if (finalOptions.showNotification) {
        this.showNotification(appError, finalOptions.customMessage);
      }

      // Call onHandled callback
      if (finalOptions.onHandled) {
        finalOptions.onHandled(appError);
      }
    } catch (handlingError) {
      // Error while handling error - log to console
      console.error('Error while handling error:', handlingError);
      console.error('Original error:', appError);
    }
  }

  /**
   * Log error to remote service
   */
  private async logError(error: AppError, context?: Record<string, any>): Promise<void> {
    // Only log operational errors and all programming errors
    if (isOperationalError(error) || !error.isOperational) {
      await this.loggingService.logError(error, context);
    }
  }

  /**
   * Show notification to user
   */
  private showNotification(error: AppError, customMessage?: string): void {
    // Find appropriate strategy
    const strategy = this.strategies.find((s) => s.canHandle(error));

    if (strategy) {
      strategy.handle(error, { customMessage });
    } else {
      // Fallback to default
      this.notificationService.error(
        customMessage || error.message || 'An unexpected error occurred'
      );
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection(event: PromiseRejectionEvent): void {
    console.error('Unhandled promise rejection:', event.reason);
    this.handle(event.reason, {
      context: { type: 'unhandledRejection' },
    });
  }

  /**
   * Handle global errors
   */
  handleGlobalError(event: ErrorEvent): void {
    console.error('Global error:', event.error);
    this.handle(event.error, {
      context: {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  }
}

/**
 * Authentication Error Strategy
 */
class AuthenticationErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof AuthenticationError;
  }

  handle(_error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.error(
      options.customMessage || 'Authentication failed. Please log in again.'
    );
  }
}

/**
 * Validation Error Strategy
 */
class ValidationErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof ValidationError;
  }

  handle(error: AppError, options: ErrorHandlingOptions): void {
    const validationError = error as ValidationError;
    let message = options.customMessage || error.message;

    // Include field errors if available
    if (validationError.fields) {
      const fieldErrors = Object.entries(validationError.fields)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ');
      message = `${message} (${fieldErrors})`;
    }

    this.notificationService.warning(message);
  }
}

/**
 * Network Error Strategy
 */
class NetworkErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof NetworkError;
  }

  handle(_error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.error(
      options.customMessage || 'Network error. Please check your connection and try again.'
    );
  }
}

/**
 * Not Found Error Strategy
 */
class NotFoundErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof NotFoundError;
  }

  handle(error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.warning(options.customMessage || error.message);
  }
}

/**
 * Forbidden Error Strategy
 */
class ForbiddenErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof ForbiddenError;
  }

  handle(_error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.error(
      options.customMessage ||
        'Access forbidden. You do not have permission to perform this action.'
    );
  }
}

/**
 * File Upload Error Strategy
 */
class FileUploadErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof FileUploadError;
  }

  handle(error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.error(
      options.customMessage || error.message || 'File upload failed. Please try again.'
    );
  }
}

/**
 * Session Expired Error Strategy
 */
class SessionExpiredErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof SessionExpiredError;
  }

  handle(_error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.warning(
      options.customMessage || 'Your session has expired. Please log in again.'
    );
  }
}

/**
 * Rate Limit Error Strategy
 */
class RateLimitErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof RateLimitError;
  }

  handle(error: AppError, options: ErrorHandlingOptions): void {
    const rateLimitError = error as RateLimitError;
    let message = options.customMessage || 'Too many requests. Please try again later.';

    if (rateLimitError.retryAfter) {
      message += ` (Retry after ${rateLimitError.retryAfter} seconds)`;
    }

    this.notificationService.warning(message);
  }
}

/**
 * Server Error Strategy
 */
class ServerErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(error: AppError): boolean {
    return error instanceof ServerError;
  }

  handle(_error: AppError, options: ErrorHandlingOptions): void {
    this.notificationService.error(
      options.customMessage || 'Server error occurred. Please try again later.'
    );
  }
}

/**
 * Default Error Strategy (fallback)
 */
class DefaultErrorStrategy implements IErrorHandlingStrategy {
  constructor(private notificationService: INotificationService) {}

  canHandle(_error: AppError): boolean {
    return true; // Always can handle (fallback)
  }

  handle(error: AppError, options: ErrorHandlingOptions): void {
    // Show generic error message for unknown errors
    const message = options.customMessage || error.message || 'An unexpected error occurred';

    // Use different notification type based on whether it's operational
    if (error.isOperational) {
      this.notificationService.error(message);
    } else {
      // Programming errors - show generic message to user
      this.notificationService.error('An unexpected error occurred. Please try again.');
    }
  }
}
