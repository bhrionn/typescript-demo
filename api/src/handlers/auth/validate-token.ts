/**
 * Token validation handler
 * Demonstrates authentication middleware usage
 */

import { APIGatewayResponse } from '../../types/api';
import { withAuth, AuthenticatedEvent } from '../../middleware/auth-middleware';

/**
 * Handler to validate token and return user information
 * Protected by authentication middleware
 */
async function validateTokenHandler(event: AuthenticatedEvent): Promise<APIGatewayResponse> {
  try {
    // User information is already validated and attached by middleware
    const user = event.user;

    if (!user) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'User not authenticated',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          userId: user.userId,
          email: user.email,
          message: 'Token is valid',
        },
      }),
    };
  } catch (error) {
    console.error('Token validation error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      }),
    };
  }
}

// Export handler wrapped with authentication middleware
export const handler = withAuth(validateTokenHandler);
