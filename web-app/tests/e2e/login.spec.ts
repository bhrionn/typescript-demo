import { test, expect } from '@playwright/test';
import { MockCognitoHelper } from './helpers/mock-cognito';
import { MockApiHelper } from './helpers/mock-api';

test.describe('Login Flow', () => {
  let mockCognito: MockCognitoHelper;
  let mockApi: MockApiHelper;

  test.beforeEach(async ({ page }) => {
    mockCognito = new MockCognitoHelper(page);
    mockApi = new MockApiHelper(page);

    // Clear any existing auth state
    await mockCognito.clearAuthState();
  });

  test('should display login page with provider options', async ({ page }) => {
    await page.goto('/');

    // Should show login page
    await expect(page.locator('h1, h2').filter({ hasText: /login|sign in/i })).toBeVisible();

    // Should display Google login button
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();

    // Should display Microsoft login button
    await expect(page.getByRole('button', { name: /microsoft/i })).toBeVisible();
  });

  test('should successfully login with Google provider', async ({ page }) => {
    // Mock Cognito authentication
    await mockCognito.mockGoogleAuth();
    await mockCognito.mockTokenValidation(true);
    await mockApi.mockGetUserFiles([]);

    await page.goto('/');

    // Click Google login button
    const googleButton = page.getByRole('button', { name: /google/i });
    await googleButton.click();

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Should display user interface elements
    await expect(page.getByText(/dashboard|welcome/i)).toBeVisible();
  });

  test('should successfully login with Microsoft provider', async ({ page }) => {
    // Mock Cognito authentication
    await mockCognito.mockMicrosoftAuth();
    await mockCognito.mockTokenValidation(true);
    await mockApi.mockGetUserFiles([]);

    await page.goto('/');

    // Click Microsoft login button
    const microsoftButton = page.getByRole('button', { name: /microsoft/i });
    await microsoftButton.click();

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Should display user interface elements
    await expect(page.getByText(/dashboard|welcome/i)).toBeVisible();
  });

  test('should handle authentication failure gracefully', async ({ page }) => {
    // Mock authentication failure
    await mockCognito.mockAuthFailure();

    await page.goto('/');

    // Click Google login button
    const googleButton = page.getByRole('button', { name: /google/i });
    await googleButton.click();

    // Should display error message
    await expect(page.getByText(/error|failed|cancelled/i)).toBeVisible({ timeout: 5000 });

    // Should remain on login page
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test('should handle session expiration', async ({ page }) => {
    // Set up authenticated state
    await mockCognito.setAuthState();
    await mockApi.mockGetUserFiles([]);

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Mock token validation failure (expired token)
    await mockCognito.mockTokenValidation(false);
    await mockApi.mockUnauthorized();

    // Trigger an API call that will fail due to expired token
    await page.reload();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login|\//, { timeout: 10000 });
  });

  test('should allow logout', async ({ page }) => {
    // Set up authenticated state
    await mockCognito.setAuthState();
    await mockApi.mockGetUserFiles([]);

    await page.goto('/dashboard');

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    await logoutButton.click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login|\/$/);

    // Should not be able to access protected routes
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login|\/$/);
  });
});
