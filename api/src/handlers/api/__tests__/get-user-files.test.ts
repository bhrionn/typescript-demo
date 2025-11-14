/**
 * Unit tests for Get User Files handler
 * Requirements: 2.3
 */

// Mock dependencies BEFORE imports
jest.mock('../../../utils/database-connection');
jest.mock('../../../repositories/file-repository.impl');
jest.mock('../../../services/auth-service');

import { handler } from '../get-user-files';
import { AuthenticatedEvent } from '../../../middleware/auth-middleware';
import { FileRepository } from '../../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../../utils/database-connection';
import { IDatabaseConnection } from '../../../repositories/base-repository';

const mockCreateDatabaseConnection = createDatabaseConnection as jest.MockedFunction<
  typeof createDatabaseConnection
>;
const MockFileRepository = FileRepository as jest.MockedClass<typeof FileRepository>;

describe('Get User Files Handler', () => {
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
      findByUserIdPaginated: jest.fn(),
    } as any;
    MockFileRepository.mockImplementation(() => mockFileRepository);
  });

  const createMockEvent = (overrides: Partial<AuthenticatedEvent> = {}): AuthenticatedEvent => ({
    body: null,
    headers: {
      Authorization: 'Bearer mock-token',
    },
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/api/files',
    pathParameters: null,
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

  describe('Successful file retrieval', () => {
    it('should return user files with default pagination', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          userId: 'test-user-id',
          fileName: 'test1.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          s3Key: 'uploads/file-1',
          s3Bucket: 'test-bucket',
          uploadedAt: new Date('2024-01-01T00:00:00Z'),
          metadata: { tag: 'important' },
        },
        {
          id: 'file-2',
          userId: 'test-user-id',
          fileName: 'test2.jpg',
          fileSize: 2048,
          mimeType: 'image/jpeg',
          s3Key: 'uploads/file-2',
          s3Bucket: 'test-bucket',
          uploadedAt: new Date('2024-01-02T00:00:00Z'),
          metadata: undefined,
        },
      ];

      mockFileRepository.findByUserIdPaginated.mockResolvedValue({
        files: mockFiles,
        total: 2,
      });

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockFileRepository.findByUserIdPaginated).toHaveBeenCalledWith('test-user-id', 50, 0);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.files).toHaveLength(2);
      expect(body.data.total).toBe(2);
      expect(body.data.files[0].id).toBe('file-1');
      expect(body.data.files[0].fileName).toBe('test1.pdf');
      expect(body.data.files[0].uploadedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should handle custom pagination parameters', async () => {
      mockFileRepository.findByUserIdPaginated.mockResolvedValue({
        files: [],
        total: 100,
      });

      const event = createMockEvent({
        queryStringParameters: {
          limit: '25',
          offset: '50',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockFileRepository.findByUserIdPaginated).toHaveBeenCalledWith('test-user-id', 25, 50);
    });

    it('should cap limit at 100', async () => {
      mockFileRepository.findByUserIdPaginated.mockResolvedValue({
        files: [],
        total: 0,
      });

      const event = createMockEvent({
        queryStringParameters: {
          limit: '500',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockFileRepository.findByUserIdPaginated).toHaveBeenCalledWith('test-user-id', 100, 0);
    });

    it('should return empty array when user has no files', async () => {
      mockFileRepository.findByUserIdPaginated.mockResolvedValue({
        files: [],
        total: 0,
      });

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.files).toEqual([]);
      expect(body.data.total).toBe(0);
    });
  });

  describe('Input validation', () => {
    it('should reject invalid limit parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          limit: 'invalid',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid limit parameter');
    });

    it('should reject negative limit', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          limit: '-10',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid offset parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          offset: 'invalid',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid offset parameter');
    });

    it('should reject negative offset', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          offset: '-5',
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

  describe('Error handling', () => {
    it('should handle database errors', async () => {
      mockFileRepository.findByUserIdPaginated.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('DATABASE_ERROR');
      expect(body.message).toContain('Failed to retrieve user files');
      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      mockFileRepository.findByUserIdPaginated.mockRejectedValue(new Error('Unexpected error'));

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should disconnect database even on error', async () => {
      mockFileRepository.findByUserIdPaginated.mockRejectedValue(new Error('Test error'));

      const event = createMockEvent();
      await handler(event);

      expect(mockDb.disconnect).toHaveBeenCalled();
    });
  });

  describe('Response format', () => {
    it('should include CORS headers', async () => {
      mockFileRepository.findByUserIdPaginated.mockResolvedValue({
        files: [],
        total: 0,
      });

      const event = createMockEvent();
      const response = await handler(event);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should return properly formatted success response', async () => {
      mockFileRepository.findByUserIdPaginated.mockResolvedValue({
        files: [],
        total: 0,
      });

      const event = createMockEvent();
      const response = await handler(event);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('files');
      expect(body.data).toHaveProperty('total');
    });
  });
});
