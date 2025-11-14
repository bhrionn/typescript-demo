# File Upload Service

## Overview

The `FileUploadService` provides a robust, type-safe interface for uploading files to the API with comprehensive validation and progress tracking capabilities. It follows SOLID design principles and integrates seamlessly with the existing authentication and API infrastructure.

## Features

- **File Validation**: Validates file type, size, and name before upload
- **Progress Tracking**: Observable pattern for real-time upload progress
- **Error Handling**: Comprehensive error handling with custom error types
- **Type Safety**: Full TypeScript support with strict typing
- **SOLID Principles**: Interface-based design for testability and maintainability

## Supported File Types

### Images

- JPEG/JPG
- PNG
- GIF
- WebP
- SVG

### Documents

- PDF
- Microsoft Word (.doc, .docx)
- Microsoft Excel (.xls, .xlsx)
- Microsoft PowerPoint (.ppt, .pptx)
- Plain Text (.txt)
- CSV
- ZIP archives

## File Size Limit

Maximum file size: **50MB**

## Usage

### Basic Setup

```typescript
import { FileUploadService, ApiClient, AuthService } from './services';

const authService = new AuthService();
const apiClient = new ApiClient(authService);
const fileUploadService = new FileUploadService(apiClient);
```

### Validate a File

```typescript
const validation = fileUploadService.validateFile(file);

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  // Display errors to user
} else {
  // Proceed with upload
}
```

### Upload Without Progress Tracking

```typescript
try {
  const result = await fileUploadService.uploadFile(file);
  console.log('File uploaded successfully:', result.fileId);
} catch (error) {
  console.error('Upload failed:', error);
}
```

### Upload With Progress Tracking

```typescript
import type { ProgressObserver } from './services';

const observer: ProgressObserver = {
  next: (progress) => {
    console.log(`${progress.percentage}% complete`);
    // Update progress bar: setProgress(progress.percentage)
  },
  error: (error) => {
    console.error('Upload error:', error.message);
    // Show error to user
  },
  complete: () => {
    console.log('Upload complete!');
    // Show success message
  },
};

await fileUploadService.uploadFile(file, undefined, observer);
```

## React Component Example

```typescript
import React, { useState } from 'react';
import { FileUploadService } from './services';
import type { ProgressObserver } from './services';

function FileUploadComponent({ fileUploadService }: { fileUploadService: FileUploadService }) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = fileUploadService.validateFile(file);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    const observer: ProgressObserver = {
      next: (prog) => setProgress(prog.percentage),
      error: (err) => {
        setError(err.message);
        setUploading(false);
      },
      complete: () => setUploading(false),
    };

    try {
      await fileUploadService.uploadFile(file, undefined, observer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} disabled={uploading} />
      {uploading && <progress value={progress} max={100} />}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

## API Reference

See `IFileUploadService.ts` for complete interface documentation.

## Error Handling

The service throws `FileUploadError` with specific error codes:

- `VALIDATION_ERROR`: File validation failed
- `UPLOAD_ERROR`: Upload to API failed

## SOLID Principles

- **Single Responsibility**: Handles only file upload operations
- **Open-Closed**: Extensible through interfaces
- **Liskov Substitution**: Implements IFileUploadService interface
- **Interface Segregation**: Focused interface with only necessary methods
- **Dependency Inversion**: Depends on IApiClient abstraction
