/**
 * API Client Interface
 * Defines contract for HTTP operations following SOLID principles
 * (Interface Segregation Principle - focused interface for API operations)
 */

import type { FileMetadata, UploadResponse, PresignedUrlResponse } from '../types/api';

/**
 * Configuration options for API requests
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * API Client interface for HTTP operations
 * Provides typed methods for all API endpoints
 */
export interface IApiClient {
  /**
   * Upload a file to the API
   * @param file - File to upload
   * @param onProgress - Optional callback for upload progress (0-100)
   * @returns Upload response with file ID
   */
  uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResponse>;

  /**
   * Get list of files for the authenticated user
   * @returns Array of file metadata
   */
  getUserFiles(): Promise<FileMetadata[]>;

  /**
   * Get metadata for a specific file
   * @param fileId - ID of the file
   * @returns File metadata
   */
  getFileMetadata(fileId: string): Promise<FileMetadata>;

  /**
   * Generate a presigned URL for file download
   * @param fileId - ID of the file
   * @returns Presigned URL and expiration time
   */
  getPresignedUrl(fileId: string): Promise<PresignedUrlResponse>;

  /**
   * Generic GET request
   * @param endpoint - API endpoint path
   * @param config - Optional request configuration
   * @returns Response data
   */
  get<T>(endpoint: string, config?: RequestConfig): Promise<T>;

  /**
   * Generic POST request
   * @param endpoint - API endpoint path
   * @param data - Request body data
   * @param config - Optional request configuration
   * @returns Response data
   */
  post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T>;

  /**
   * Generic PUT request
   * @param endpoint - API endpoint path
   * @param data - Request body data
   * @param config - Optional request configuration
   * @returns Response data
   */
  put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T>;

  /**
   * Generic DELETE request
   * @param endpoint - API endpoint path
   * @param config - Optional request configuration
   * @returns Response data
   */
  delete<T>(endpoint: string, config?: RequestConfig): Promise<T>;
}
