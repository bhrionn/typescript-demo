/**
 * Services Module Exports
 * Centralizes service exports for clean imports
 */

export type { IAuthService } from './IAuthService';
export { AuthService } from './AuthService';

export type { IApiClient, RequestConfig } from './IApiClient';
export { ApiClient, ApiError } from './ApiClient';

export type {
  IFileUploadService,
  ValidationResult,
  UploadProgress,
  UploadResult,
  FileUploadMetadata,
  ProgressObserver,
} from './IFileUploadService';
export { FileUploadService, FileUploadError } from './FileUploadService';

export type {
  INotificationService,
  NotificationOptions,
  NotificationType,
} from './INotificationService';
export { NotificationService } from './NotificationService';

export type { IErrorLoggingService, ErrorLogEntry } from './IErrorLoggingService';
export { ErrorLoggingService } from './ErrorLoggingService';

export type { ErrorHandlingOptions } from './ErrorHandler';
export { ErrorHandler } from './ErrorHandler';
