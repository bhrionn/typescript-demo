/**
 * Unit tests for Authentication Middleware
 * Requirements: 1.3
 */

// Mock dependencies BEFORE imports
jest.mock('../../services/auth-service');

import { withAuth, withOptionalAuth, requireUser, AuthenticatedEvent } from '../auth-middleware';
import { APIGatewayEvent } from '../../types/api';
import { IAuthService } from '../../services/auth-service';
import { AuthenticationError } from '../../types/errors';

describe('Authentication Middleware', () => {
  let mockAuthService: jest.Mocked<IAuthService>;
  let mockHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService = {
      validateToken: jest.fn(),
      refreshToken: jest.fn(),
      verifyAndDecode: jest.fn(),
    } as jest.Mocked<IAuthService>;

    mockHandler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  const createMockEvent = (overrides: Partial<APIGatewayEvent> = {}): APIGatewayEvent => ({
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
    ...overrides,
  });

  describe('withAuth middleware', () => {
    it('should authenticate valid token and call handler', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
        email: 'test@example.com',
      });

      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await wrappedHandler(event);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('Bearer valid-token');
      expect(mockHandler).toHaveBeenCalled();

      const handlerEvent = mockHandler.mock.calls[0][0] as AuthenticatedEvent;
      expect(handlerEvent.user).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 401 when no token provided and auth required', async () => {
      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent();

      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.error).toBe('AUTHENTICATION_REQUIRED');
      expect(body.message).toContain('Authorization header is required');
    });

    it('should return 401 when token validation fails', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: false,
        error: 'Token expired',
      });

      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer expired-token',
        },
      });

      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_TOKEN');
      expect(body.message).toBe('Token expired');
    });

    it('should handle lowercase authorization header', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        userId: 'user-456',
      });

      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent({
        headers: {
          authorization: 'Bearer lowercase-token',
        },
      });

      const response = await wrappedHandler(event);

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('Bearer lowercase-token');
      expect(mockHandler).toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
    });

    it('should handle AuthenticationError from service', async () => {
      mockAuthService.validateToken.mockRejectedValue(new AuthenticationError('Service error'));

      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer error-token',
        },
      });

      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.error).toBe('AUTHENTICATION_ERROR');
      expect(body.message).toBe('Service error');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockAuthService.validateToken.mockRejectedValue(new Error('Unexpected error'));

      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer error-token',
        },
      });

      const response = await wrappedHandler(event);

      expect(response.statusCode).toBe(500);
      expect(mockHandler).not.toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.error).toBe('INTERNAL_ERROR');
      expect(body.message).toContain('unexpected error');
    });

    it('should include CORS headers in responses', async () => {
      const wrappedHandler = withAuth(mockHandler, { authService: mockAuthService });
      const event = createMockEvent();

      const response = await wrappedHandler(event);

      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
    });
  });

  describe('withOptionalAuth middleware', () => {
    it('should allow requests without authentication', async () => {
      const wrappedHandler = withOptionalAuth(mockHandler);
      const event = createMockEvent();

      await wrappedHandler(event);

      expect(mockHandler).toHaveBeenCalled();

      const handlerEvent = mockHandler.mock.calls[0][0] as AuthenticatedEvent;
      expect(handlerEvent.user).toBeUndefined();
    });

    it('should validate token if present', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        userId: 'optional-user',
        email: 'optional@test.com',
      });

      const wrappedHandler = withAuth(mockHandler, {
        authService: mockAuthService,
        required: false,
      });

      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer optional-token',
        },
      });

      await wrappedHandler(event);

      expect(mockAuthService.validateToken).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();

      const handlerEvent = mockHandler.mock.calls[0][0] as AuthenticatedEvent;
      expect(handlerEvent.user).toEqual({
        userId: 'optional-user',
        email: 'optional@test.com',
      });
    });
  });

  describe('requireUser middleware', () => {
    it('should allow access when user matches resource owner', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        userId: 'user-owner',
      });

      const getUserId = (event: APIGatewayEvent) => event.pathParameters?.userId;
      const wrappedHandler = requireUser(mockHandler, getUserId);

      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer valid-token',
        },
        pathParameters: {
          userId: 'user-owner',
        },
      });

      const response = await wrappedHandler(event);

      expect(mockHandler).toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
    });

    it('should deny access when user does not match resource owner', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
      });

      const getUserId = (event: APIGatewayEvent) => event.pathParameters?.userId;
      const wrappedHandler = requireUser(mockHandler, getUserId);

      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer valid-token',
        },
        pathParameters: {
          userId: 'user-456',
        },
      });

      const response = await wrappedHandler(event);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('FORBIDDEN');
      expect(body.message).toContain('permission');
    });

    it('should return 400 when user ID is missing', async () => {
      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        userId: 'user-123',
      });

      const getUserId = (event: APIGatewayEvent) => event.pathParameters?.userId;
      const wrappedHandler = requireUser(mockHandler, getUserId);

      const event = createMockEvent({
        headers: {
          Authorization: 'Bearer valid-token',
        },
        pathParameters: null,
      });

      const response = await wrappedHandler(event);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
      expect(body.message).toContain('User ID is required');
    });
  });
});
