/**
 * Lambda handlers exports
 */

// Export handlers with specific names to avoid conflicts
export { handler as validateTokenHandler } from './auth/validate-token';
export { handler as uploadFileHandler } from './files/upload-file';
