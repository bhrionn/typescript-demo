/**
 * Unit tests for Generate Presigned URL handler
 * Requirements: 2.3
 */

// Mock dependencies BEFORE imports
jest.mock('../../../utils/database-connection');
jest.mock('../../../repositories/file-repository.impl');
jest.mock('../../../services/auth-service');
jest.mock('@aws-sdk/s3-request-presigner');

import { handler } from '../generate-presigned-url';
import { AuthenticatedEvent } from '../../../middleware/auth-middleware';
import { FileRepository } from '../../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../../utils/database-connection';
import { IDatabaseConnection } from '../../../repositories/base-repository';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const mockCreateDatabaseConnection = createDatabaseConnection as jest.MockedFunction<
  typeof createDatabaseConnection
>;
const MockFileRepository = FileRepository as jest.MockedClass<typeof FileRepository>;
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('Generate Presigned URL Handler', () => {
  let mockDb: jest.Mocked<IDatabaseConnection>;
  let mockFileRepository: jest.Mocked<FileRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database connection
    mockDb = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      queryOne: jest.fn(),
      transaction: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue(true),
    } as jest.Mocked<IDatabaseConnection>;
    (mockCreateDatabaseConnection as any).mockResolvedValue(mockDb);

    // Mock file repository
    mockFileRepository = {
      findById: jest.fn(),
    } as any;
    MockFileRepository.mockImplementation(() => mockFileRepository);

    // Mock S3 presigned URL generation
    mockGetSignedUrl.mockResolvedValue('https://s3.amazonaws.com/test-bucket/file?signature=xyz');
  });

  const createMockEvent = (overrides: Partial<AuthenticatedEvent> = {}): AuthenticatedEvent => ({
    body: null,
    headers: {
      Authorization: 'Bearer mock-token',
    },
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/api/files/123e4567-e89b-12d3-a456-426614174000/download',
    pathParameters: {
      fileId: '123e4567-e89b-12d3-a456-426614174000',
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
    user: {
      userId: 'test-user-id',
      email: 'test@example.com',
    },
    ...overrides,
  });

  describe('Successful presigned URL generation', () => {
    it('should generate presigned URL with default expiration', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'document.pdf',
        fileSize: 5120,
        mimeType: 'application/pdf',
        s3Key: 'uploads/document.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockFileRepository.findById).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(mockGetSignedUrl).toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.url).toBe('https://s3.amazonaws.com/test-bucket/file?signature=xyz');
      expect(body.data.expiresIn).toBe(3600); // Default 1 hour
      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should generate presigned URL with custom expiration', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'document.pdf',
        fileSize: 5120,
        mimeType: 'application/pdf',
        s3Key: 'uploads/document.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent({
        queryStringParameters: {
          expiresIn: '7200',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.expiresIn).toBe(7200); // 2 hours
    });

    it('should cap expiration at 7 days', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'document.pdf',
        fileSize: 5120,
        mimeType: 'application/pdf',
        s3Key: 'uploads/document.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent({
        queryStringParameters: {
          expiresIn: '999999999', // Very large number
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.expiresIn).toBe(604800); // Capped at 7 days
    });

    it('should accept fileId from id path parameter', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'test.txt',
        fileSize: 100,
        mimeType: 'text/plain',
        s3Key: 'uploads/test.txt',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent({
        pathParameters: {
          id: '123e4567-e89b-12d3-a456-426614174000',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockFileRepository.findById).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });
  });

  describe('Input validation', () => {
    it('should reject request without file ID', async () => {
      const event = createMockEvent({
        pathParameters: null,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('File ID is required');
    });

    it('should reject invalid UUID format', async () => {
      const event = createMockEvent({
        pathParameters: {
          fileId: 'invalid-uuid',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid file ID format');
    });

    it('should reject invalid expiresIn parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          expiresIn: 'invalid',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid expiresIn parameter');
    });

    it('should reject negative expiresIn', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          expiresIn: '-100',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject zero expiresIn', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          expiresIn: '0',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject request without authenticated user', async () => {
      const event = createMockEvent({
        user: undefined,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('User authentication required');
    });
  });

  describe('Authorization', () => {
    it('should return 404 when file does not exist', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toContain('File not found');
      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should return 403 when user does not own the file', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'different-user-id',
        fileName: 'private.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'uploads/private.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('AUTHORIZATION_ERROR');
      expect(body.message).toContain('You do not have permission to access this file');
      expect(mockDb.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      mockFileRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('DATABASE_ERROR');
      expect(body.message).toContain('Failed to verify file ownership');
      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should handle S3 presigned URL generation errors', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'document.pdf',
        fileSize: 5120,
        mimeType: 'application/pdf',
        s3Key: 'uploads/document.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);
      mockGetSignedUrl.mockRejectedValue(new Error('S3 service unavailable'));

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('EXTERNAL_SERVICE_ERROR');
      expect(body.message).toContain('S3');
      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      mockFileRepository.findById.mockRejectedValue(new Error('Unexpected error'));

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should disconnect database even on error', async () => {
      mockFileRepository.findById.mockRejectedValue(new Error('Test error'));

      const event = createMockEvent();
      await handler(event);

      expect(mockDb.disconnect).toHaveBeenCalled();
    });
  });

  describe('Response format', () => {
    it('should include CORS headers', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'uploads/test.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should return properly formatted success response', async () => {
      const mockFile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        s3Key: 'uploads/test.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:30:00Z'),
        metadata: undefined,
      };

      mockFileRepository.findById.mockResolvedValue(mockFile);

      const event = createMockEvent();
      const response = await handler(event);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('url');
      expect(body.data).toHaveProperty('expiresIn');
      expect(typeof body.data.url).toBe('string');
      expect(typeof body.data.expiresIn).toBe('number');
    });
  });
});
