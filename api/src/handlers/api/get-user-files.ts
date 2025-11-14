/**
 * Get User Files Lambda Handler
 * Requirements: 2.3, 8.16
 *
 * Retrieves all files uploaded by the authenticated user
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayResponse, ListFilesResponse } from '../../types/api';
import { AuthenticatedEvent, withAuth } from '../../middleware/auth-middleware';
import { FileRepository } from '../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../utils/database-connection';
import { ValidationError, DatabaseError, InternalServerError } from '../../types/errors';

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(event: AuthenticatedEvent): {
  limit: number;
  offset: number;
} {
  const queryParams = event.queryStringParameters || {};

  // Parse limit (default: 50, max: 100)
  let limit = 50;
  if (queryParams.limit) {
    const parsedLimit = parseInt(queryParams.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      throw new ValidationError('Invalid limit parameter: must be a positive integer');
    }
    limit = Math.min(parsedLimit, 100); // Cap at 100
  }

  // Parse offset (default: 0)
  let offset = 0;
  if (queryParams.offset) {
    const parsedOffset = parseInt(queryParams.offset, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      throw new ValidationError('Invalid offset parameter: must be a non-negative integer');
    }
    offset = parsedOffset;
  }

  return { limit, offset };
}

/**
 * Retrieve user's uploaded files from database
 * Requirements: 2.3
 */
async function getUserFiles(
  userId: string,
  limit: number,
  offset: number
): Promise<ListFilesResponse> {
  const db = await createDatabaseConnection();
  const fileRepository = new FileRepository(db);

  try {
    const result = await fileRepository.findByUserIdPaginated(userId, limit, offset);

    // Transform FileRecord to API response format
    const files = result.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploadedAt: file.uploadedAt?.toISOString() || new Date().toISOString(),
      metadata: file.metadata,
    }));

    return {
      files,
      total: result.total,
    };
  } catch (error) {
    console.error('Database error retrieving user files:', error);
    throw new DatabaseError('Failed to retrieve user files', {
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
function createSuccessResponse(data: ListFilesResponse): APIGatewayResponse {
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
  if (error instanceof ValidationError || error instanceof DatabaseError) {
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
async function handleGetUserFiles(event: AuthenticatedEvent): Promise<APIGatewayResponse> {
  try {
    // Ensure user is authenticated (middleware handles this)
    if (!event.user?.userId) {
      throw new ValidationError('User authentication required');
    }

    const userId = event.user.userId;

    // Parse pagination parameters
    const { limit, offset } = parsePaginationParams(event);

    // Log request (structured logging for CloudWatch)
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: 'get_user_files',
        userId,
        limit,
        offset,
        timestamp: new Date().toISOString(),
      })
    );

    // Retrieve user's files
    const result = await getUserFiles(userId, limit, offset);

    // Log success
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        action: 'get_user_files_success',
        userId,
        filesReturned: result.files.length,
        totalFiles: result.total,
        timestamp: new Date().toISOString(),
      })
    );

    // Return success response
    return createSuccessResponse(result);
  } catch (error) {
    // Log error
    console.error(
      JSON.stringify({
        action: 'get_user_files_error',
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
export const handler = withAuth(handleGetUserFiles);
