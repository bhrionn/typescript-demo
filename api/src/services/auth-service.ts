/**
 * Authentication Service
 * Handles JWT token validation and Cognito token verification
 * Following SOLID principles: Single Responsibility, Dependency Inversion
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AuthenticationError } from '../types/errors';
import { TokenValidationResult } from '../types/api';

/**
 * Interface for authentication service (Dependency Inversion Principle)
 */
export interface IAuthService {
  validateToken(token: string): Promise<TokenValidationResult>;
  refreshToken(refreshToken: string): Promise<string>;
  verifyAndDecode(token: string): Promise<JwtPayload>;
}

/**
 * Cognito JWT token payload interface
 */
interface CognitoTokenPayload extends JwtPayload {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  token_use: 'access' | 'id';
}

/**
 * Authentication service implementation using AWS Cognito
 */
export class AuthService implements IAuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private jwksClient: jwksClient.JwksClient;
  private userPoolId: string;
  private region: string;

  constructor(userPoolId?: string, region?: string, cognitoClient?: CognitoIdentityProviderClient) {
    this.userPoolId = userPoolId || process.env.COGNITO_USER_POOL_ID || '';
    this.region = region || process.env.AWS_REGION || 'us-east-1';

    if (!this.userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID is required');
    }

    this.cognitoClient =
      cognitoClient || new CognitoIdentityProviderClient({ region: this.region });

    // Initialize JWKS client for token verification
    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
    this.jwksClient = jwksClient({
      jwksUri: `${issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
    });
  }

  /**
   * Validate JWT token from Cognito
   * @param token - JWT token string
   * @returns TokenValidationResult with user information
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      if (!token) {
        return {
          isValid: false,
          error: 'Token is required',
        };
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');

      // Verify and decode the token
      const decoded = await this.verifyAndDecode(cleanToken);

      return {
        isValid: true,
        userId: decoded.sub,
        email: decoded.email,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token validation failed';
      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify JWT token signature and decode payload
   * @param token - JWT token string
   * @returns Decoded token payload
   */
  async verifyAndDecode(token: string): Promise<CognitoTokenPayload> {
    return new Promise((resolve, reject) => {
      // Decode token header to get kid (key id)
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || !decoded.header.kid) {
        reject(new AuthenticationError('Invalid token format'));
        return;
      }

      // Get signing key from JWKS
      this.jwksClient.getSigningKey(decoded.header.kid, (err, key) => {
        if (err) {
          reject(new AuthenticationError('Failed to get signing key', err.message));
          return;
        }

        const signingKey = key?.getPublicKey();
        if (!signingKey) {
          reject(new AuthenticationError('Signing key not found'));
          return;
        }

        // Verify token signature and claims
        const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;

        jwt.verify(
          token,
          signingKey,
          {
            issuer,
            algorithms: ['RS256'],
          },
          (verifyErr, payload) => {
            if (verifyErr) {
              reject(new AuthenticationError('Token verification failed', verifyErr.message));
              return;
            }

            if (!payload || typeof payload === 'string') {
              reject(new AuthenticationError('Invalid token payload'));
              return;
            }

            const cognitoPayload = payload as CognitoTokenPayload;

            // Validate token_use claim
            if (cognitoPayload.token_use !== 'access' && cognitoPayload.token_use !== 'id') {
              reject(new AuthenticationError('Invalid token use'));
              return;
            }

            resolve(cognitoPayload);
          }
        );
      });
    });
  }

  /**
   * Refresh access token using refresh token
   * Note: This requires additional Cognito API calls
   * @param refreshToken - Cognito refresh token
   * @returns New access token
   */
  async refreshToken(refreshToken: string): Promise<string> {
    try {
      if (!refreshToken) {
        throw new AuthenticationError('Refresh token is required');
      }

      // Note: In a production environment, you would use InitiateAuth with REFRESH_TOKEN_AUTH
      // This requires the Cognito App Client ID and potentially App Client Secret
      // For now, we'll throw an error indicating this needs to be implemented with proper credentials

      throw new AuthenticationError(
        'Token refresh requires Cognito App Client configuration. ' +
          'Implement using InitiateAuth with REFRESH_TOKEN_AUTH flow.'
      );
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        'Failed to refresh token',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get user information from Cognito using access token
   * @param accessToken - Cognito access token
   * @returns User information
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      return {
        username: response.Username,
        attributes: response.UserAttributes?.reduce(
          (acc, attr) => {
            if (attr.Name && attr.Value) {
              acc[attr.Name] = attr.Value;
            }
            return acc;
          },
          {} as Record<string, string>
        ),
      };
    } catch (error) {
      throw new AuthenticationError(
        'Failed to get user info',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

/**
 * Factory function to create AuthService instance
 */
export function createAuthService(userPoolId?: string, region?: string): IAuthService {
  return new AuthService(userPoolId, region);
}
