/**
 * Error Logging Service Interface
 * Following Interface Segregation Principle - focused interface for error logging
 * Following Dependency Inversion Principle - depend on abstraction
 */

import type { AppError } from '../utils/errors';

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  /**
   * Error code
   */
  code: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Stack trace
   */
  stack?: string;

  /**
   * HTTP status code
   */
  statusCode?: number;

  /**
   * Additional context
   */
  context?: Record<string, any>;

  /**
   * User information (if available)
   */
  user?: {
    id?: string;
    email?: string;
  };

  /**
   * Browser/environment information
   */
  environment?: {
    userAgent?: string;
    url?: string;
    timestamp: string;
  };
}

/**
 * Error Logging Service Interface
 * Provides methods for logging errors to remote services
 */
export interface IErrorLoggingService {
  /**
   * Log an error to remote service (e.g., CloudWatch)
   */
  logError(error: AppError | Error, context?: Record<string, any>): Promise<void>;

  /**
   * Log a custom error entry
   */
  logEntry(entry: ErrorLogEntry): Promise<void>;

  /**
   * Set user context for error logs
   */
  setUserContext(userId?: string, email?: string): void;

  /**
   * Clear user context
   */
  clearUserContext(): void;
}
