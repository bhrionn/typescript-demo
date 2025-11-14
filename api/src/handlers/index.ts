/**
 * Lambda handlers exports
 */

// Export handlers with specific names to avoid conflicts
export { handler as validateTokenHandler } from './auth/validate-token';
export { handler as uploadFileHandler } from './files/upload-file';

// API business logic handlers
export { handler as getUserFilesHandler } from './api/get-user-files';
export { handler as getFileMetadataHandler } from './api/get-file-metadata';
export { handler as generatePresignedUrlHandler } from './api/generate-presigned-url';
