/**
 * File Upload Service Interface
 * Defines contract for file upload operations following SOLID principles
 * (Interface Segregation Principle - focused interface for file operations)
 */

/**
 * File validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Upload progress information
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload result
 */
export interface UploadResult {
  fileId: string;
  message: string;
}

/**
 * File metadata for upload
 */
export interface FileUploadMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  [key: string]: any;
}

/**
 * Observable pattern for progress tracking
 */
export interface ProgressObserver {
  next: (progress: UploadProgress) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

/**
 * File Upload Service interface
 * Provides file validation, upload, and progress tracking capabilities
 */
export interface IFileUploadService {
  /**
   * Validate a file before upload
   * @param file - File to validate
   * @returns Validation result with any errors
   */
  validateFile(file: File): ValidationResult;

  /**
   * Upload a file with progress tracking
   * @param file - File to upload
   * @param metadata - Optional additional metadata
   * @param observer - Optional progress observer
   * @returns Upload result with file ID
   */
  uploadFile(
    file: File,
    metadata?: Partial<FileUploadMetadata>,
    observer?: ProgressObserver
  ): Promise<UploadResult>;

  /**
   * Get supported file types
   * @returns Array of supported MIME types
   */
  getSupportedFileTypes(): string[];

  /**
   * Get maximum file size in bytes
   * @returns Maximum file size
   */
  getMaxFileSize(): number;
}
