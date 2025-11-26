/**
 * File Upload Lambda Handler
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.6
 *
 * Handles secure file uploads to S3 with metadata storage in RDS
 * Following SOLID principles: Single Responsibility
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { APIGatewayResponse } from '../../types/api';
import { AuthenticatedEvent, withAuth } from '../../middleware/auth-middleware';
import { FileRepository } from '../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../utils/database-connection';
import { createLogger } from '../../middleware/logging';
import {
  parseMultipartFormData as parseMultipart,
  validateMultipartRequest,
} from '../../utils/multipart-parser';
import {
  ValidationError,
  FileProcessingError,
  ExternalServiceError,
  DatabaseError,
  InternalServerError,
} from '../../types/errors';

/**
 * Configuration constants
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const ALLOWED_MIME_TYPES = [
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
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  // Other
  'application/json',
  'application/xml',
  'text/xml',
];

/**
 * Environment variables
 */
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * S3 client instance
 */
const s3Client = new S3Client({ region: AWS_REGION });

/**
 * File upload request interface
 */
interface FileUploadData {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileContent: Buffer;
  metadata?: Record<string, unknown>;
}

/**
 * Parse multipart form data from API Gateway event
 * Supports both multipart/form-data and legacy JSON/base64 formats
 */
function parseMultipartFormData(event: AuthenticatedEvent): FileUploadData {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';

  // Handle multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    const validation = validateMultipartRequest(contentType);
    if (!validation.isValid || !validation.boundary) {
      throw new ValidationError(validation.error || 'Invalid multipart request');
    }

    if (!event.body) {
      throw new ValidationError('No request body provided');
    }

    // Parse multipart data
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);
    const parsed = parseMultipart(body, validation.boundary);

    // Get the first file
    if (parsed.files.length === 0) {
      throw new ValidationError('No file found in multipart request');
    }

    const file = parsed.files[0];

    // Extract metadata from fields
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.fields)) {
      if (key !== 'file' && key !== 'fileName' && key !== 'mimeType') {
        try {
          metadata[key] = JSON.parse(value);
        } catch {
          metadata[key] = value;
        }
      }
    }

    return {
      fileName: file.filename,
      fileSize: file.size,
      mimeType: file.contentType,
      fileContent: file.data,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  // Legacy: For base64-encoded body (API Gateway binary support)
  if (event.isBase64Encoded && event.body) {
    const buffer = Buffer.from(event.body, 'base64');

    // Extract metadata from headers or query parameters
    const fileName =
      event.headers['x-file-name'] || event.queryStringParameters?.fileName || 'unnamed-file';
    const mimeType =
      event.headers['x-mime-type'] ||
      event.queryStringParameters?.mimeType ||
      'application/octet-stream';
    const metadataHeader = event.headers['x-metadata'] || event.queryStringParameters?.metadata;

    let metadata: Record<string, unknown> | undefined;
    if (metadataHeader) {
      try {
        metadata = JSON.parse(metadataHeader) as Record<string, unknown>;
      } catch {
        // Invalid metadata JSON, ignore
        metadata = undefined;
      }
    }

    return {
      fileName: decodeURIComponent(fileName),
      fileSize: buffer.length,
      mimeType,
      fileContent: buffer,
      metadata,
    };
  }

  // Legacy: For JSON body with base64 file content
  if (event.body) {
    try {
      const body = JSON.parse(event.body);

      if (!body.fileName || !body.fileContent) {
        throw new ValidationError('Missing required fields: fileName and fileContent');
      }

      const fileContent = Buffer.from(body.fileContent, 'base64');

      return {
        fileName: body.fileName,
        fileSize: fileContent.length,
        mimeType: body.mimeType || 'application/octet-stream',
        fileContent,
        metadata: body.metadata,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid request body format');
    }
  }

  throw new ValidationError('No file data provided');
}

/**
 * Validate file type and size
 * Requirements: 2.1
 */
function validateFile(fileData: FileUploadData): void {
  // Validate file size
  if (fileData.fileSize === 0) {
    throw new ValidationError('File is empty');
  }

  if (fileData.fileSize > MAX_FILE_SIZE) {
    throw new ValidationError(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(fileData.mimeType)) {
    throw new ValidationError(
      `File type '${fileData.mimeType}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
  }

  // Validate file name
  if (!fileData.fileName || fileData.fileName.trim().length === 0) {
    throw new ValidationError('File name is required');
  }

  // Check for path traversal attempts
  if (
    fileData.fileName.includes('..') ||
    fileData.fileName.includes('/') ||
    fileData.fileName.includes('\\')
  ) {
    throw new ValidationError('Invalid file name: path traversal detected');
  }
}

/**
 * Upload file to S3 with encryption
 * Requirements: 2.4, 3.6
 */
async function uploadToS3(
  fileData: FileUploadData,
  userId: string
): Promise<{ s3Key: string; s3Bucket: string }> {
  // Generate unique S3 key with user ID prefix
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  const sanitizedFileName = fileData.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `uploads/${userId}/${timestamp}-${randomSuffix}-${sanitizedFileName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileData.fileContent,
      ContentType: fileData.mimeType,
      ServerSideEncryption: 'AES256', // Enable encryption at rest
      Metadata: {
        'original-filename': fileData.fileName,
        'uploaded-by': userId,
        'upload-timestamp': new Date().toISOString(),
        ...(fileData.metadata || {}),
      },
    });

    await s3Client.send(command);

    return {
      s3Key,
      s3Bucket: S3_BUCKET_NAME,
    };
  } catch (error) {
    const logger = createLogger({ userId, s3Key });
    logger.error('S3 upload failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new ExternalServiceError('S3', 'Failed to upload file to storage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Store file metadata in RDS
 * Requirements: 2.5
 */
async function storeFileMetadata(
  fileData: FileUploadData,
  userId: string,
  s3Key: string,
  s3Bucket: string
): Promise<string> {
  const db = await createDatabaseConnection();
  const fileRepository = new FileRepository(db);

  try {
    const fileRecord = await fileRepository.create({
      userId,
      fileName: fileData.fileName,
      fileSize: fileData.fileSize,
      mimeType: fileData.mimeType,
      s3Key,
      s3Bucket,
      metadata: fileData.metadata,
    });

    return fileRecord.id;
  } catch (error) {
    const logger = createLogger({ userId, s3Key });
    logger.error('Database operation failed', {
      operation: 'storeFileMetadata',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw new DatabaseError('Failed to store file metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await db.disconnect();
  }
}

/**
 * Create success response
 */
function createSuccessResponse(
  fileId: string,
  fileName: string,
  uploadedAt: Date
): APIGatewayResponse {
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      data: {
        fileId,
        fileName,
        uploadedAt: uploadedAt.toISOString(),
        message: 'File uploaded successfully',
      },
    }),
  };
}

/**
 * Create error response
 */
function createErrorResponse(error: Error, requestId?: string): APIGatewayResponse {
  const logger = createLogger({ requestId });

  logger.error('File upload handler error', {
    errorType: error.name,
    message: error.message,
    stack: error.stack,
  });

  // Handle known error types
  if (
    error instanceof ValidationError ||
    error instanceof FileProcessingError ||
    error instanceof ExternalServiceError ||
    error instanceof DatabaseError
  ) {
    return {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(error.toJSON()),
    };
  }

  // Handle unexpected errors
  const internalError = new InternalServerError('An unexpected error occurred during file upload');
  return {
    statusCode: internalError.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(internalError.toJSON()),
  };
}

/**
 * Main handler function
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.6
 */
async function handleFileUpload(event: AuthenticatedEvent): Promise<APIGatewayResponse> {
  const requestId = event.requestContext?.requestId;

  try {
    // Ensure user is authenticated (middleware handles this)
    if (!event.user?.userId) {
      throw new ValidationError('User authentication required');
    }

    const userId = event.user.userId;

    // Parse multipart form data
    const fileData = parseMultipartFormData(event);

    // Validate file type and size
    validateFile(fileData);

    // Upload file to S3 with encryption
    const { s3Key, s3Bucket } = await uploadToS3(fileData, userId);

    // Store file metadata in RDS
    const fileId = await storeFileMetadata(fileData, userId, s3Key, s3Bucket);

    // Return success response
    return createSuccessResponse(fileId, fileData.fileName, new Date());
  } catch (error) {
    return createErrorResponse(error as Error, requestId);
  }
}

/**
 * Lambda handler with authentication middleware
 * Requirements: 2.3
 */
export const handler = withAuth(handleFileUpload);
