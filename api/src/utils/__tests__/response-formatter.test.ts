/**
 * Unit tests for Response Formatter Utilities
 * Requirements: 3.7
 */

import {
  formatSuccessResponse,
  formatCreatedResponse,
  formatNoContentResponse,
  formatErrorResponse,
  formatValidationErrorResponse,
  formatUnauthorizedResponse,
  formatForbiddenResponse,
  formatNotFoundResponse,
  formatPaginatedResponse,
  formatRedirectResponse,
  withCacheHeaders,
  withNoCacheHeaders,
} from '../response-formatter';
import { AppError } from '../../types/errors';

describe('Response Formatter', () => {
  describe('formatSuccessResponse', () => {
    it('should format success response with data', () => {
      const data = { id: 1, name: 'test' };
      const response = formatSuccessResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data,
      });
    });

    it('should include security headers', () => {
      const response = formatSuccessResponse({});

      expect(response.headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(response.headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(response.headers).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(response.headers).toHaveProperty('Strict-Transport-Security');
    });

    it('should allow custom status code', () => {
      const response = formatSuccessResponse({}, { statusCode: 202 });

      expect(response.statusCode).toBe(202);
    });

    it('should allow custom headers', () => {
      const response = formatSuccessResponse(
        {},
        {
          headers: { 'X-Custom-Header': 'value' },
        }
      );

      expect(response.headers).toHaveProperty('X-Custom-Header', 'value');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should handle null and undefined data', () => {
      const response1 = formatSuccessResponse(null);
      const response2 = formatSuccessResponse(undefined);

      expect(JSON.parse(response1.body).data).toBeNull();
      expect(JSON.parse(response2.body).data).toBeUndefined();
    });
  });

  describe('formatCreatedResponse', () => {
    it('should format created response with 201 status', () => {
      const data = { id: 1, created: true };
      const response = formatCreatedResponse(data);

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data,
      });
    });
  });

  describe('formatNoContentResponse', () => {
    it('should format no content response with 204 status', () => {
      const response = formatNoContentResponse();

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(response.headers).toHaveProperty('Content-Type');
    });

    it('should allow custom headers', () => {
      const response = formatNoContentResponse({
        headers: { 'X-Custom': 'value' },
      });

      expect(response.headers).toHaveProperty('X-Custom', 'value');
    });
  });

  describe('formatErrorResponse', () => {
    it('should format AppError instances', () => {
      const appError = new AppError('VALIDATION_ERROR', 'Invalid input', 400, true);
      const response = formatErrorResponse(appError);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Invalid input');
    });

    it('should format Error instances', () => {
      const error = new Error('Something went wrong');
      const response = formatErrorResponse(error, 500);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ERROR');
      expect(body.message).toBe('Something went wrong');
    });

    it('should format string errors', () => {
      const response = formatErrorResponse('Custom error message', 400);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ERROR');
      expect(body.message).toBe('Custom error message');
    });

    it('should default to 500 status code', () => {
      const response = formatErrorResponse('Error');

      expect(response.statusCode).toBe(500);
    });

    it('should allow custom headers', () => {
      const response = formatErrorResponse('Error', 500, {
        headers: { 'X-Request-Id': '123' },
      });

      expect(response.headers).toHaveProperty('X-Request-Id', '123');
    });
  });

  describe('formatValidationErrorResponse', () => {
    it('should format validation error with details', () => {
      const errors = ['Field is required', 'Invalid email format'];
      const response = formatValidationErrorResponse('Validation failed', errors);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toBe('Validation failed');
      expect(body.details).toEqual(errors);
    });

    it('should work without error details', () => {
      const response = formatValidationErrorResponse('Validation failed');

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.details).toBeUndefined();
    });
  });

  describe('formatUnauthorizedResponse', () => {
    it('should format unauthorized response with default message', () => {
      const response = formatUnauthorizedResponse();

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('UNAUTHORIZED');
      expect(body.message).toBe('Authentication required');
    });

    it('should format unauthorized response with custom message', () => {
      const response = formatUnauthorizedResponse('Invalid token');

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid token');
    });
  });

  describe('formatForbiddenResponse', () => {
    it('should format forbidden response with default message', () => {
      const response = formatForbiddenResponse();

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('FORBIDDEN');
      expect(body.message).toBe('Access denied');
    });

    it('should format forbidden response with custom message', () => {
      const response = formatForbiddenResponse('Insufficient permissions');

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Insufficient permissions');
    });
  });

  describe('formatNotFoundResponse', () => {
    it('should format not found response with default resource', () => {
      const response = formatNotFoundResponse();

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Resource not found');
    });

    it('should format not found response with custom resource', () => {
      const response = formatNotFoundResponse('User');

      const body = JSON.parse(response.body);
      expect(body.message).toBe('User not found');
    });
  });

  describe('formatPaginatedResponse', () => {
    it('should format paginated response with metadata', () => {
      const items = [1, 2, 3];
      const response = formatPaginatedResponse(items, {
        page: 1,
        limit: 3,
        total: 10,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual(items);
      expect(body.data.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 10,
        totalPages: 4,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should calculate totalPages correctly', () => {
      const response = formatPaginatedResponse([], {
        page: 1,
        limit: 10,
        total: 25,
      });

      const body = JSON.parse(response.body);
      expect(body.data.pagination.totalPages).toBe(3);
    });

    it('should handle last page correctly', () => {
      const response = formatPaginatedResponse([], {
        page: 3,
        limit: 10,
        total: 25,
      });

      const body = JSON.parse(response.body);
      expect(body.data.pagination.hasNext).toBe(false);
      expect(body.data.pagination.hasPrev).toBe(true);
    });

    it('should use provided totalPages', () => {
      const response = formatPaginatedResponse([], {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      });

      const body = JSON.parse(response.body);
      expect(body.data.pagination.totalPages).toBe(10);
    });
  });

  describe('formatRedirectResponse', () => {
    it('should format redirect response with location header', () => {
      const response = formatRedirectResponse('https://example.com');

      expect(response.statusCode).toBe(302);
      expect(response.headers).toHaveProperty('Location', 'https://example.com');
      expect(response.body).toBe('');
    });

    it('should allow custom headers', () => {
      const response = formatRedirectResponse('https://example.com', {
        headers: { 'X-Custom': 'value' },
      });

      expect(response.headers).toHaveProperty('Location');
      expect(response.headers).toHaveProperty('X-Custom', 'value');
    });
  });

  describe('withCacheHeaders', () => {
    it('should add cache-control header to response', () => {
      const originalResponse = formatSuccessResponse({ data: 'test' });
      const response = withCacheHeaders(originalResponse, 3600);

      expect(response.headers).toHaveProperty('Cache-Control', 'public, max-age=3600');
      expect(response.statusCode).toBe(originalResponse.statusCode);
      expect(response.body).toBe(originalResponse.body);
    });

    it('should preserve existing headers', () => {
      const originalResponse = formatSuccessResponse(
        { data: 'test' },
        {
          headers: { 'X-Custom': 'value' },
        }
      );
      const response = withCacheHeaders(originalResponse, 1800);

      expect(response.headers).toHaveProperty('Cache-Control', 'public, max-age=1800');
      expect(response.headers).toHaveProperty('X-Custom', 'value');
    });
  });

  describe('withNoCacheHeaders', () => {
    it('should add no-cache headers to response', () => {
      const originalResponse = formatSuccessResponse({ data: 'test' });
      const response = withNoCacheHeaders(originalResponse);

      expect(response.headers).toHaveProperty(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      );
      expect(response.headers).toHaveProperty('Pragma', 'no-cache');
      expect(response.headers).toHaveProperty('Expires', '0');
    });

    it('should preserve existing headers', () => {
      const originalResponse = formatSuccessResponse(
        { data: 'test' },
        {
          headers: { 'X-Custom': 'value' },
        }
      );
      const response = withNoCacheHeaders(originalResponse);

      expect(response.headers).toHaveProperty('Cache-Control');
      expect(response.headers).toHaveProperty('X-Custom', 'value');
    });

    it('should override existing cache headers', () => {
      const originalResponse = {
        statusCode: 200,
        headers: { 'Cache-Control': 'public, max-age=3600' },
        body: '{}',
      };
      const response = withNoCacheHeaders(originalResponse);

      expect(response.headers?.['Cache-Control']).not.toBe('public, max-age=3600');
      expect(response.headers).toHaveProperty('Pragma', 'no-cache');
    });
  });
});
