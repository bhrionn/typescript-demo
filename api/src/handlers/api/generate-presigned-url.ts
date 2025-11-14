/**
 * Generate Presigned URL Lambda Handler
 * Requirements: 2.3, 8.16
 *
 * Generates presigned S3 URLs for secure file downloads
 * Following SOLID principles: Single Responsibility
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { APIGatewayResponse, PresignedUrlResponse } from '../../types/api';
import { AuthenticatedEvent, withAuth } from '../../middleware/auth-middleware';
import { FileRepository } from '../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../utils/database-connection';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  DatabaseError,
  ExternalServiceError,
  InternalServerError,
} from '../../types/errors';

/**
 * Environment variables
 */
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const PRESIGNED_URL_EXPIRATION = 3600; // 1 hour in seconds

/**
 * S3 client instance
 */
const s3Client = new S3Client({ region: AWS_REGION });

/**
 * Extract and validate file ID from path parameters
 * Requirements: 2.3
 */
function extractFileId(event: AuthenticatedEvent): string {
  const fileId = event.pathParameters?.fileId || event.pathParameters?.id;

  if (!fileId) {
    throw new ValidationError('File ID is required');
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(fileId)) {
    throw new ValidationError('Invalid file ID format');
  }

  return fileId;
}

/**
 * Parse expiration time from query parameters
 * Requirements: 2.3
 */
function parseExpirationTime(event: AuthenticatedEvent): number {
  const queryParams = event.queryStringParameters || {};

  if (!queryParams.expiresIn) {
    return PRESIGNED_URL_EXPIRATION;
  }

  const expiresIn = parseInt(queryParams.expiresIn, 10);

  if (isNaN(expiresIn) || expiresIn < 1) {
    throw new ValidationError('Invalid expiresIn parameter: must be a positive integer');
  }

  // Cap at 7 days (604800 seconds)
  return Math.min(expiresIn, 604800);
}

/**
 * Verify file ownership and retrieve S3 location
 * Requirements: 2.3
 */
async function verifyFileOwnership(
  fileId: string,
  userId: string
): Promise<{ s3Key: string; s3Bucket: string; fileName: string }> {
  const db = await createDatabaseConnection();
  const fileRepository = new FileRepository(db);

  try {
    // Find file by ID
    const file = await fileRepository.findById(fileId);

    if (!file) {
      throw new NotFoundError('File');
    }

    // Verify user owns the file
    if (file.userId !== userId) {
      throw new AuthorizationError('You do not have permission to access this file');
    }

    return {
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      fileName: file.fileName,
    };
  } catch (error) {
    // Re-throw known errors
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      throw error;
    }

    // Wrap database errors
    console.error('Database error verifying file ownership:', error);
    throw new DatabaseError('Failed to verify file ownership', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await db.disconnect();
  }
}

/**
 * Generate presigned URL for S3 object
 * Requirements: 2.3
 */
async function generatePresignedUrl(
  s3Bucket: string,
  s3Key: string,
  fileName: string,
  expiresIn: number
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return url;
  } catch (error) {
    console.error('S3 presigned URL generation error:', error);
    throw new ExternalServiceError('S3', 'Failed to generate presigned URL', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Create success response
 * Requirements: 8.16
 */
function createSuccessResponse(data: PresignedUrlResponse): APIGatewayResponse {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

/**
 * Create error response
 * Requirements: 8.16
 */
function createErrorResponse(error: Error): APIGatewayResponse {
  console.error('Handler error:', error);

  // Handle known error types
  if (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof AuthorizationError ||
    error instanceof DatabaseError ||
    error instanceof ExternalServiceError
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
  const internalError = new InternalServerError('An unexpected error occurred');
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
 * Requirements: 2.3, 8.16
 */
async function handleGeneratePresignedUrl(event: AuthenticatedEvent): Promise<APIGatewayResponse> {
  try {
    // Ensure user is authenticated (middleware handles this)
    if (!event.user?.userId) {
      throw new ValidationError('User authentication required');
    }

    const userId = event.user.userId;

    // Extract and validate file ID
    const fileId = extractFileId(event);

    // Parse expiration time
    const expiresIn = parseExpirationTime(event);

    // Log request (structured logging for CloudWatch)
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: 'generate_presigned_url',
        userId,
        fileId,
        expiresIn,
        timestamp: new Date().toISOString(),
      })
    );

    // Verify file ownership and get S3 location
    const { s3Key, s3Bucket, fileName } = await verifyFileOwnership(fileId, userId);

    // Generate presigned URL
    const url = await generatePresignedUrl(s3Bucket, s3Key, fileName, expiresIn);

    // Log success
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: 'generate_presigned_url_success',
        userId,
        fileId,
        timestamp: new Date().toISOString(),
      })
    );

    // Return success response
    return createSuccessResponse({
      url,
      expiresIn,
    });
  } catch (error) {
    // Log error
    console.error(
      JSON.stringify({
        action: 'generate_presigned_url_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    );

    return createErrorResponse(error as Error);
  }
}

/**
 * Lambda handler with authentication middleware
 * Requirements: 2.3
 */
export const handler = withAuth(handleGeneratePresignedUrl);
