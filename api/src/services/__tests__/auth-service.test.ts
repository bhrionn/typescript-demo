/**
 * Unit tests for Authentication Service
 * Requirements: 1.3
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock dependencies BEFORE imports
jest.mock('@aws-sdk/client-cognito-identity-provider');
jest.mock('jsonwebtoken');
jest.mock('jwks-rsa');

import { AuthService } from '../auth-service';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AuthenticationError } from '../../types/errors';

const MockCognitoClient = CognitoIdentityProviderClient as jest.MockedClass<
  typeof CognitoIdentityProviderClient
>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockJwksClient = jwksClient as jest.MockedFunction<typeof jwksClient>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockCognitoSend: jest.Mock;
  let mockGetSigningKey: jest.Mock;

  const TEST_USER_POOL_ID = 'us-east-1_TestPool123';
  const TEST_REGION = 'us-east-1';
  const TEST_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2lkIn0.test';

  beforeEach(() => {
    jest.clearAllMocks();

    mockCognitoSend = jest.fn();
    MockCognitoClient.mockImplementation(
      () =>
        ({
          send: mockCognitoSend,
        }) as any
    );

    mockGetSigningKey = jest.fn();
    mockJwksClient.mockReturnValue({
      getSigningKey: mockGetSigningKey,
    } as any);

    authService = new AuthService(TEST_USER_POOL_ID, TEST_REGION);
  });

  describe('Token validation', () => {
    it('should validate a valid token successfully', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@test.com',
        token_use: 'access',
      };

      mockJwt.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: mockPayload,
      } as any);

      mockGetSigningKey.mockImplementation((_kid: any, callback: any) => {
        callback(null, { getPublicKey: () => 'mock-public-key' });
      });

      mockJwt.verify.mockImplementation((_token: any, _key: any, _options: any, callback: any) => {
        callback(null, mockPayload);
      });

      const result = await authService.validateToken(TEST_TOKEN);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@test.com');
    });

    it('should reject empty token', async () => {
      const result = await authService.validateToken('');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token is required');
    });

    it('should reject token with invalid format', async () => {
      mockJwt.decode.mockReturnValue(null);

      const result = await authService.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid token format');
    });

    it('should handle signing key retrieval failure', async () => {
      mockJwt.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: {},
      } as any);

      mockGetSigningKey.mockImplementation((_kid: any, callback: any) => {
        callback(new Error('Key not found'), null);
      });

      const result = await authService.validateToken(TEST_TOKEN);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Failed to get signing key');
    });

    it('should reject token with invalid signature', async () => {
      mockJwt.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: {},
      } as any);

      mockGetSigningKey.mockImplementation((_kid: any, callback: any) => {
        callback(null, { getPublicKey: () => 'mock-public-key' });
      });

      mockJwt.verify.mockImplementation((_token: any, _key: any, _options: any, callback: any) => {
        callback({ name: 'JsonWebTokenError', message: 'Invalid signature' } as any, null);
      });

      const result = await authService.validateToken(TEST_TOKEN);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Token verification failed');
    });

    it('should reject token with invalid token_use claim', async () => {
      mockJwt.decode.mockReturnValue({
        header: { kid: 'test-kid' },
        payload: {},
      } as any);

      mockGetSigningKey.mockImplementation((_kid: any, callback: any) => {
        callback(null, { getPublicKey: () => 'mock-public-key' });
      });

      mockJwt.verify.mockImplementation((_token: any, _key: any, _options: any, callback: any) => {
        callback(null, {
          sub: 'user-123',
          token_use: 'invalid',
        });
      });

      const result = await authService.validateToken(TEST_TOKEN);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid token use');
    });
  });

  describe('Token refresh', () => {
    it('should throw error for empty refresh token', async () => {
      await expect(authService.refreshToken('')).rejects.toThrow(AuthenticationError);
    });

    it('should throw error indicating implementation needed', async () => {
      await expect(authService.refreshToken('valid-refresh-token')).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe('getUserInfo', () => {
    it('should retrieve user information successfully', async () => {
      const mockUserData = {
        Username: 'test-user',
        UserAttributes: [
          { Name: 'email', Value: 'test@example.com' },
          { Name: 'sub', Value: 'user-123' },
        ],
      };

      mockCognitoSend.mockResolvedValue(mockUserData);

      const result = await authService.getUserInfo('access-token');

      expect(result.username).toBe('test-user');
      expect(result.attributes.email).toBe('test@example.com');
      expect(mockCognitoSend).toHaveBeenCalledWith(expect.any(GetUserCommand));
    });

    it('should handle Cognito API errors', async () => {
      mockCognitoSend.mockRejectedValue(new Error('Token expired'));

      await expect(authService.getUserInfo('invalid-token')).rejects.toThrow(AuthenticationError);
    });
  });
});
