/**
 * Unit tests for File Upload handler
 * Requirements: 2.1, 2.4
 */

// Mock dependencies BEFORE imports
jest.mock('../../../utils/database-connection');
jest.mock('../../../repositories/file-repository.impl');
jest.mock('../../../services/auth-service');
jest.mock('@aws-sdk/client-s3');

import { handler } from '../upload-file';
import { AuthenticatedEvent } from '../../../middleware/auth-middleware';
import { FileRepository } from '../../../repositories/file-repository.impl';
import { createDatabaseConnection } from '../../../utils/database-connection';
import { IDatabaseConnection } from '../../../repositories/base-repository';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const mockCreateDatabaseConnection = createDatabaseConnection as jest.MockedFunction<
  typeof createDatabaseConnection
>;
const MockFileRepository = FileRepository as jest.MockedClass<typeof FileRepository>;
const MockS3Client = S3Client as jest.MockedClass<typeof S3Client>;

describe('File Upload Handler', () => {
  let mockDb: jest.Mocked<IDatabaseConnection>;
  let mockFileRepository: jest.Mocked<FileRepository>;
  let mockS3Send: jest.Mock;

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
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
    } as any;
    MockFileRepository.mockImplementation(() => mockFileRepository);

    // Mock S3 client
    mockS3Send = jest.fn().mockResolvedValue({});
    MockS3Client.mockImplementation(
      () =>
        ({
          send: mockS3Send,
        }) as any
    );
  });

  const createMockEvent = (overrides: Partial<AuthenticatedEvent> = {}): AuthenticatedEvent => ({
    body: null,
    headers: {
      Authorization: 'Bearer mock-token',
    },
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/files/upload',
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

  describe('File validation logic', () => {
    it('should reject empty files', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'empty.txt',
          fileContent: '',
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('empty');
    });

    it('should reject files exceeding maximum size', async () => {
      const largeFileContent = Buffer.alloc(51 * 1024 * 1024).toString('base64'); // 51MB

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'large-file.pdf',
          fileContent: largeFileContent,
          mimeType: 'application/pdf',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('exceeds maximum');
    });

    it('should reject disallowed file types', async () => {
      const fileContent = Buffer.from('test content').toString('base64');

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'malicious.exe',
          fileContent,
          mimeType: 'application/x-msdownload',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('not allowed');
    });

    it('should accept valid image files', async () => {
      const fileContent = Buffer.from('fake image data').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-123',
        userId: 'test-user-id',
        fileName: 'photo.jpg',
        fileSize: 15,
        mimeType: 'image/jpeg',
        s3Key: 'uploads/test-user-id/photo.jpg',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'photo.jpg',
          fileContent,
          mimeType: 'image/jpeg',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
    });

    it('should accept valid PDF files', async () => {
      const fileContent = Buffer.from('fake pdf data').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-456',
        userId: 'test-user-id',
        fileName: 'document.pdf',
        fileSize: 13,
        mimeType: 'application/pdf',
        s3Key: 'uploads/test-user-id/document.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'document.pdf',
          fileContent,
          mimeType: 'application/pdf',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
    });

    it('should reject files with missing file name', async () => {
      const fileContent = Buffer.from('test content').toString('base64');

      const event = createMockEvent({
        body: JSON.stringify({
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject files with path traversal attempts', async () => {
      const fileContent = Buffer.from('test content').toString('base64');

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: '../../../etc/passwd',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('path traversal');
    });

    it('should reject files with empty file name', async () => {
      const fileContent = Buffer.from('test content').toString('base64');

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: '   ',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('required');
    });
  });

  describe('S3 upload integration', () => {
    it('should upload file to S3 with encryption', async () => {
      const fileContent = Buffer.from('test file content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-789',
        userId: 'test-user-id',
        fileName: 'test.txt',
        fileSize: 17,
        mimeType: 'text/plain',
        s3Key: 'uploads/test-user-id/test.txt',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'test.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      expect(mockS3Send).toHaveBeenCalled();

      // Verify S3 command includes encryption
      const s3Command = mockS3Send.mock.calls[0][0];
      expect(s3Command).toBeInstanceOf(PutObjectCommand);
      expect(s3Command.input.ServerSideEncryption).toBe('AES256');
    });

    it('should generate unique S3 keys for files', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-unique',
        userId: 'test-user-id',
        fileName: 'file.txt',
        fileSize: 7,
        mimeType: 'text/plain',
        s3Key: 'uploads/test-user-id/12345-abc-file.txt',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'file.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      await handler(event);

      const s3Command = mockS3Send.mock.calls[0][0];
      expect(s3Command.input.Key).toContain('uploads/test-user-id/');
      expect(s3Command.input.Key).toContain('file.txt');
    });

    it('should include metadata in S3 upload', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-meta',
        userId: 'test-user-id',
        fileName: 'doc.pdf',
        fileSize: 7,
        mimeType: 'application/pdf',
        s3Key: 'uploads/test-user-id/doc.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'doc.pdf',
          fileContent,
          mimeType: 'application/pdf',
          metadata: { category: 'reports', year: 2024 },
        }),
      });

      await handler(event);

      const s3Command = mockS3Send.mock.calls[0][0];
      expect(s3Command.input.Metadata).toBeDefined();
      expect(s3Command.input.Metadata['original-filename']).toBe('doc.pdf');
      expect(s3Command.input.Metadata['uploaded-by']).toBe('test-user-id');
    });

    it('should handle S3 upload failures', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockS3Send.mockRejectedValue(new Error('S3 service unavailable'));

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'test.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('EXTERNAL_SERVICE_ERROR');
      expect(body.message).toContain('S3');
    });

    it('should set correct content type in S3 upload', async () => {
      const fileContent = Buffer.from('image data').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-img',
        userId: 'test-user-id',
        fileName: 'image.png',
        fileSize: 10,
        mimeType: 'image/png',
        s3Key: 'uploads/test-user-id/image.png',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'image.png',
          fileContent,
          mimeType: 'image/png',
        }),
      });

      await handler(event);

      const s3Command = mockS3Send.mock.calls[0][0];
      expect(s3Command.input.ContentType).toBe('image/png');
    });
  });

  describe('Metadata storage', () => {
    it('should store file metadata in database after successful upload', async () => {
      const fileContent = Buffer.from('test content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'stored-file-id',
        userId: 'test-user-id',
        fileName: 'stored.txt',
        fileSize: 12,
        mimeType: 'text/plain',
        s3Key: 'uploads/test-user-id/stored.txt',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T10:00:00Z'),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'stored.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      expect(mockFileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          fileName: 'stored.txt',
          fileSize: 12,
          mimeType: 'text/plain',
        })
      );
    });

    it('should include custom metadata in database record', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'meta-file-id',
        userId: 'test-user-id',
        fileName: 'report.pdf',
        fileSize: 7,
        mimeType: 'application/pdf',
        s3Key: 'uploads/test-user-id/report.pdf',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
        metadata: { department: 'finance', quarter: 'Q1' },
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'report.pdf',
          fileContent,
          mimeType: 'application/pdf',
          metadata: { department: 'finance', quarter: 'Q1' },
        }),
      });

      await handler(event);

      expect(mockFileRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { department: 'finance', quarter: 'Q1' },
        })
      );
    });

    it('should handle database storage failures', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockRejectedValue(new Error('Database connection failed'));

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'test.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('DATABASE_ERROR');
      expect(body.message).toContain('metadata');
    });

    it('should disconnect database after successful upload', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'file-id',
        userId: 'test-user-id',
        fileName: 'test.txt',
        fileSize: 7,
        mimeType: 'text/plain',
        s3Key: 'uploads/test-user-id/test.txt',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'test.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      await handler(event);

      expect(mockDb.disconnect).toHaveBeenCalled();
    });

    it('should disconnect database even on error', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockRejectedValue(new Error('Database error'));

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'test.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      await handler(event);

      expect(mockDb.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error scenarios', () => {
    it('should reject request without authentication', async () => {
      const event = createMockEvent({
        user: undefined,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('authentication required');
    });

    it('should handle missing request body', async () => {
      const event = createMockEvent({
        body: null,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('No file data');
    });

    it('should handle invalid JSON in request body', async () => {
      const event = createMockEvent({
        body: 'invalid json {',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid request body');
    });

    it('should handle base64-encoded binary uploads', async () => {
      const fileContent = Buffer.from('binary content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'binary-file-id',
        userId: 'test-user-id',
        fileName: 'binary.dat',
        fileSize: 14,
        mimeType: 'application/octet-stream',
        s3Key: 'uploads/test-user-id/binary.dat',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      });

      const event = createMockEvent({
        isBase64Encoded: true,
        body: fileContent,
        headers: {
          Authorization: 'Bearer mock-token',
          'x-file-name': 'binary.dat',
          'x-mime-type': 'application/octet-stream',
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
    });

    it('should handle unexpected errors gracefully', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockS3Send.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'test.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBeGreaterThanOrEqual(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should include CORS headers in error responses', async () => {
      const event = createMockEvent({
        body: null,
      });

      const response = await handler(event);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should return properly formatted success response', async () => {
      const fileContent = Buffer.from('content').toString('base64');

      mockFileRepository.create.mockResolvedValue({
        id: 'success-file-id',
        userId: 'test-user-id',
        fileName: 'success.txt',
        fileSize: 7,
        mimeType: 'text/plain',
        s3Key: 'uploads/test-user-id/success.txt',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date('2024-01-15T12:00:00Z'),
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fileName: 'success.txt',
          fileContent,
          mimeType: 'text/plain',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('fileId');
      expect(body.data).toHaveProperty('fileName', 'success.txt');
      expect(body.data).toHaveProperty('uploadedAt');
      expect(body.data).toHaveProperty('message');
    });
  });
});
