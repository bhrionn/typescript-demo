# File Components

This directory contains components for file upload and management functionality.

## Components

### FileUploadForm

A comprehensive file upload component with drag-and-drop support, file validation, and progress tracking.

**Features:**

- Drag-and-drop file selection
- Click to browse file picker
- File type and size validation
- Real-time upload progress bar
- File preview before upload
- Success/error message display
- Responsive design

**Props:**

- `uploadService: IFileUploadService` - Service for handling file uploads
- `onUploadSuccess?: (fileId: string) => void` - Callback when upload succeeds
- `onUploadError?: (error: Error) => void` - Callback when upload fails

**Usage:**

```tsx
import { FileUploadForm } from '../components/files';
import { FileUploadService } from '../services/FileUploadService';
import { ApiClient } from '../services/ApiClient';

const uploadService = new FileUploadService(apiClient);

<FileUploadForm
  uploadService={uploadService}
  onUploadSuccess={(fileId) => console.log('Uploaded:', fileId)}
  onUploadError={(error) => console.error('Upload failed:', error)}
/>;
```

### FileList

Displays a list of uploaded files with download functionality.

**Features:**

- Displays file metadata (name, size, type, upload date)
- File type icons (images, documents, etc.)
- Download functionality with presigned URLs
- Loading and error states
- Empty state message
- Refresh button
- Responsive design

**Props:**

- `apiClient: IApiClient` - API client for fetching files and presigned URLs
- `refreshTrigger?: number` - Optional trigger to refresh the file list

**Usage:**

```tsx
import { FileList } from '../components/files';
import { ApiClient } from '../services/ApiClient';

const [refreshTrigger, setRefreshTrigger] = useState(0);

<FileList apiClient={apiClient} refreshTrigger={refreshTrigger} />;

// Trigger refresh after upload
setRefreshTrigger((prev) => prev + 1);
```

## Integration Example

Complete example integrating both components:

```tsx
import React, { useState, useMemo } from 'react';
import { Box } from '@mui/material';
import { FileUploadForm, FileList } from '../components/files';
import { FileUploadService } from '../services/FileUploadService';
import { ApiClient } from '../services/ApiClient';
import { AuthService } from '../services/AuthService';

export const FilesPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize services
  const authService = useMemo(() => new AuthService(), []);
  const apiClient = useMemo(() => new ApiClient(authService), [authService]);
  const uploadService = useMemo(() => new FileUploadService(apiClient), [apiClient]);

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 3,
      }}
    >
      <FileUploadForm uploadService={uploadService} onUploadSuccess={handleUploadSuccess} />
      <FileList apiClient={apiClient} refreshTrigger={refreshTrigger} />
    </Box>
  );
};
```

## File Validation

The FileUploadForm validates files based on:

- **Maximum size**: 50MB
- **Supported types**:
  - Images: JPEG, PNG, GIF, WebP, SVG
  - Documents: PDF, Word, Excel, PowerPoint, Text, CSV, ZIP

## Design Principles

These components follow SOLID principles:

- **Single Responsibility**: Each component has one clear purpose
- **Dependency Inversion**: Components depend on service interfaces (IFileUploadService, IApiClient)
- **Open-Closed**: Components can be extended without modification
- **Interface Segregation**: Props are focused and minimal

## Accessibility

Both components include:

- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader announcements
- Semantic HTML structure
- Focus management

## Requirements Addressed

- **Requirement 2.1**: File upload with validation
- **Requirement 2.2**: Secure API integration
- **Requirement 9.2**: Clear visual feedback
- **Requirement 9.4**: Loading states
- **Requirement 9.5**: Error handling with user-friendly messages
