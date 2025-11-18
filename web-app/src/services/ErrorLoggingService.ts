/**
 * Error Logging Service Implementation
 * Following SOLID principles:
 * - Single Responsibility: Handles error logging to CloudWatch via API
 * - Dependency Inversion: Depends on IApiClient abstraction
 */

import type { IErrorLoggingService, ErrorLogEntry } from './IErrorLoggingService';
import type { IApiClient } from './IApiClient';
import { AppError, isAppError, toAppError } from '../utils/errors';

/**
 * Error Logging Service
 * Logs errors to CloudWatch via API endpoint
 */
export class ErrorLoggingService implements IErrorLoggingService {
  private apiClient: IApiClient;
  private userContext?: { id?: string; email?: string };
  private readonly logEndpoint = '/api/logs/errors';

  constructor(apiClient: IApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Log an error to CloudWatch via API
   */
  async logError(error: AppError | Error, context?: Record<string, any>): Promise<void> {
    try {
      const appError = isAppError(error) ? error : toAppError(error);
      const entry = this.createLogEntry(appError, context);
      await this.logEntry(entry);
    } catch (loggingError) {
      // Don't throw if logging fails - log to console instead
      console.error('Failed to log error to remote service:', loggingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Log a custom error entry
   */
  async logEntry(entry: ErrorLogEntry): Promise<void> {
    try {
      // Send error log to API
      // The API will forward this to CloudWatch Logs
      await this.apiClient.post(this.logEndpoint, entry);
    } catch (error) {
      // Silently fail - don't want logging errors to break the app
      console.error('Failed to send error log:', error);
    }
  }

  /**
   * Set user context for error logs
   */
  setUserContext(userId?: string, email?: string): void {
    this.userContext = { id: userId, email };
  }

  /**
   * Clear user context
   */
  clearUserContext(): void {
    this.userContext = undefined;
  }

  /**
   * Create error log entry from AppError
   */
  private createLogEntry(error: AppError, additionalContext?: Record<string, any>): ErrorLogEntry {
    return {
      code: error.code,
      message: error.message,
      stack: this.sanitizeStack(error.stack),
      statusCode: error.statusCode,
      context: {
        ...error.context,
        ...additionalContext,
        isOperational: error.isOperational,
      },
      user: this.userContext,
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Sanitize stack trace to remove sensitive information
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // In production, you might want to:
    // - Remove file paths
    // - Remove query parameters
    // - Limit stack depth
    // For now, return as-is in development, truncate in production
    if (process.env.NODE_ENV === 'production') {
      const lines = stack.split('\n').slice(0, 10); // First 10 lines
      return lines.join('\n');
    }

    return stack;
  }
}
