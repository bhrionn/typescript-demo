/**
 * Unit tests for ErrorLoggingService
 * Following SOLID principles: Single Responsibility, Dependency Inversion
 */

import { ErrorLoggingService } from '../ErrorLoggingService';
import type { IApiClient } from '../IApiClient';
import { AppError } from '../../utils/errors';

// Mock navigator and window
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
};

const mockLocation = {
  href: 'https://example.com/test-page',
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: { location: mockLocation },
  writable: true,
});

describe('ErrorLoggingService', () => {
  let mockApiClient: jest.Mocked<IApiClient>;
  let errorLoggingService: ErrorLoggingService;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockApiClient = {
      post: jest.fn().mockResolvedValue({ data: {} }),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      setAuthToken: jest.fn(),
      clearAuthToken: jest.fn(),
    } as jest.Mocked<IApiClient>;

    errorLoggingService = new ErrorLoggingService(mockApiClient);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('logError', () => {
    it('should log AppError to API endpoint', async () => {
      const appError = new AppError('VALIDATION_ERROR', 'Invalid input', 400);
      await errorLoggingService.logError(appError);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          statusCode: 400,
        })
      );
    });

    it('should convert Error to AppError and log', async () => {
      const error = new Error('Something went wrong');
      await errorLoggingService.logError(error);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          message: 'Something went wrong',
        })
      );
    });

    it('should include additional context', async () => {
      const appError = new AppError('ERROR', 'Test error', 500);
      const context = { userId: '123', action: 'upload' };

      await errorLoggingService.logError(appError, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          context: expect.objectContaining(context),
        })
      );
    });

    it('should include user context if set', async () => {
      errorLoggingService.setUserContext('user-123', 'user@example.com');

      const error = new AppError('ERROR', 'Test', 500);
      await errorLoggingService.logError(error);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        })
      );
    });

    it('should include environment information', async () => {
      const error = new AppError('ERROR', 'Test', 500, true);
      await errorLoggingService.logError(error);

      const callArgs = mockApiClient.post.mock.calls[0][1];
      expect(callArgs.environment).toBeDefined();
      expect(callArgs.environment.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(callArgs.environment.url).toBe('https://example.com/test-page');
      expect(callArgs.environment.timestamp).toBeDefined();
    });

    it('should not throw if API call fails', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      const error = new AppError('ERROR', 'Test', 500);
      await errorLoggingService.logError(error);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log to console if API fails', async () => {
      const apiError = new Error('Network error');
      mockApiClient.post.mockRejectedValue(apiError);

      const error = new AppError('ERROR', 'Test', 500, true);
      await errorLoggingService.logError(error);

      // The error is caught in logEntry, not logError
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send error log:', apiError);
    });

    it('should sanitize stack trace in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      error.stack = Array(20).fill('at Test (file.ts:1:1)').join('\n');

      await errorLoggingService.logError(error);

      const logEntry = mockApiClient.post.mock.calls[0][1];
      const stackLines = logEntry.stack?.split('\n').length || 0;
      expect(stackLines).toBeLessThanOrEqual(10);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('logEntry', () => {
    it('should send custom error entry to API', async () => {
      const entry = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        statusCode: 500,
        context: { custom: 'data' },
      };

      await errorLoggingService.logEntry(entry);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/logs/errors', entry);
    });

    it('should not throw if API call fails', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      const entry = {
        code: 'ERROR',
        message: 'Test',
        statusCode: 500,
      };

      await errorLoggingService.logEntry(entry);
      // Should complete without throwing
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log to console on failure', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      const entry = {
        code: 'ERROR',
        message: 'Test',
        statusCode: 500,
      };

      await errorLoggingService.logEntry(entry);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send error log:', expect.any(Error));
    });
  });

  describe('setUserContext', () => {
    it('should set user context with id and email', () => {
      errorLoggingService.setUserContext('user-123', 'user@example.com');

      const error = new AppError('ERROR', 'Test', 500);
      errorLoggingService.logError(error);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        })
      );
    });

    it('should handle partial user context', () => {
      errorLoggingService.setUserContext('user-123');

      const error = new AppError('ERROR', 'Test', 500);
      errorLoggingService.logError(error);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          user: {
            id: 'user-123',
            email: undefined,
          },
        })
      );
    });

    it('should update user context when called multiple times', () => {
      errorLoggingService.setUserContext('user-1', 'user1@example.com');
      errorLoggingService.setUserContext('user-2', 'user2@example.com');

      const error = new AppError('ERROR', 'Test', 500);
      errorLoggingService.logError(error);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          user: {
            id: 'user-2',
            email: 'user2@example.com',
          },
        })
      );
    });
  });

  describe('clearUserContext', () => {
    it('should clear user context', () => {
      errorLoggingService.setUserContext('user-123', 'user@example.com');
      errorLoggingService.clearUserContext();

      const error = new AppError('ERROR', 'Test', 500);
      errorLoggingService.logError(error);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/logs/errors',
        expect.objectContaining({
          user: undefined,
        })
      );
    });

    it('should work even if no user context was set', async () => {
      errorLoggingService.clearUserContext();

      const error = new AppError('ERROR', 'Test', 500);
      await errorLoggingService.logError(error);
      // Should complete without throwing
      expect(mockApiClient.post).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should handle complete error logging flow', async () => {
      errorLoggingService.setUserContext('user-123', 'user@example.com');

      const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400, true, {
        field: 'email',
      });

      await errorLoggingService.logError(error, { additionalInfo: 'test' });

      const callArgs = mockApiClient.post.mock.calls[0][1];
      expect(callArgs.code).toBe('VALIDATION_ERROR');
      expect(callArgs.message).toBe('Invalid input');
      expect(callArgs.statusCode).toBe(400);
      expect(callArgs.stack).toBeDefined();
      expect(callArgs.context).toMatchObject({
        field: 'email',
        additionalInfo: 'test',
        isOperational: true,
      });
      expect(callArgs.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
      });
      expect(callArgs.environment.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(callArgs.environment.url).toBe('https://example.com/test-page');
      expect(callArgs.environment.timestamp).toBeDefined();
    });

    it('should handle errors without stack traces', async () => {
      const error = new AppError('ERROR', 'Test', 500, true);
      delete error.stack;

      await errorLoggingService.logError(error);

      const callArgs = mockApiClient.post.mock.calls[0][1];
      expect(callArgs.stack).toBeUndefined();
    });
  });
});
