import { Page } from '@playwright/test';

/**
 * Mock Cognito authentication responses for E2E testing
 */
export class MockCognitoHelper {
  constructor(private page: Page) {}

  /**
   * Mock successful authentication with Google provider
   */
  async mockGoogleAuth() {
    await this.page.route('**/oauth2/authorize*', async (route) => {
      // Simulate OAuth redirect with mock token
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get('redirect_uri');

      if (redirectUri) {
        const mockCode = 'mock-auth-code-google';
        await route.fulfill({
          status: 302,
          headers: {
            Location: `${redirectUri}?code=${mockCode}`,
          },
        });
      } else {
        await route.continue();
      }
    });

    // Mock token exchange
    await this.page.route('**/oauth2/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          id_token: 'mock-id-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });
    });

    // Mock user info endpoint
    await this.page.route('**/oauth2/userInfo*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sub: 'mock-user-id',
          email: 'test@example.com',
          email_verified: true,
        }),
      });
    });
  }

  /**
   * Mock successful authentication with Microsoft provider
   */
  async mockMicrosoftAuth() {
    await this.page.route('**/oauth2/authorize*', async (route) => {
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get('redirect_uri');

      if (redirectUri) {
        const mockCode = 'mock-auth-code-microsoft';
        await route.fulfill({
          status: 302,
          headers: {
            Location: `${redirectUri}?code=${mockCode}`,
          },
        });
      } else {
        await route.continue();
      }
    });

    await this.page.route('**/oauth2/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token-ms',
          id_token: 'mock-id-token-ms',
          refresh_token: 'mock-refresh-token-ms',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });
    });

    await this.page.route('**/oauth2/userInfo*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sub: 'mock-user-id-ms',
          email: 'test@microsoft.com',
          email_verified: true,
        }),
      });
    });
  }

  /**
   * Mock authentication failure
   */
  async mockAuthFailure() {
    await this.page.route('**/oauth2/authorize*', async (route) => {
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get('redirect_uri');

      if (redirectUri) {
        await route.fulfill({
          status: 302,
          headers: {
            Location: `${redirectUri}?error=access_denied&error_description=User%20cancelled%20login`,
          },
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock token validation endpoint
   */
  async mockTokenValidation(isValid: boolean = true) {
    await this.page.route('**/api/auth/validate*', async (route) => {
      if (isValid) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            valid: true,
            userId: 'mock-user-id',
            email: 'test@example.com',
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'INVALID_TOKEN',
            message: 'Token is invalid or expired',
          }),
        });
      }
    });
  }

  /**
   * Set mock authentication state in localStorage
   */
  async setAuthState() {
    await this.page.evaluate(() => {
      const mockAuthState = {
        accessToken: 'mock-access-token',
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
        user: {
          id: 'mock-user-id',
          email: 'test@example.com',
        },
      };
      localStorage.setItem('auth-state', JSON.stringify(mockAuthState));
    });
  }

  /**
   * Clear authentication state
   */
  async clearAuthState() {
    await this.page.evaluate(() => {
      localStorage.removeItem('auth-state');
    });
  }
}
