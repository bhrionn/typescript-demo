/**
 * Unit tests for File Repository
 * Requirements: 10.4
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FileRepository } from '../file-repository.impl';
import { IDatabaseConnection } from '../base-repository';
import { FileRecord } from '../../types/database';

describe('FileRepository', () => {
  let fileRepository: FileRepository;
  let mockDb: jest.Mocked<IDatabaseConnection>;

  const mockFile: FileRecord = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'user-123',
    fileName: 'test-file.pdf',
    fileSize: 1024000,
    mimeType: 'application/pdf',
    s3Key: 'uploads/user-123/test-file.pdf',
    s3Bucket: 'test-bucket',
    uploadedAt: new Date('2024-01-01'),
    metadata: { originalName: 'test-file.pdf' },
  };

  beforeEach(() => {
    mockDb = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      query: jest.fn(),
      queryOne: jest.fn(),
      transaction: jest.fn(),
      isHealthy: jest.fn(),
    };

    fileRepository = new FileRepository(mockDb);
  });

  describe('findById', () => {
    it('should find a file by ID', async () => {
      mockDb.queryOne.mockResolvedValue(mockFile);

      const result = await fileRepository.findById(mockFile.id);

      expect(result).toEqual(mockFile);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT id, user_id'), [
        mockFile.id,
      ]);
    });

    it('should return null when file not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await fileRepository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all files without criteria', async () => {
      mockDb.query.mockResolvedValue([mockFile]);

      const result = await fileRepository.findAll();

      expect(result).toEqual([mockFile]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY uploaded_at DESC'),
        []
      );
    });

    it('should find files by userId', async () => {
      mockDb.query.mockResolvedValue([mockFile]);

      const result = await fileRepository.findAll({ userId: 'user-123' });

      expect(result).toEqual([mockFile]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), ['user-123']);
    });

    it('should find files by mimeType', async () => {
      mockDb.query.mockResolvedValue([mockFile]);

      const result = await fileRepository.findAll({ mimeType: 'application/pdf' });

      expect(result).toEqual([mockFile]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), [
        'application/pdf',
      ]);
    });

    it('should find files by multiple criteria', async () => {
      mockDb.query.mockResolvedValue([mockFile]);

      const result = await fileRepository.findAll({
        userId: 'user-123',
        s3Bucket: 'test-bucket',
      });

      expect(result).toEqual([mockFile]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), [
        'user-123',
        'test-bucket',
      ]);
    });
  });

  describe('create', () => {
    it('should create a new file record', async () => {
      const newFile = {
        userId: 'user-456',
        fileName: 'new-file.jpg',
        fileSize: 2048000,
        mimeType: 'image/jpeg',
        s3Key: 'uploads/user-456/new-file.jpg',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
        metadata: { width: 1920, height: 1080 },
      };

      mockDb.queryOne.mockResolvedValue({ ...mockFile, ...newFile });

      const result = await fileRepository.create(newFile);

      expect(result.fileName).toBe(newFile.fileName);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO files'), [
        newFile.userId,
        newFile.fileName,
        newFile.fileSize,
        newFile.mimeType,
        newFile.s3Key,
        newFile.s3Bucket,
        JSON.stringify(newFile.metadata),
      ]);
    });

    it('should create file with null metadata', async () => {
      const newFile = {
        userId: 'user-456',
        fileName: 'new-file.jpg',
        fileSize: 2048000,
        mimeType: 'image/jpeg',
        s3Key: 'uploads/user-456/new-file.jpg',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date(),
      };

      mockDb.queryOne.mockResolvedValue({ ...mockFile, ...newFile });

      const result = await fileRepository.create(newFile);

      expect(result).toBeDefined();
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO files'),
        expect.arrayContaining([null])
      );
    });

    it('should throw error when creation fails', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        fileRepository.create({
          userId: 'user-123',
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          s3Key: 'test-key',
          s3Bucket: 'test-bucket',
          uploadedAt: new Date(),
        })
      ).rejects.toThrow('Failed to create file record');
    });
  });

  describe('update', () => {
    it('should update file name', async () => {
      const updatedFile = { ...mockFile, fileName: 'updated-file.pdf' };
      mockDb.queryOne.mockResolvedValue(updatedFile);

      const result = await fileRepository.update(mockFile.id, {
        fileName: 'updated-file.pdf',
      });

      expect(result.fileName).toBe('updated-file.pdf');
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('UPDATE files'), [
        'updated-file.pdf',
        mockFile.id,
      ]);
    });

    it('should update multiple fields', async () => {
      const updates = {
        fileName: 'updated-file.pdf',
        fileSize: 2048000,
        metadata: { updated: true },
      };
      mockDb.queryOne.mockResolvedValue({ ...mockFile, ...updates });

      const result = await fileRepository.update(mockFile.id, updates);

      expect(result.fileName).toBe(updates.fileName);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE files'),
        expect.arrayContaining([
          updates.fileName,
          updates.fileSize,
          JSON.stringify(updates.metadata),
          mockFile.id,
        ])
      );
    });

    it('should throw error when no fields to update', async () => {
      await expect(fileRepository.update(mockFile.id, {})).rejects.toThrow('No fields to update');
    });

    it('should throw error when file not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        fileRepository.update('non-existent-id', { fileName: 'test.pdf' })
      ).rejects.toThrow('File with id non-existent-id not found');
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      mockDb.query.mockResolvedValue([{ id: mockFile.id }]);

      const result = await fileRepository.delete(mockFile.id);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM files WHERE id = $1', [mockFile.id]);
    });

    it('should return false when file not found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await fileRepository.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockDb.queryOne.mockResolvedValue({ exists: 1 });

      const result = await fileRepository.exists(mockFile.id);

      expect(result).toBe(true);
      expect(mockDb.queryOne).toHaveBeenCalledWith('SELECT 1 FROM files WHERE id = $1', [
        mockFile.id,
      ]);
    });

    it('should return false when file does not exist', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await fileRepository.exists('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('findByUserId', () => {
    it('should find all files for a user', async () => {
      mockDb.query.mockResolvedValue([mockFile]);

      const result = await fileRepository.findByUserId('user-123');

      expect(result).toEqual([mockFile]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [
        'user-123',
      ]);
    });

    it('should return empty array when no files found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await fileRepository.findByUserId('user-999');

      expect(result).toEqual([]);
    });
  });

  describe('findByUserIdPaginated', () => {
    it('should return paginated files with total count', async () => {
      mockDb.queryOne.mockResolvedValue({ count: '10' });
      mockDb.query.mockResolvedValue([mockFile]);

      const result = await fileRepository.findByUserIdPaginated('user-123', 5, 0);

      expect(result.files).toEqual([mockFile]);
      expect(result.total).toBe(10);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'), [
        'user-123',
      ]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), [
        'user-123',
        5,
        0,
      ]);
    });

    it('should handle zero count', async () => {
      mockDb.queryOne.mockResolvedValue(null);
      mockDb.query.mockResolvedValue([]);

      const result = await fileRepository.findByUserIdPaginated('user-999', 5, 0);

      expect(result.files).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findByS3Key', () => {
    it('should find a file by S3 key', async () => {
      mockDb.queryOne.mockResolvedValue(mockFile);

      const result = await fileRepository.findByS3Key('uploads/user-123/test-file.pdf');

      expect(result).toEqual(mockFile);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE s3_key = $1'), [
        'uploads/user-123/test-file.pdf',
      ]);
    });

    it('should return null when file not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await fileRepository.findByS3Key('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('getTotalStorageByUser', () => {
    it('should return total storage used by user', async () => {
      mockDb.queryOne.mockResolvedValue({ total: '5242880' });

      const result = await fileRepository.getTotalStorageByUser('user-123');

      expect(result).toBe(5242880);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('SUM(file_size)'), [
        'user-123',
      ]);
    });

    it('should return 0 when user has no files', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await fileRepository.getTotalStorageByUser('user-999');

      expect(result).toBe(0);
    });

    it('should return 0 when total is null', async () => {
      mockDb.queryOne.mockResolvedValue({ total: '0' });

      const result = await fileRepository.getTotalStorageByUser('user-999');

      expect(result).toBe(0);
    });
  });

  describe('deleteByUserId', () => {
    it('should delete all files for a user', async () => {
      mockDb.query.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

      const result = await fileRepository.deleteByUserId('user-123');

      expect(result).toBe(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM files WHERE user_id = $1 RETURNING id',
        ['user-123']
      );
    });

    it('should return 0 when no files deleted', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await fileRepository.deleteByUserId('user-999');

      expect(result).toBe(0);
    });
  });
});
