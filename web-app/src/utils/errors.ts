/**
 * Error Hierarchy and Error Handling Utilities
 * Following SOLID principles:
 * - Single Responsibility: Each error class has a specific purpose
 * - Open-Closed: Can extend with new error types without modifying existing ones
 * - Liskov Substitution: All error types are substitutable for AppError
 */

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * HTTP status code (if applicable)
   */
  public readonly statusCode: number;

  /**
   * Whether this is an operational error (expected) vs programming error
   */
  public readonly isOperational: boolean;

  /**
   * Additional context data
   */
  public readonly context?: Record<string, any>;

  /**
   * Timestamp when error occurred
   */
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
    super('AUTH_ERROR', message, 401, true, context);
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(
    message: string = 'Validation failed',
    fields?: Record<string, string>,
    context?: Record<string, any>
  ) {
    super('VALIDATION_ERROR', message, 400, true, context);
    this.fields = fields;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      fields: this.fields,
    };
  }
}

/**
 * Network and API communication errors
 */
export class NetworkError extends AppError {
  constructor(message: string = 'Network error occurred', context?: Record<string, any>) {
    super('NETWORK_ERROR', message, 0, true, context);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', message?: string, context?: Record<string, any>) {
    super('NOT_FOUND', message || `${resource} not found`, 404, true, context);
  }
}

/**
 * Permission denied errors
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', context?: Record<string, any>) {
    super('FORBIDDEN', message, 403, true, context);
  }
}

/**
 * File upload errors
 */
export class FileUploadError extends AppError {
  constructor(message: string = 'File upload failed', context?: Record<string, any>) {
    super('FILE_UPLOAD_ERROR', message, 400, true, context);
  }
}

/**
 * Session expired errors
 */
export class SessionExpiredError extends AppError {
  constructor(message: string = 'Your session has expired', context?: Record<string, any>) {
    super('SESSION_EXPIRED', message, 401, true, context);
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Too many requests',
    retryAfter?: number,
    context?: Record<string, any>
  ) {
    super('RATE_LIMIT', message, 429, true, context);
    this.retryAfter = retryAfter;
  }

  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    };
  }
}

/**
 * Server errors
 */
export class ServerError extends AppError {
  constructor(message: string = 'Server error occurred', context?: Record<string, any>) {
    super('SERVER_ERROR', message, 500, true, context);
  }
}

/**
 * Configuration errors (programming errors)
 */
export class ConfigurationError extends AppError {
  constructor(message: string = 'Configuration error', context?: Record<string, any>) {
    super('CONFIG_ERROR', message, 500, false, context);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  // Already an AppError
  if (isAppError(error)) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    return new AppError('UNKNOWN_ERROR', error.message, 500, false, { originalError: error.name });
  }

  // String error
  if (typeof error === 'string') {
    return new AppError('UNKNOWN_ERROR', error, 500, false);
  }

  // Unknown error type
  return new AppError('UNKNOWN_ERROR', 'An unexpected error occurred', 500, false, {
    error: String(error),
  });
}
