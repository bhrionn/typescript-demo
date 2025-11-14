/**
 * File repository interface
 * Interface Segregation: Specific interface for file operations
 */

import { FileRecord } from '../types/database';
import { IBaseRepository } from './base-repository';

/**
 * File-specific repository operations
 */
export interface IFileRepository extends IBaseRepository<FileRecord> {
  /**
   * Find all files for a specific user
   */
  findByUserId(userId: string): Promise<FileRecord[]>;

  /**
   * Find files by user ID with pagination
   */
  findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ files: FileRecord[]; total: number }>;

  /**
   * Find a file by S3 key
   */
  findByS3Key(s3Key: string): Promise<FileRecord | null>;

  /**
   * Get total storage used by a user
   */
  getTotalStorageByUser(userId: string): Promise<number>;

  /**
   * Delete all files for a user
   */
  deleteByUserId(userId: string): Promise<number>;
}
