/**
 * API Type Definitions
 * Types for API requests and responses
 */

/**
 * File metadata returned from API
 */
export interface FileMetadata {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  s3Bucket: string;
  uploadedAt: string;
  metadata?: Record<string, any>;
}

/**
 * File upload response
 */
export interface UploadResponse {
  fileId: string;
  message: string;
}

/**
 * Presigned URL response
 */
export interface PresignedUrlResponse {
  url: string;
  expiresIn: number;
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode?: number;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
}
