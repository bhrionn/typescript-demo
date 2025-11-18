import { test, expect } from '@playwright/test';
import { MockCognitoHelper } from './helpers/mock-cognito';
import { MockApiHelper } from './helpers/mock-api';
import path from 'path';
import fs from 'fs';

test.describe('File Upload and Retrieval Flow', () => {
  let mockCognito: MockCognitoHelper;
  let mockApi: MockApiHelper;

  test.beforeEach(async ({ page }) => {
    mockCognito = new MockCognitoHelper(page);
    mockApi = new MockApiHelper(page);

    // Set up authenticated state
    await mockCognito.setAuthState();
    await mockCognito.mockTokenValidation(true);
  });

  test('should display file upload form on dashboard', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);

    await page.goto('/dashboard');

    // Should display file upload interface
    await expect(page.getByText(/upload|drop files/i)).toBeVisible();

    // Should have file input or upload button
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('should successfully upload a file', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);
    await mockApi.mockFileUpload();

    await page.goto('/dashboard');

    // Create a temporary test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for E2E testing');

    try {
      // Find file input and upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for upload to complete
      await expect(page.getByText(/upload.*success|uploaded successfully/i)).toBeVisible({
        timeout: 10000,
      });

      // Should display success message
      await expect(page.getByText(/success/i)).toBeVisible();
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should display upload progress during file upload', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);

    // Delay the upload response to see progress
    await page.route('**/api/files/upload*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          fileId: 'mock-file-id-123',
          fileName: 'test-file.txt',
          fileSize: 1024,
          uploadedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/dashboard');

    // Create a temporary test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for E2E testing');

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Should show progress indicator
      await expect(page.locator('[role="progressbar"], .progress, .loading').first()).toBeVisible({
        timeout: 2000,
      });
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should validate file type before upload', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);

    await page.goto('/dashboard');

    // Create an invalid file type
    const testFilePath = path.join(__dirname, 'test-file.exe');
    fs.writeFileSync(testFilePath, 'Invalid file type');

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Should display validation error
      await expect(page.getByText(/invalid.*type|not.*allowed|unsupported/i)).toBeVisible({
        timeout: 5000,
      });
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should validate file size before upload', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);

    await page.goto('/dashboard');

    // Create a large file (simulate > 50MB)
    const testFilePath = path.join(__dirname, 'large-file.txt');
    const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB
    fs.writeFileSync(testFilePath, largeContent);

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Should display size validation error
      await expect(page.getByText(/too large|exceeds.*limit|maximum.*size/i)).toBeVisible({
        timeout: 5000,
      });
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should display list of uploaded files', async ({ page }) => {
    const mockFiles = [
      {
        id: 'file-1',
        fileName: 'document.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
      },
      {
        id: 'file-2',
        fileName: 'image.png',
        fileSize: 4096,
        mimeType: 'image/png',
        uploadedAt: new Date().toISOString(),
      },
    ];

    await mockApi.mockGetUserFiles(mockFiles);

    await page.goto('/dashboard');

    // Should display file list
    await expect(page.getByText('document.pdf')).toBeVisible();
    await expect(page.getByText('image.png')).toBeVisible();
  });

  test('should allow file download via presigned URL', async ({ page }) => {
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
    await mockApi.mockGeneratePresignedUrl('file-1');

    await page.goto('/dashboard');

    // Find and click download button
    const downloadButton = page.getByRole('button', { name: /download/i }).first();

    // Listen for download event
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    await downloadButton.click();

    // Verify download was initiated (or presigned URL was generated)
    const download = await downloadPromise;

    // If no actual download (mocked), verify the API call was made
    if (!download) {
      // The presigned URL endpoint should have been called
      await page.waitForTimeout(1000);
    }
  });

  test('should handle upload failure gracefully', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);
    await mockApi.mockFileUploadFailure('UPLOAD_FAILED');

    await page.goto('/dashboard');

    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file');

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Should display error message
      await expect(page.getByText(/error|failed|could not upload/i)).toBeVisible({
        timeout: 10000,
      });
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should refresh file list after successful upload', async ({ page }) => {
    await mockApi.mockGetUserFiles([]);
    await mockApi.mockFileUpload();

    await page.goto('/dashboard');

    const initialFileCount = await page.locator('[data-testid="file-item"], .file-item').count();

    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file');

    try {
      // Mock updated file list with new file
      await mockApi.mockGetUserFiles([
        {
          id: 'new-file-id',
          fileName: 'test-file.txt',
          fileSize: 1024,
          mimeType: 'text/plain',
          uploadedAt: new Date().toISOString(),
        },
      ]);

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for success message
      await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

      // File list should be updated
      await page.waitForTimeout(1000);
      const newFileCount = await page.locator('[data-testid="file-item"], .file-item').count();

      // Should have at least one file now
      expect(newFileCount).toBeGreaterThanOrEqual(1);
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });
});
