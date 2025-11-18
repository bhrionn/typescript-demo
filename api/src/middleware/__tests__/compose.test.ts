/**
 * Unit tests for Middleware Composition Utilities
 * Requirements: 3.7, 8.16
 */

import { compose, createHandler, createAuthenticatedHandler, Middleware } from '../compose';
import { APIGatewayEvent } from '../../types/api';

// Mock middleware dependencies
jest.mock('../error-handler');
jest.mock('../logging');
jest.mock('../cors');
jest.mock('../auth-middleware');

import { withErrorHandler } from '../error-handler';
import { withLogging } from '../logging';
import { withCors } from '../cors';
import { withAuth } from '../auth-middleware';

describe('Middleware Composition', () => {
  let mockHandler: jest.Mock;
  let mockEvent: APIGatewayEvent;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHandler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });

    mockEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/test',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
    };
  });

  describe('compose', () => {
    it('should compose multiple middleware functions', async () => {
      // Create simple middleware that add headers
      const middleware1: Middleware = (handler) => async (event) => {
        const response = await handler(event);
        return {
          ...response,
          headers: { ...response.headers, 'X-Middleware-1': 'applied' },
        };
      };

      const middleware2: Middleware = (handler) => async (event) => {
        const response = await handler(event);
        return {
          ...response,
          headers: { ...response.headers, 'X-Middleware-2': 'applied' },
        };
      };

      const composedHandler = compose(middleware1, middleware2)(mockHandler);
      const response = await composedHandler(mockEvent);

      expect(response.headers).toHaveProperty('X-Middleware-1', 'applied');
      expect(response.headers).toHaveProperty('X-Middleware-2', 'applied');
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should apply middleware from right to left', async () => {
      const executionOrder: string[] = [];

      const middleware1: Middleware = (handler) => async (event) => {
        executionOrder.push('middleware1-before');
        const response = await handler(event);
        executionOrder.push('middleware1-after');
        return response;
      };

      const middleware2: Middleware = (handler) => async (event) => {
        executionOrder.push('middleware2-before');
        const response = await handler(event);
        executionOrder.push('middleware2-after');
        return response;
      };

      mockHandler.mockImplementation(async () => {
        executionOrder.push('handler');
        return { statusCode: 200, body: '{}' };
      });

      const composedHandler = compose(middleware1, middleware2)(mockHandler);
      await composedHandler(mockEvent);

      // Should execute: middleware1-before (outermost), middleware2-before, handler, middleware2-after, middleware1-after
      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should work with single middleware', async () => {
      const middleware: Middleware = (handler) => async (event) => {
        const response = await handler(event);
        return { ...response, statusCode: 201 };
      };

      const composedHandler = compose(middleware)(mockHandler);
      const response = await composedHandler(mockEvent);

      expect(response.statusCode).toBe(201);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should work with no middleware', async () => {
      const composedHandler = compose()(mockHandler);
      const response = await composedHandler(mockEvent);

      expect(response.statusCode).toBe(200);
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle middleware that throws errors', async () => {
      const errorMiddleware: Middleware = () => async () => {
        throw new Error('Middleware error');
      };

      const composedHandler = compose(errorMiddleware)(mockHandler);

      await expect(composedHandler(mockEvent)).rejects.toThrow('Middleware error');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('createHandler', () => {
    beforeEach(() => {
      // Mock middleware to pass through
      (withErrorHandler as jest.Mock).mockImplementation((handler: any) => handler);
      (withLogging as jest.Mock).mockImplementation((handler: any) => handler);
      (withCors as jest.Mock).mockImplementation((handler: any) => handler);
      (withAuth as jest.Mock).mockImplementation((handler: any) => handler);
    });

    it('should create handler with default middleware', async () => {
      const handler = createHandler(mockHandler);
      await handler(mockEvent);

      expect(withErrorHandler).toHaveBeenCalled();
      expect(withLogging).toHaveBeenCalled();
      expect(withCors).toHaveBeenCalled();
      expect(withAuth).not.toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
    });

    it('should create handler with auth middleware when enabled', async () => {
      const handler = createHandler(mockHandler, { withAuth: true });
      await handler(mockEvent);

      expect(withAuth).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should create handler without logging when disabled', async () => {
      const handler = createHandler(mockHandler, { withLogging: false });
      await handler(mockEvent);

      expect(withLogging).not.toHaveBeenCalled();
      expect(withErrorHandler).toHaveBeenCalled();
      expect(withCors).toHaveBeenCalled();
    });

    it('should create handler without CORS when disabled', async () => {
      const handler = createHandler(mockHandler, { withCors: false });
      await handler(mockEvent);

      expect(withCors).not.toHaveBeenCalled();
      expect(withErrorHandler).toHaveBeenCalled();
      expect(withLogging).toHaveBeenCalled();
    });

    it('should create handler without error handler when disabled', async () => {
      const handler = createHandler(mockHandler, { withErrorHandler: false });
      await handler(mockEvent);

      expect(withErrorHandler).not.toHaveBeenCalled();
      expect(withLogging).toHaveBeenCalled();
      expect(withCors).toHaveBeenCalled();
    });

    it('should create handler with all middleware disabled', async () => {
      const handler = createHandler(mockHandler, {
        withAuth: false,
        withLogging: false,
        withCors: false,
        withErrorHandler: false,
      });
      await handler(mockEvent);

      expect(withAuth).not.toHaveBeenCalled();
      expect(withLogging).not.toHaveBeenCalled();
      expect(withCors).not.toHaveBeenCalled();
      expect(withErrorHandler).not.toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should create handler with all middleware enabled', async () => {
      const handler = createHandler(mockHandler, {
        withAuth: true,
        withLogging: true,
        withCors: true,
        withErrorHandler: true,
      });
      await handler(mockEvent);

      expect(withAuth).toHaveBeenCalled();
      expect(withLogging).toHaveBeenCalled();
      expect(withCors).toHaveBeenCalled();
      expect(withErrorHandler).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('createAuthenticatedHandler', () => {
    beforeEach(() => {
      (withErrorHandler as jest.Mock).mockImplementation((handler: any) => handler);
      (withLogging as jest.Mock).mockImplementation((handler: any) => handler);
      (withCors as jest.Mock).mockImplementation((handler: any) => handler);
      (withAuth as jest.Mock).mockImplementation((handler: any) => handler);
    });

    it('should create handler with auth middleware enabled', async () => {
      const handler = createAuthenticatedHandler(mockHandler);
      await handler(mockEvent);

      expect(withAuth).toHaveBeenCalled();
      expect(withErrorHandler).toHaveBeenCalled();
      expect(withLogging).toHaveBeenCalled();
      expect(withCors).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should pass event to handler', async () => {
      const handler = createAuthenticatedHandler(mockHandler);
      const response = await handler(mockEvent);

      expect(mockHandler).toHaveBeenCalledWith(mockEvent);
      expect(response.statusCode).toBe(200);
    });
  });
});
