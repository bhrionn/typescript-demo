/**
 * API request and response interfaces
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Re-export AWS Lambda types for convenience
export type APIGatewayEvent = APIGatewayProxyEvent;
export type APIGatewayResponse = APIGatewayProxyResult;

/**
 * File upload request metadata
 */
export interface FileUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  metadata?: Record<string, any>;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  fileId: string;
  fileName: string;
  uploadedAt: string;
  message: string;
}

/**
 * File metadata response
 */
export interface FileMetadataResponse {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  metadata?: Record<string, any>;
}

/**
 * List files response
 */
export interface ListFilesResponse {
  files: FileMetadataResponse[];
  total: number;
}

/**
 * Presigned URL response
 */
export interface PresignedUrlResponse {
  url: string;
  expiresIn: number;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}
