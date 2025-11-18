# E2E Tests

This directory contains end-to-end tests for the web application using Playwright.

## Overview

The E2E test suite covers critical user flows and error scenarios:

1. **Login Flow** (`login.spec.ts`) - Authentication with Google and Microsoft providers
2. **File Upload and Retrieval** (`file-upload.spec.ts`) - File upload, validation, and download
3. **Error Scenarios** (`error-scenarios.spec.ts`) - Comprehensive error handling tests

## Test Coverage

### Login Flow Tests

- Display login page with provider options
- Successful login with Google provider
- Successful login with Microsoft provider
- Authentication failure handling
- Redirect unauthenticated users to login
- Session expiration handling
- Logout functionality

### File Upload and Retrieval Tests

- Display file upload form
- Successfully upload a file
- Display upload progress
- Validate file type before upload
- Validate file size before upload
- Display list of uploaded files
- Allow file download via presigned URL
- Handle upload failure gracefully
- Refresh file list after successful upload

### Error Scenarios Tests

#### Authentication Errors

- Network error during login
- Invalid token error
- Token refresh failure

#### File Upload Errors

- File upload network error
- Server error during upload
- Unauthorized error during upload
- Timeout during upload

#### API Errors

- Error fetching file list
- Error generating presigned URL
- Rate limiting error

#### Validation Errors

- Prevent upload of empty file
- Handle malformed API response

#### Network Errors

- Complete network failure
- Intermittent connectivity

## Running Tests

### Prerequisites

Install Playwright browsers:

```bash
npm run playwright:install
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Tests with UI

```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode

```bash
npm run test:e2e:headed
```

### Debug Tests

```bash
npm run test:e2e:debug
```

### Run Specific Test File

```bash
npx playwright test login.spec.ts
```

### Run Specific Test

```bash
npx playwright test -g "should successfully login with Google"
```

## Test Helpers

### MockCognitoHelper

Provides methods to mock Cognito authentication:

- `mockGoogleAuth()` - Mock Google OAuth flow
- `mockMicrosoftAuth()` - Mock Microsoft OAuth flow
- `mockAuthFailure()` - Mock authentication failure
- `mockTokenValidation(isValid)` - Mock token validation
- `setAuthState()` - Set mock authentication state
- `clearAuthState()` - Clear authentication state

### MockApiHelper

Provides methods to mock API responses:

- `mockFileUpload()` - Mock successful file upload
- `mockFileUploadFailure(errorCode)` - Mock upload failure
- `mockGetUserFiles(files)` - Mock file list retrieval
- `mockGetFileMetadata(fileId)` - Mock file metadata
- `mockGeneratePresignedUrl(fileId)` - Mock presigned URL generation
- `mockApiError(statusCode, errorCode)` - Mock API error
- `mockUnauthorized()` - Mock unauthorized response

## Configuration

Test configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Browsers**: Chromium, Firefox, WebKit
- **Retries**: 2 in CI, 0 locally
- **Screenshots**: On failure only
- **Trace**: On first retry

## CI/CD Integration

Tests are configured to run in CI environments with:

- Parallel execution disabled in CI
- 2 retries for flaky tests
- HTML reporter for test results
- Automatic dev server startup

## Best Practices

1. **Use Mock Helpers**: Always use `MockCognitoHelper` and `MockApiHelper` for consistent mocking
2. **Clean Up**: Clean up test files in `finally` blocks
3. **Wait for Elements**: Use `expect().toBeVisible()` with timeouts
4. **Descriptive Names**: Use clear, descriptive test names
5. **Isolated Tests**: Each test should be independent
6. **Test Data**: Create test files dynamically, don't commit test files

## Troubleshooting

### Tests Fail to Start

Ensure the dev server is running or configured in `playwright.config.ts`:

```bash
npm run dev
```

### Browser Not Installed

Install Playwright browsers:

```bash
npm run playwright:install
```

### Flaky Tests

- Increase timeouts for slow operations
- Use `waitForTimeout()` sparingly
- Ensure proper cleanup in `afterEach` hooks

### Debug Mode

Run tests in debug mode to step through:

```bash
npm run test:e2e:debug
```

## Requirements Coverage

These E2E tests satisfy the following requirements:

- **Requirement 1.1**: Federated authentication with Google and Microsoft
- **Requirement 2.1**: File upload validation and processing
- **Requirement 2.2**: Secure API integration with authentication
- **Requirement 9.5**: Error handling with user-friendly messages
