/**
 * File Upload Service Implementation
 * Handles file validation, upload, and progress tracking
 * Follows SOLID principles:
 * - Single Responsibility: Manages file upload operations
 * - Dependency Inversion: Depends on IApiClient abstraction
 */

import type {
  IFileUploadService,
  ValidationResult,
  UploadProgress,
  UploadResult,
  FileUploadMetadata,
  ProgressObserver,
} from './IFileUploadService';
import type { IApiClient } from './IApiClient';

/**
 * Custom error class for file upload errors
 */
export class FileUploadError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

/**
 * File Upload Service implementation
 * Provides file validation and upload with progress tracking
 */
export class FileUploadService implements IFileUploadService {
  private apiClient: IApiClient;

  // Maximum file size: 50MB
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  // Supported file types (images and documents)
  private readonly SUPPORTED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
  ];

  constructor(apiClient: IApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Validate a file before upload
   */
  validateFile(file: File): ValidationResult {
    const errors: string[] = [];

    // Check if file exists
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Validate file size
    if (file.size === 0) {
      errors.push('File is empty');
    } else if (file.size > this.MAX_FILE_SIZE) {
      const maxSizeMB = this.MAX_FILE_SIZE / (1024 * 1024);
      errors.push(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
    }

    // Validate file type
    if (!this.SUPPORTED_MIME_TYPES.includes(file.type)) {
      errors.push(
        `File type '${file.type}' is not supported. Supported types: images and documents`
      );
    }

    // Validate file name
    if (!file.name || file.name.trim() === '') {
      errors.push('File name is required');
    } else if (file.name.length > 255) {
      errors.push('File name is too long (maximum 255 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Upload a file with progress tracking using Observable pattern
   */
  async uploadFile(
    file: File,
    _metadata?: Partial<FileUploadMetadata>,
    observer?: ProgressObserver
  ): Promise<UploadResult> {
    // Validate file first
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      const error = new FileUploadError('VALIDATION_ERROR', validation.errors.join(', '));
      observer?.error?.(error);
      throw error;
    }

    try {
      // Create progress callback for API client
      const onProgress = observer
        ? (percentage: number) => {
            const progress: UploadProgress = {
              loaded: Math.round((file.size * percentage) / 100),
              total: file.size,
              percentage,
            };
            observer.next(progress);
          }
        : undefined;

      // Upload file via API client
      const response = await this.apiClient.uploadFile(file, onProgress);

      // Notify completion
      observer?.complete?.();

      return {
        fileId: response.fileId,
        message: response.message,
      };
    } catch (error) {
      // Transform error and notify observer
      const uploadError = new FileUploadError(
        'UPLOAD_ERROR',
        error instanceof Error ? error.message : 'Failed to upload file',
        error
      );
      observer?.error?.(uploadError);
      throw uploadError;
    }
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return [...this.SUPPORTED_MIME_TYPES];
  }

  /**
   * Get maximum file size in bytes
   */
  getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Build multipart form data for file upload
   * This is handled internally by the API client, but exposed for flexibility
   * @param file - File to include in form data
   * @param metadata - Optional metadata to include
   * @returns FormData object ready for upload
   */
  buildFormData(file: File, metadata?: Partial<FileUploadMetadata>): FormData {
    const formData = new FormData();
    formData.append('file', file);

    // Add metadata if provided
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
    }

    return formData;
  }
}
