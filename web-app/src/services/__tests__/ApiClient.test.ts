/**
 * ApiClient Unit Tests
 * Tests for API client implementation including interceptors and retry logic
 */

import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiClient, ApiError } from '../ApiClient';
import type { IAuthService } from '../IAuthService';
import type { FileMetadata, UploadResponse, PresignedUrlResponse } from '../../types/api';

// Import after mocking
import axios from 'axios';

// Mock axios module
jest.mock('axios', () => {
  return {
    create: jest.fn(),
  };
});
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment
jest.mock('../../config/environment', () => ({
  environment: {
    apiUrl: 'https://api.example.com',
  },
}));

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockAuthService: jest.Mocked<IAuthService>;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock auth service
    mockAuthService = {
      login: jest.fn(),
      logout: jest.fn(),
      getToken: jest.fn(),
      isAuthenticated: jest.fn(),
      refreshToken: jest.fn(),
      getCurrentUser: jest.fn(),
      signUp: jest.fn(),
      signIn: jest.fn(),
      confirmSignUp: jest.fn(),
      resendConfirmationCode: jest.fn(),
    };

    // Create mock axios instance (it's also callable for retries)
    mockAxiosInstance = jest.fn();
    mockAxiosInstance.get = jest.fn();
    mockAxiosInstance.post = jest.fn();
    mockAxiosInstance.put = jest.fn();
    mockAxiosInstance.delete = jest.fn();
    mockAxiosInstance.interceptors = {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create API client instance
    apiClient = new ApiClient(mockAuthService);
  });

  describe('initialization', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should set up request interceptor', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should set up response interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('request interceptor', () => {
    let requestInterceptor: any;

    beforeEach(() => {
      // Get the request interceptor function
      const requestInterceptorCall = mockAxiosInstance.interceptors.request.use.mock.calls[0];
      requestInterceptor = requestInterceptorCall[0];
    });

    it('should attach token to Authorization header when token is available', async () => {
      const mockToken = 'mock-jwt-token';
      mockAuthService.getToken.mockResolvedValueOnce(mockToken);

      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(mockAuthService.getToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should proceed without token when token is not available', async () => {
      mockAuthService.getToken.mockResolvedValueOnce(null);

      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(mockAuthService.getToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should proceed without token when getToken throws error', async () => {
      mockAuthService.getToken.mockRejectedValueOnce(new Error('Token retrieval failed'));

      const config: InternalAxiosRequestConfig = {
        headers: {} as any,
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(result).toBe(config);
      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should handle config without headers', async () => {
      mockAuthService.getToken.mockResolvedValueOnce('mock-token');

      const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(result).toBe(config);
    });
  });

  describe('response interceptor', () => {
    let responseSuccessHandler: any;
    let responseErrorHandler: any;

    beforeEach(() => {
      // Get the response interceptor functions
      const responseInterceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[0];
      responseSuccessHandler = responseInterceptorCall[0];
      responseErrorHandler = responseInterceptorCall[1];
    });

    it('should return successful response unchanged', () => {
      const mockResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      const result = responseSuccessHandler(mockResponse);

      expect(result).toBe(mockResponse);
    });

    describe('401 Unauthorized handling', () => {
      it('should refresh token and retry request on 401 error', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          response: {
            status: 401,
            data: {},
            statusText: 'Unauthorized',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Unauthorized',
        };

        const mockNewToken = 'new-refreshed-token';
        mockAuthService.refreshToken.mockResolvedValueOnce(mockNewToken);
        (mockAxiosInstance as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        await responseErrorHandler(mockError);

        expect(mockAuthService.refreshToken).toHaveBeenCalled();
        expect(mockAxiosInstance).toHaveBeenCalledWith(
          expect.objectContaining({
            _retry: 1,
          })
        );
      });

      it('should throw ApiError when token refresh fails', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          response: {
            status: 401,
            data: {},
            statusText: 'Unauthorized',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Unauthorized',
        };

        mockAuthService.refreshToken.mockRejectedValueOnce(new Error('Refresh failed'));

        const error = await responseErrorHandler(mockError).catch((e: any) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('AUTH_ERROR');
        expect(error.message).toBe('Authentication failed. Please log in again.');
      });

      it('should not retry 401 if already retried', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
            _retry: 1,
          } as InternalAxiosRequestConfig & { _retry?: number },
          response: {
            status: 401,
            data: {},
            statusText: 'Unauthorized',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Unauthorized',
        };

        await expect(responseErrorHandler(mockError)).rejects.toThrow(ApiError);
        expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      });
    });

    describe('retry logic for network and 5xx errors', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should retry on network error', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          request: {},
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Network Error',
        };

        (mockAxiosInstance as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        const errorPromise = responseErrorHandler(mockError);

        // Fast-forward timers to trigger retry
        jest.advanceTimersByTime(1000);

        await errorPromise;

        expect(mockAxiosInstance).toHaveBeenCalledWith(
          expect.objectContaining({
            _retry: 1,
          })
        );
      });

      it('should retry on 500 server error', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          response: {
            status: 500,
            data: {},
            statusText: 'Internal Server Error',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Server Error',
        };

        (mockAxiosInstance as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        const errorPromise = responseErrorHandler(mockError);

        jest.advanceTimersByTime(1000);

        await errorPromise;

        expect(mockAxiosInstance).toHaveBeenCalledWith(
          expect.objectContaining({
            _retry: 1,
          })
        );
      });

      it('should retry on 503 service unavailable', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          response: {
            status: 503,
            data: {},
            statusText: 'Service Unavailable',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Service Unavailable',
        };

        (mockAxiosInstance as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        const errorPromise = responseErrorHandler(mockError);

        jest.advanceTimersByTime(1000);

        await errorPromise;

        expect(mockAxiosInstance).toHaveBeenCalled();
      });

      it('should not retry on 501 Not Implemented', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          response: {
            status: 501,
            data: { error: 'NOT_IMPLEMENTED', message: 'Not Implemented' },
            statusText: 'Not Implemented',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Not Implemented',
        };

        const callCountBefore = (mockAxiosInstance as jest.Mock).mock.calls.length;
        await expect(responseErrorHandler(mockError)).rejects.toThrow(ApiError);
        const callCountAfter = (mockAxiosInstance as jest.Mock).mock.calls.length;
        expect(callCountAfter).toBe(callCountBefore);
      });

      it('should use exponential backoff for retries', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
            _retry: 1,
          } as InternalAxiosRequestConfig & { _retry?: number },
          response: {
            status: 500,
            data: {},
            statusText: 'Internal Server Error',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Server Error',
        };

        (mockAxiosInstance as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

        const errorPromise = responseErrorHandler(mockError);

        // Second retry should wait 2000ms (1000 * 2)
        jest.advanceTimersByTime(2000);

        await errorPromise;

        expect(mockAxiosInstance).toHaveBeenCalledWith(
          expect.objectContaining({
            _retry: 2,
          })
        );
      });

      it('should stop retrying after max retries', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
            _retry: 3,
          } as InternalAxiosRequestConfig & { _retry?: number },
          response: {
            status: 500,
            data: { error: 'SERVER_ERROR', message: 'Server Error' },
            statusText: 'Internal Server Error',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Server Error',
        };

        const callCountBefore = (mockAxiosInstance as jest.Mock).mock.calls.length;
        await expect(responseErrorHandler(mockError)).rejects.toThrow(ApiError);
        const callCountAfter = (mockAxiosInstance as jest.Mock).mock.calls.length;
        expect(callCountAfter).toBe(callCountBefore);
      });
    });

    describe('error transformation', () => {
      it('should transform server error to ApiError', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
          } as InternalAxiosRequestConfig,
          response: {
            status: 400,
            data: { error: 'VALIDATION_ERROR', message: 'Invalid input' },
            statusText: 'Bad Request',
            headers: {},
            config: {} as InternalAxiosRequestConfig,
          },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Bad Request',
        };

        await expect(responseErrorHandler(mockError)).rejects.toMatchObject({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        });
      });

      it('should handle network error without response', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
            _retry: 3,
          } as InternalAxiosRequestConfig & { _retry?: number },
          request: {},
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Network Error',
        };

        await expect(responseErrorHandler(mockError)).rejects.toMatchObject({
          statusCode: 0,
          code: 'NETWORK_ERROR',
          message: 'Network error. Please check your connection.',
        });
      });

      it('should handle request setup error', async () => {
        const mockError: AxiosError = {
          config: {
            headers: {} as any,
            _retry: 3, // Prevent retry attempts
          } as InternalAxiosRequestConfig & { _retry?: number },
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request setup failed',
        };

        await expect(responseErrorHandler(mockError)).rejects.toMatchObject({
          statusCode: 0,
          code: 'REQUEST_ERROR',
          message: 'Request setup failed',
        });
      });
    });
  });

  describe('HTTP methods', () => {
    it('should make GET request and return data', async () => {
      const mockData = { id: '123', name: 'Test' };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

      const result = await apiClient.get('/test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual(mockData);
    });

    it('should make POST request and return data', async () => {
      const mockData = { success: true };
      const postData = { name: 'Test' };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockData });

      const result = await apiClient.post('/test', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', postData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make PUT request and return data', async () => {
      const mockData = { updated: true };
      const putData = { name: 'Updated' };
      mockAxiosInstance.put.mockResolvedValueOnce({ data: mockData });

      const result = await apiClient.put('/test/123', putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test/123', putData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make DELETE request and return data', async () => {
      const mockData = { deleted: true };
      mockAxiosInstance.delete.mockResolvedValueOnce({ data: mockData });

      const result = await apiClient.delete('/test/123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test/123', undefined);
      expect(result).toEqual(mockData);
    });
  });

  describe('file operations', () => {
    it('should upload file with progress tracking', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const mockResponse: UploadResponse = {
        fileId: 'file-123',
        message: 'File uploaded successfully',
      };

      let capturedConfig: any;
      mockAxiosInstance.post.mockImplementation((_url: string, _data: any, config: any) => {
        capturedConfig = config;
        return Promise.resolve({ data: mockResponse });
      });

      const progressCallback = jest.fn();
      const result = await apiClient.uploadFile(mockFile, progressCallback);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/files/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );

      // Simulate progress event
      if (capturedConfig?.onUploadProgress) {
        capturedConfig.onUploadProgress({ loaded: 50, total: 100 });
        expect(progressCallback).toHaveBeenCalledWith(50);
      }

      expect(result).toEqual(mockResponse);
    });

    it('should upload file without progress tracking', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const mockResponse: UploadResponse = {
        fileId: 'file-123',
        message: 'File uploaded successfully',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await apiClient.uploadFile(mockFile);

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should get user files', async () => {
      const mockFiles: FileMetadata[] = [
        {
          id: 'file-1',
          userId: 'user-123',
          fileName: 'test1.txt',
          fileSize: 100,
          mimeType: 'text/plain',
          s3Key: 'uploads/file-1',
          s3Bucket: 'test-bucket',
          uploadedAt: new Date().toISOString(),
        },
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockFiles });

      const result = await apiClient.getUserFiles();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/files', undefined);
      expect(result).toEqual(mockFiles);
    });

    it('should get file metadata', async () => {
      const mockMetadata: FileMetadata = {
        id: 'file-123',
        userId: 'user-123',
        fileName: 'test.txt',
        fileSize: 100,
        mimeType: 'text/plain',
        s3Key: 'uploads/file-123',
        s3Bucket: 'test-bucket',
        uploadedAt: new Date().toISOString(),
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockMetadata });

      const result = await apiClient.getFileMetadata('file-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/files/file-123', undefined);
      expect(result).toEqual(mockMetadata);
    });

    it('should get presigned URL', async () => {
      const mockResponse: PresignedUrlResponse = {
        url: 'https://s3.amazonaws.com/bucket/file?signature=xyz',
        expiresIn: 3600,
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await apiClient.getPresignedUrl('file-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/files/file-123/presigned-url',
        undefined,
        undefined
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
