/**
 * Types Module Exports
 * Centralizes type exports for clean imports
 */

export type { IdentityProvider, User, AuthState, TokenPair } from './auth';
export { AuthenticationError } from './auth';

export type {
  FileMetadata,
  UploadResponse,
  PresignedUrlResponse,
  ApiErrorResponse,
  ApiResponse,
} from './api';

// Error types
export {
  AppError,
  AuthenticationError as AppAuthenticationError,
  ValidationError,
  NetworkError,
  NotFoundError,
  ForbiddenError,
  FileUploadError as AppFileUploadError,
  SessionExpiredError,
  RateLimitError,
  ServerError,
  ConfigurationError,
  isAppError,
  isOperationalError,
  toAppError,
} from '../utils/errors';
