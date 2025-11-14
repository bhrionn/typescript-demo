/**
 * Get File Metadata Lambda Handler
 * Requirements: 2.3, 8.16
 *
 * Retrieves metadata for a specific file by ID
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayResponse, FileMetadataResponse } from '../../types/api';
import { AuthenticatedEvent, withAuth } from '../../middleware/auth-middleware';
import { FileRepository } from '../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../utils/database-connection';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  DatabaseError,
  InternalServerError,
} from '../../types/errors';

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
 * Retrieve file metadata from database
 * Requirements: 2.3
 */
async function getFileMetadata(fileId: string, userId: string): Promise<FileMetadataResponse> {
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

    // Transform to API response format
    return {
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt?.toISOString() || new Date().toISOString(),
      metadata: file.metadata,
    };
  } catch (error) {
    // Re-throw known errors
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      throw error;
    }

    // Wrap database errors
    console.error('Database error retrieving file metadata:', error);
    throw new DatabaseError('Failed to retrieve file metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await db.disconnect();
  }
}

/**
 * Create success response
 * Requirements: 8.16
 */
function createSuccessResponse(data: FileMetadataResponse): APIGatewayResponse {
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
async function handleGetFileMetadata(event: AuthenticatedEvent): Promise<APIGatewayResponse> {
  try {
    // Ensure user is authenticated (middleware handles this)
    if (!event.user?.userId) {
      throw new ValidationError('User authentication required');
    }

    const userId = event.user.userId;

    // Extract and validate file ID
    const fileId = extractFileId(event);

    // Log request (structured logging for CloudWatch)
    console.log(
      JSON.stringify({
        action: 'get_file_metadata',
        userId,
        fileId,
        timestamp: new Date().toISOString(),
      })
    );

    // Retrieve file metadata
    const metadata = await getFileMetadata(fileId, userId);

    // Log success
    console.log(
      JSON.stringify({
        action: 'get_file_metadata_success',
        userId,
        fileId,
        timestamp: new Date().toISOString(),
      })
    );

    // Return success response
    return createSuccessResponse(metadata);
  } catch (error) {
    // Log error
    console.error(
      JSON.stringify({
        action: 'get_file_metadata_error',
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
export const handler = withAuth(handleGetFileMetadata);
