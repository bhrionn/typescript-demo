import { Page } from '@playwright/test';

/**
 * Mock API responses for E2E testing
 */
export class MockApiHelper {
  constructor(private page: Page) {}

  /**
   * Mock successful file upload
   */
  async mockFileUpload() {
    await this.page.route('**/api/files/upload*', async (route) => {
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
  }

  /**
   * Mock file upload failure
   */
  async mockFileUploadFailure(errorCode: string = 'UPLOAD_FAILED') {
    await this.page.route('**/api/files/upload*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: errorCode,
          message: 'File upload failed',
        }),
      });
    });
  }

  /**
   * Mock file list retrieval
   */
  async mockGetUserFiles(files: any[] = []) {
    await this.page.route('**/api/files*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            files:
              files.length > 0
                ? files
                : [
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
                  ],
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  /**
   * Mock file metadata retrieval
   */
  async mockGetFileMetadata(fileId: string) {
    await this.page.route(`**/api/files/${fileId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: fileId,
          fileName: 'test-file.txt',
          fileSize: 1024,
          mimeType: 'text/plain',
          uploadedAt: new Date().toISOString(),
        }),
      });
    });
  }

  /**
   * Mock presigned URL generation
   */
  async mockGeneratePresignedUrl(fileId: string) {
    await this.page.route(`**/api/files/${fileId}/download*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: `https://mock-s3-bucket.s3.amazonaws.com/${fileId}?signature=mock`,
          expiresIn: 3600,
        }),
      });
    });
  }

  /**
   * Mock API error response
   */
  async mockApiError(statusCode: number = 500, errorCode: string = 'INTERNAL_ERROR') {
    await this.page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          error: errorCode,
          message: 'An error occurred',
        }),
      });
    });
  }

  /**
   * Mock unauthorized response
   */
  async mockUnauthorized() {
    await this.page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        }),
      });
    });
  }
}
