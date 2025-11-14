# API Business Logic Handlers

This directory contains Lambda handlers for API business logic operations related to file management.

## Handlers

### 1. Get User Files (`get-user-files.ts`)

**Purpose**: Retrieves all files uploaded by the authenticated user with pagination support.

**Requirements**: 2.3, 8.16

**Endpoint**: `GET /api/files`

**Authentication**: Required (JWT token)

**Query Parameters**:

- `limit` (optional): Number of files to return (default: 50, max: 100)
- `offset` (optional): Number of files to skip for pagination (default: 0)

**Response**:

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "uuid",
        "fileName": "example.pdf",
        "fileSize": 1024000,
        "mimeType": "application/pdf",
        "uploadedAt": "2024-01-01T00:00:00.000Z",
        "metadata": {}
      }
    ],
    "total": 42
  }
}
```

**Features**:

- Pagination support
- Input validation
- Structured logging for CloudWatch
- Error handling with appropriate status codes

---

### 2. Get File Metadata (`get-file-metadata.ts`)

**Purpose**: Retrieves metadata for a specific file by ID.

**Requirements**: 2.3, 8.16

**Endpoint**: `GET /api/files/:fileId`

**Authentication**: Required (JWT token)

**Path Parameters**:

- `fileId`: UUID of the file

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fileName": "example.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-01T00:00:00.000Z",
    "metadata": {}
  }
}
```

**Features**:

- UUID validation
- Ownership verification (users can only access their own files)
- Structured logging for CloudWatch
- Error handling with appropriate status codes

**Error Responses**:

- `400`: Invalid file ID format
- `401`: Authentication required
- `403`: User does not own the file
- `404`: File not found

---

### 3. Generate Presigned URL (`generate-presigned-url.ts`)

**Purpose**: Generates a presigned S3 URL for secure file downloads.

**Requirements**: 2.3, 8.16

**Endpoint**: `GET /api/files/:fileId/download`

**Authentication**: Required (JWT token)

**Path Parameters**:

- `fileId`: UUID of the file

**Query Parameters**:

- `expiresIn` (optional): URL expiration time in seconds (default: 3600, max: 604800)

**Response**:

```json
{
  "success": true,
  "data": {
    "url": "https://s3.amazonaws.com/bucket/key?...",
    "expiresIn": 3600
  }
}
```

**Features**:

- Presigned URL generation with configurable expiration
- Ownership verification (users can only download their own files)
- Automatic filename attachment in download response
- Structured logging for CloudWatch
- Error handling with appropriate status codes

**Security**:

- URLs expire after the specified time
- Users can only generate URLs for files they own
- S3 bucket remains private (no direct access)

---

## Common Features

All handlers implement:

1. **Authentication Middleware**: Uses `withAuth()` to validate JWT tokens
2. **Input Validation**: Validates all user inputs with appropriate error messages
3. **Structured Logging**: JSON-formatted logs for CloudWatch integration
4. **Error Handling**: Consistent error responses with proper HTTP status codes
5. **SOLID Principles**: Single Responsibility, clear interfaces, dependency injection
6. **CORS Support**: Includes CORS headers for cross-origin requests

## Error Response Format

All handlers return errors in a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

## Logging Format

All handlers use structured JSON logging for CloudWatch:

```json
{
  "action": "handler_action",
  "userId": "user-uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "additionalFields": "..."
}
```

## Usage Example

### API Gateway Integration

These handlers are designed to be integrated with API Gateway:

```typescript
// In API Gateway configuration
{
  "GET /api/files": getUserFilesHandler,
  "GET /api/files/{fileId}": getFileMetadataHandler,
  "GET /api/files/{fileId}/download": generatePresignedUrlHandler
}
```

### Local Testing

```bash
# Build the handlers
npm run build

# Run tests
npm test
```

## Dependencies

- `@aws-sdk/client-s3`: S3 operations
- `@aws-sdk/s3-request-presigner`: Presigned URL generation
- `pg`: PostgreSQL database client
- Authentication middleware
- Repository layer for database access

## Related Files

- `../files/upload-file.ts`: File upload handler
- `../../middleware/auth-middleware.ts`: Authentication middleware
- `../../repositories/file-repository.impl.ts`: File repository implementation
- `../../types/api.ts`: API type definitions
- `../../types/errors.ts`: Error classes
