/**
 * FileUploadService Unit Tests
 * Tests for file validation, upload, and progress tracking
 */

import { FileUploadService, FileUploadError } from '../FileUploadService';
import type { IApiClient } from '../IApiClient';
import type { UploadResponse } from '../../types/api';
import type { ProgressObserver, UploadProgress } from '../IFileUploadService';

describe('FileUploadService', () => {
  let fileUploadService: FileUploadService;
  let mockApiClient: jest.Mocked<IApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock API client
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      uploadFile: jest.fn(),
      getUserFiles: jest.fn(),
      getFileMetadata: jest.fn(),
      getPresignedUrl: jest.fn(),
    };

    // Create service instance
    fileUploadService = new FileUploadService(mockApiClient);
  });

  describe('validateFile', () => {
    describe('valid files', () => {
      it('should validate a valid image file', () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate a valid PDF document', () => {
        const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate a valid Word document', () => {
        const file = new File(['content'], 'document.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate a file at maximum size (50MB)', () => {
        const maxSize = 50 * 1024 * 1024;
        const content = new Array(maxSize).fill('a').join('');
        const file = new File([content], 'large.jpg', { type: 'image/jpeg' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('invalid files', () => {
      it('should reject null file', () => {
        const result = fileUploadService.validateFile(null as any);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('No file provided');
      });

      it('should reject undefined file', () => {
        const result = fileUploadService.validateFile(undefined as any);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('No file provided');
      });

      it('should reject empty file', () => {
        const file = new File([], 'empty.txt', { type: 'text/plain' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File is empty');
      });

      it('should reject file exceeding maximum size', () => {
        const maxSize = 50 * 1024 * 1024;
        const content = new Array(maxSize + 1).fill('a').join('');
        const file = new File([content], 'toolarge.jpg', { type: 'image/jpeg' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File size exceeds maximum allowed size of 50MB');
      });

      it('should reject unsupported file type', () => {
        const file = new File(['content'], 'video.mp4', { type: 'video/mp4' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "File type 'video/mp4' is not supported. Supported types: images and documents"
        );
      });

      it('should reject file with empty name', () => {
        const file = new File(['content'], '', { type: 'image/jpeg' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File name is required');
      });

      it('should reject file with name exceeding 255 characters', () => {
        const longName = 'a'.repeat(256) + '.jpg';
        const file = new File(['content'], longName, { type: 'image/jpeg' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File name is too long (maximum 255 characters)');
      });

      it('should return multiple errors for multiple validation failures', () => {
        const file = new File([], '', { type: 'video/mp4' });

        const result = fileUploadService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors).toContain('File is empty');
        expect(result.errors).toContain('File name is required');
        expect(result.errors).toContain(
          "File type 'video/mp4' is not supported. Supported types: images and documents"
        );
      });
    });
  });

  describe('uploadFile', () => {
    describe('successful upload', () => {
      it('should upload a valid file', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const mockResponse: UploadResponse = {
          fileId: 'file-123',
          message: 'File uploaded successfully',
        };

        mockApiClient.uploadFile.mockResolvedValueOnce(mockResponse);

        const result = await fileUploadService.uploadFile(file);

        expect(mockApiClient.uploadFile).toHaveBeenCalledWith(file, undefined);
        expect(result).toEqual({
          fileId: 'file-123',
          message: 'File uploaded successfully',
        });
      });

      it('should upload file with metadata', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const metadata = { description: 'Test file' };
        const mockResponse: UploadResponse = {
          fileId: 'file-123',
          message: 'File uploaded successfully',
        };

        mockApiClient.uploadFile.mockResolvedValueOnce(mockResponse);

        const result = await fileUploadService.uploadFile(file, metadata);

        expect(mockApiClient.uploadFile).toHaveBeenCalledWith(file, undefined);
        expect(result).toEqual(mockResponse);
      });
    });

    describe('upload with progress tracking', () => {
      it('should track upload progress', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const mockResponse: UploadResponse = {
          fileId: 'file-123',
          message: 'File uploaded successfully',
        };

        const progressUpdates: UploadProgress[] = [];
        const observer: ProgressObserver = {
          next: (progress) => progressUpdates.push(progress),
          complete: jest.fn(),
        };

        let capturedProgressCallback: ((percentage: number) => void) | undefined;
        mockApiClient.uploadFile.mockImplementation(async (_file, onProgress) => {
          capturedProgressCallback = onProgress;
          return mockResponse;
        });

        const uploadPromise = fileUploadService.uploadFile(file, undefined, observer);

        // Simulate progress updates
        if (capturedProgressCallback) {
          capturedProgressCallback(25);
          capturedProgressCallback(50);
          capturedProgressCallback(75);
          capturedProgressCallback(100);
        }

        await uploadPromise;

        expect(progressUpdates).toHaveLength(4);
        expect(progressUpdates[0]).toEqual({
          loaded: expect.any(Number),
          total: file.size,
          percentage: 25,
        });
        expect(progressUpdates[3]).toEqual({
          loaded: expect.any(Number),
          total: file.size,
          percentage: 100,
        });
        expect(observer.complete).toHaveBeenCalled();
      });

      it('should call complete callback on successful upload', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const mockResponse: UploadResponse = {
          fileId: 'file-123',
          message: 'File uploaded successfully',
        };

        const observer: ProgressObserver = {
          next: jest.fn(),
          complete: jest.fn(),
        };

        mockApiClient.uploadFile.mockResolvedValueOnce(mockResponse);

        await fileUploadService.uploadFile(file, undefined, observer);

        expect(observer.complete).toHaveBeenCalled();
      });

      it('should work without progress observer', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const mockResponse: UploadResponse = {
          fileId: 'file-123',
          message: 'File uploaded successfully',
        };

        mockApiClient.uploadFile.mockResolvedValueOnce(mockResponse);

        const result = await fileUploadService.uploadFile(file);

        expect(result).toEqual(mockResponse);
        expect(mockApiClient.uploadFile).toHaveBeenCalledWith(file, undefined);
      });
    });

    describe('validation errors', () => {
      it('should throw FileUploadError for invalid file', async () => {
        const file = new File([], 'empty.txt', { type: 'text/plain' });

        await expect(fileUploadService.uploadFile(file)).rejects.toThrow(FileUploadError);
        await expect(fileUploadService.uploadFile(file)).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('File is empty'),
        });
      });

      it('should call observer error callback on validation failure', async () => {
        const file = new File([], 'empty.txt', { type: 'text/plain' });
        const observer: ProgressObserver = {
          next: jest.fn(),
          error: jest.fn(),
        };

        await expect(fileUploadService.uploadFile(file, undefined, observer)).rejects.toThrow();

        expect(observer.error).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'VALIDATION_ERROR',
          })
        );
      });

      it('should not call API client if validation fails', async () => {
        const file = new File([], 'empty.txt', { type: 'text/plain' });

        await expect(fileUploadService.uploadFile(file)).rejects.toThrow();

        expect(mockApiClient.uploadFile).not.toHaveBeenCalled();
      });
    });

    describe('upload errors', () => {
      it('should throw FileUploadError when API call fails', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const apiError = new Error('Network error');

        mockApiClient.uploadFile.mockRejectedValue(apiError);

        await expect(fileUploadService.uploadFile(file)).rejects.toThrow(FileUploadError);
        await expect(fileUploadService.uploadFile(file)).rejects.toMatchObject({
          code: 'UPLOAD_ERROR',
          message: 'Network error',
        });
      });

      it('should call observer error callback on upload failure', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        const apiError = new Error('Upload failed');
        const observer: ProgressObserver = {
          next: jest.fn(),
          error: jest.fn(),
        };

        mockApiClient.uploadFile.mockRejectedValueOnce(apiError);

        await expect(fileUploadService.uploadFile(file, undefined, observer)).rejects.toThrow();

        expect(observer.error).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'UPLOAD_ERROR',
            message: 'Upload failed',
          })
        );
      });

      it('should handle non-Error upload failures', async () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

        mockApiClient.uploadFile.mockRejectedValueOnce('Unknown error');

        await expect(fileUploadService.uploadFile(file)).rejects.toMatchObject({
          code: 'UPLOAD_ERROR',
          message: 'Failed to upload file',
        });
      });
    });
  });

  describe('getSupportedFileTypes', () => {
    it('should return array of supported MIME types', () => {
      const types = fileUploadService.getSupportedFileTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('image/jpeg');
      expect(types).toContain('application/pdf');
      expect(types).toContain('text/plain');
    });

    it('should return a copy of the array', () => {
      const types1 = fileUploadService.getSupportedFileTypes();
      const types2 = fileUploadService.getSupportedFileTypes();

      expect(types1).not.toBe(types2);
      expect(types1).toEqual(types2);
    });
  });

  describe('getMaxFileSize', () => {
    it('should return maximum file size in bytes', () => {
      const maxSize = fileUploadService.getMaxFileSize();

      expect(maxSize).toBe(50 * 1024 * 1024);
    });
  });

  describe('buildFormData', () => {
    it('should build FormData with file', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

      const formData = fileUploadService.buildFormData(file);

      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('file')).toBe(file);
    });

    it('should build FormData with file and metadata', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        description: 'Test file',
        category: 'images',
      };

      const formData = fileUploadService.buildFormData(file, metadata);

      expect(formData.get('file')).toBe(file);
      expect(formData.get('description')).toBe('Test file');
      expect(formData.get('category')).toBe('images');
    });

    it('should skip undefined metadata values', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        description: 'Test file',
        category: undefined,
      };

      const formData = fileUploadService.buildFormData(file, metadata);

      expect(formData.get('file')).toBe(file);
      expect(formData.get('description')).toBe('Test file');
      expect(formData.get('category')).toBeNull();
    });

    it('should skip null metadata values', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        description: 'Test file',
        category: null,
      };

      const formData = fileUploadService.buildFormData(file, metadata);

      expect(formData.get('file')).toBe(file);
      expect(formData.get('description')).toBe('Test file');
      expect(formData.get('category')).toBeNull();
    });

    it('should convert metadata values to strings', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        size: 12345,
        isPublic: true,
      };

      const formData = fileUploadService.buildFormData(file, metadata);

      expect(formData.get('size')).toBe('12345');
      expect(formData.get('isPublic')).toBe('true');
    });
  });

  describe('FileUploadError', () => {
    it('should create error with code and message', () => {
      const error = new FileUploadError('TEST_ERROR', 'Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FileUploadError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
    });

    it('should store original error', () => {
      const originalError = new Error('Original error');
      const error = new FileUploadError('TEST_ERROR', 'Test error message', originalError);

      expect(error.originalError).toBe(originalError);
    });
  });
});
