/**
 * File Upload Service Usage Examples
 * Demonstrates how to use the FileUploadService with progress tracking
 */

import { FileUploadService, ApiClient, AuthService } from './index';
import type { ProgressObserver } from './IFileUploadService';

/**
 * Example 1: Basic file upload without progress tracking
 */
async function basicUpload(file: File) {
  // Initialize services
  const authService = new AuthService();
  const apiClient = new ApiClient(authService);
  const fileUploadService = new FileUploadService(apiClient);

  try {
    // Validate file first
    const validation = fileUploadService.validateFile(file);
    if (!validation.isValid) {
      console.error('Validation errors:', validation.errors);
      return;
    }

    // Upload file
    const result = await fileUploadService.uploadFile(file);
    console.log('Upload successful:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

/**
 * Example 2: File upload with progress tracking using Observable pattern
 */
async function uploadWithProgress(file: File) {
  const authService = new AuthService();
  const apiClient = new ApiClient(authService);
  const fileUploadService = new FileUploadService(apiClient);

  // Create progress observer
  const progressObserver: ProgressObserver = {
    next: (progress) => {
      console.log(`Upload progress: ${progress.percentage}%`);
      console.log(`Loaded: ${progress.loaded} / ${progress.total} bytes`);
    },
    error: (error) => {
      console.error('Upload error:', error.message);
    },
    complete: () => {
      console.log('Upload complete!');
    },
  };

  try {
    const result = await fileUploadService.uploadFile(file, undefined, progressObserver);
    console.log('File ID:', result.fileId);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

/**
 * Example 3: React component usage with state management
 */
function FileUploadComponent() {
  // This would be in a React component
  const handleFileUpload = async (file: File) => {
    const authService = new AuthService();
    const apiClient = new ApiClient(authService);
    const fileUploadService = new FileUploadService(apiClient);

    // State would be managed with useState hooks
    // const [uploadProgress, setUploadProgress] = useState(0);
    // const [uploadError, setUploadError] = useState<string | null>(null);

    const observer: ProgressObserver = {
      next: (progress) => {
        console.log(`Progress: ${progress.percentage}%`);
        // Update UI state: setUploadProgress(progress.percentage)
      },
      error: (error) => {
        console.error(`Error: ${error.message}`);
        // Update UI state: setUploadError(error.message)
      },
      complete: () => {
        console.log('Upload completed successfully');
        // Update UI state: setUploadComplete(true)
      },
    };

    try {
      await fileUploadService.uploadFile(file, undefined, observer);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return { handleFileUpload };
}

/**
 * Example 4: Check supported file types and size limits
 */
function checkFileConstraints() {
  const authService = new AuthService();
  const apiClient = new ApiClient(authService);
  const fileUploadService = new FileUploadService(apiClient);

  const supportedTypes = fileUploadService.getSupportedFileTypes();
  const maxSize = fileUploadService.getMaxFileSize();
  const maxSizeMB = maxSize / (1024 * 1024);

  console.log('Supported file types:', supportedTypes);
  console.log(`Maximum file size: ${maxSizeMB}MB`);
}

export { basicUpload, uploadWithProgress, FileUploadComponent, checkFileConstraints };
