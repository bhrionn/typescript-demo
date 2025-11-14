/**
 * Database model interfaces
 */

export interface User {
  id: string; // UUID
  email: string;
  provider: 'google' | 'microsoft';
  providerId: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface FileRecord {
  id: string; // UUID
  userId: string; // Foreign key to User
  fileName: string;
  fileSize: number; // Bytes
  mimeType: string;
  s3Key: string; // S3 object key
  s3Bucket: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}
