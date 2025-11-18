import { test, expect } from '@playwright/test';
import { MockCognitoHelper } from './helpers/mock-cognito';
import { MockApiHelper } from './helpers/mock-api';
import path from 'path';
import fs from 'fs';

test.describe('Error Scenarios', () => {
  let mockCognito: MockCognitoHelper;
  let mockApi: MockApiHelper;

  test.beforeEach(async ({ page }) => {
    mockCognito = new MockCognitoHelper(page);
    mockApi = new MockApiHelper(page);
  });

  test.describe('Authentication Errors', () => {
    test('should handle network error during login', async ({ page }) => {
      // Simulate network failure
      await page.route('**/oauth2/**', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/');

      const googleButton = page.getByRole('button', { name: /google/i });
      await googleButton.click();

      // Should display error message
      await expect(page.getByText(/error|failed|network/i)).toBeVisible({ timeout: 5000 });
    });

    test('should handle invalid token error', async ({ page }) => {
      await mockCognito.setAuthState();
      await mockCognito.mockTokenValidation(false);
      await mockApi.mockUnauthorized();

      await page.goto('/dashboard');

      // Should redirect to login due to invalid token
      await expect(page).toHaveURL(/\/login|\//, { timeout: 10000 });
    });

    test('should handle token refresh failure', async ({ page }) => {
      await mockCognito.setAuthState();

      // Mock token refresh failure
      await page.route('**/oauth2/token*', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Refresh token expired',
          }),
        });
      });

      await mockApi.mockUnauthorized();

      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login|\//, { timeout: 10000 });
    });
  });

  test.describe('File Upload Errors', () => {
    test.beforeEach(async ({ page }) => {
      await mockCognito.setAuthState();
      await mockCognito.mockTokenValidation(true);
      await mockApi.mockGetUserFiles([]);
    });

    test('should handle file upload network error', async ({ page }) => {
      // Simulate network failure for upload
      await page.route('**/api/files/upload*', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/dashboard');

      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Should display network error
        await expect(page.getByText(/error|failed|network/i)).toBeVisible({ timeout: 10000 });
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('should handle server error during upload', async ({ page }) => {
      await mockApi.mockFileUploadFailure('INTERNAL_ERROR');

      await page.goto('/dashboard');

      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Should display server error
        await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 10000 });
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('should handle unauthorized error during upload', async ({ page }) => {
      await page.route('**/api/files/upload*', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'UNAUTHORIZED',
            message: 'Authentication required',
          }),
        });
      });

      await page.goto('/dashboard');

      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Should display unauthorized error or redirect to login
        await Promise.race([
          expect(page.getByText(/unauthorized|authentication/i)).toBeVisible({ timeout: 5000 }),
          expect(page).toHaveURL(/\/login|\//, { timeout: 5000 }),
        ]);
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('should handle timeout during upload', async ({ page }) => {
      // Simulate timeout by delaying response indefinitely
      await page.route('**/api/files/upload*', async (route) => {
        // Don't fulfill or continue - simulate timeout
        await new Promise((resolve) => setTimeout(resolve, 60000));
      });

      await page.goto('/dashboard');

      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Should display timeout error
        await expect(page.getByText(/timeout|taking too long/i)).toBeVisible({ timeout: 35000 });
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });

  test.describe('API Errors', () => {
    test.beforeEach(async ({ page }) => {
      await mockCognito.setAuthState();
      await mockCognito.mockTokenValidation(true);
    });

    test('should handle error fetching file list', async ({ page }) => {
      await page.route('**/api/files*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'INTERNAL_ERROR',
              message: 'Failed to fetch files',
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard');

      // Should display error message
      await expect(page.getByText(/error|failed.*load|could not.*fetch/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test('should handle error generating presigned URL', async ({ page }) => {
      const mockFiles = [
        {
          id: 'file-1',
          fileName: 'document.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedAt: new Date().toISOString(),
        },
      ];

      await mockApi.mockGetUserFiles(mockFiles);

      await page.route('**/api/files/*/download*', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'DOWNLOAD_FAILED',
            message: 'Failed to generate download URL',
          }),
        });
      });

      await page.goto('/dashboard');

      const downloadButton = page.getByRole('button', { name: /download/i }).first();
      await downloadButton.click();

      // Should display error message
      await expect(page.getByText(/error|failed.*download/i)).toBeVisible({ timeout: 5000 });
    });

    test('should handle rate limiting error', async ({ page }) => {
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
          }),
        });
      });

      await page.goto('/dashboard');

      // Should display rate limit error
      await expect(page.getByText(/too many|rate limit|slow down/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Validation Errors', () => {
    test.beforeEach(async ({ page }) => {
      await mockCognito.setAuthState();
      await mockCognito.mockTokenValidation(true);
      await mockApi.mockGetUserFiles([]);
    });

    test('should prevent upload of empty file', async ({ page }) => {
      await page.goto('/dashboard');

      const testFilePath = path.join(__dirname, 'empty-file.txt');
      fs.writeFileSync(testFilePath, '');

      try {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Should display validation error
        await expect(page.getByText(/empty|no content|invalid/i)).toBeVisible({ timeout: 5000 });
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('should handle malformed API response', async ({ page }) => {
      await page.route('**/api/files*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: 'invalid json response',
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard');

      // Should handle malformed response gracefully
      await expect(page.getByText(/error|something went wrong/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Network Errors', () => {
    test.beforeEach(async ({ page }) => {
      await mockCognito.setAuthState();
      await mockCognito.mockTokenValidation(true);
    });

    test('should handle complete network failure', async ({ page }) => {
      // Abort all API requests
      await page.route('**/api/**', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/dashboard');

      // Should display network error
      await expect(page.getByText(/network|connection|offline/i)).toBeVisible({ timeout: 5000 });
    });

    test('should handle intermittent connectivity', async ({ page }) => {
      let requestCount = 0;

      await page.route('**/api/files*', async (route) => {
        requestCount++;

        if (requestCount === 1) {
          // First request fails
          await route.abort('failed');
        } else {
          // Subsequent requests succeed
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ files: [] }),
          });
        }
      });

      await page.goto('/dashboard');

      // Should eventually recover or show retry option
      await page.waitForTimeout(2000);
    });
  });
});
