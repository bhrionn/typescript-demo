# File Upload Handler

This directory contains Lambda handlers for file operations.

## Upload File Handler

**File:** `upload-file.ts`

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 3.6

### Overview

Handles secure file uploads to S3 with metadata storage in RDS. The handler validates file type and size, uploads to S3 with encryption, and stores metadata in the database.

### Features

- **Authentication**: Uses JWT token validation middleware
- **File Validation**: Validates file type and size (max 50MB)
- **Secure Upload**: Uploads to S3 with AES-256 encryption
- **Metadata Storage**: Stores file metadata in PostgreSQL
- **Error Handling**: Comprehensive error handling with specific error types

### Supported File Types

#### Images

- JPEG, PNG, GIF, WebP, SVG

#### Documents

- PDF, Word (DOC, DOCX), Excel (XLS, XLSX), PowerPoint (PPT, PPTX)
- Plain text, CSV

#### Archives

- ZIP, RAR

#### Other

- JSON, XML

### Request Format

The handler supports two request formats:

#### 1. Binary Upload (Recommended)

Send the file as base64-encoded binary data with metadata in headers:

```
POST /api/files/upload
Headers:
  Authorization: Bearer <jwt-token>
  Content-Type: application/octet-stream
  x-file-name: document.pdf
  x-mime-type: application/pdf
  x-metadata: {"description": "Important document"}
Body: <base64-encoded-file-content>
```

#### 2. JSON Upload

Send file data as JSON:

```json
POST /api/files/upload
Headers:
  Authorization: Bearer <jwt-token>
  Content-Type: application/json
Body:
{
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "fileContent": "<base64-encoded-content>",
  "metadata": {
    "description": "Important document"
  }
}
```

### Response Format

#### Success Response (201)

```json
{
  "success": true,
  "data": {
    "fileId": "550e8400-e29b-41d4-a716-446655440000",
    "fileName": "document.pdf",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "message": "File uploaded successfully"
  }
}
```

#### Error Response (4xx/5xx)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "File size exceeds maximum allowed size of 50MB",
  "details": {}
}
```

### Error Codes

- `VALIDATION_ERROR` (400): Invalid file type, size, or missing required fields
- `AUTHENTICATION_ERROR` (401): Missing or invalid JWT token
- `FILE_PROCESSING_ERROR` (400): Error processing file data
- `EXTERNAL_SERVICE_ERROR` (502): S3 upload failed
- `DATABASE_ERROR` (500): Failed to store metadata
- `INTERNAL_ERROR` (500): Unexpected error

### Environment Variables

- `S3_BUCKET_NAME`: S3 bucket for file storage (required)
- `AWS_REGION`: AWS region (default: us-east-1)
- `DATABASE_URL`: PostgreSQL connection string (required)

### Security Features

1. **Authentication**: JWT token validation via middleware
2. **File Validation**: Type and size restrictions
3. **Path Traversal Protection**: Sanitizes file names
4. **Encryption**: AES-256 server-side encryption in S3
5. **User Isolation**: Files stored with user ID prefix
6. **Prepared Statements**: SQL injection prevention

### S3 Key Format

Files are stored with the following key structure:

```
uploads/{userId}/{timestamp}-{random}-{sanitized-filename}
```

Example: `uploads/user-123/1705315800000-abc123def-document.pdf`

### Database Schema

File metadata is stored in the `files` table:

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  s3_key VARCHAR(1024) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);
```

### Usage Example

```typescript
import { handler } from './upload-file';

// Lambda invocation
const event = {
  headers: {
    Authorization: 'Bearer eyJhbGc...',
    'x-file-name': 'report.pdf',
    'x-mime-type': 'application/pdf',
  },
  body: '<base64-encoded-content>',
  isBase64Encoded: true,
  // ... other API Gateway event properties
};

const response = await handler(event);
```

### Testing

Test the handler locally using the Docker environment:

```bash
# Start local environment
docker-compose up

# The handler will connect to:
# - LocalStack S3 (http://localstack:4566)
# - PostgreSQL (postgres:5432)
```

### SOLID Principles

- **Single Responsibility**: Each function has one clear purpose
- **Open-Closed**: Extensible through configuration and error types
- **Liskov Substitution**: Uses repository interfaces
- **Interface Segregation**: Focused interfaces for each concern
- **Dependency Inversion**: Depends on abstractions (IFileRepository)
