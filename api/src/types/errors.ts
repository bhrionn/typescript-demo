/**
 * Shared error classes following SOLID principles
 * Single Responsibility: Each error class represents a specific error type
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super('AUTHENTICATION_ERROR', message, 401, true, details);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', details?: any) {
    super('AUTHORIZATION_ERROR', message, 403, true, details);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: any) {
    super('VALIDATION_ERROR', message, 400, true, details);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super('NOT_FOUND', `${resource} not found`, 404, true, details);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: any) {
    super('CONFLICT', message, 409, true, details);
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super('DATABASE_ERROR', message, 500, true, details);
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error', details?: any) {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, 502, true, details);
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super('INTERNAL_ERROR', message, 500, false, details);
  }
}

/**
 * File processing error (400)
 */
export class FileProcessingError extends AppError {
  constructor(message: string = 'File processing failed', details?: any) {
    super('FILE_PROCESSING_ERROR', message, 400, true, details);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super('RATE_LIMIT_ERROR', message, 429, true, details);
  }
}
