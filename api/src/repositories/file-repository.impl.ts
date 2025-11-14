/**
 * File repository implementation
 * Requirements: 10.4, 10.5
 * Uses prepared statements to prevent SQL injection
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FileRecord } from '../types/database';
import { IFileRepository } from './file-repository';
import { IDatabaseConnection } from './base-repository';

/**
 * PostgreSQL implementation of File repository
 * Single Responsibility: Handles file metadata persistence
 */
export class FileRepository implements IFileRepository {
  constructor(private db: IDatabaseConnection) {}

  /**
   * Find a file by ID
   */
  async findById(id: string): Promise<FileRecord | null> {
    const sql = `
      SELECT id, user_id as "userId", file_name as "fileName", 
             file_size as "fileSize", mime_type as "mimeType",
             s3_key as "s3Key", s3_bucket as "s3Bucket",
             uploaded_at as "uploadedAt", metadata
      FROM files
      WHERE id = $1
    `;

    return await this.db.queryOne<FileRecord>(sql, [id]);
  }

  /**
   * Find all files matching criteria
   */
  async findAll(criteria?: Partial<FileRecord>): Promise<FileRecord[]> {
    let sql = `
      SELECT id, user_id as "userId", file_name as "fileName", 
             file_size as "fileSize", mime_type as "mimeType",
             s3_key as "s3Key", s3_bucket as "s3Bucket",
             uploaded_at as "uploadedAt", metadata
      FROM files
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (criteria) {
      if (criteria.userId) {
        conditions.push(`user_id = $${params.length + 1}`);
        params.push(criteria.userId);
      }
      if (criteria.mimeType) {
        conditions.push(`mime_type = $${params.length + 1}`);
        params.push(criteria.mimeType);
      }
      if (criteria.s3Bucket) {
        conditions.push(`s3_bucket = $${params.length + 1}`);
        params.push(criteria.s3Bucket);
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY uploaded_at DESC';

    return await this.db.query<FileRecord>(sql, params);
  }

  /**
   * Create a new file record
   */
  async create(data: Omit<FileRecord, 'id'>): Promise<FileRecord> {
    const sql = `
      INSERT INTO files (user_id, file_name, file_size, mime_type, s3_key, s3_bucket, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id as "userId", file_name as "fileName", 
                file_size as "fileSize", mime_type as "mimeType",
                s3_key as "s3Key", s3_bucket as "s3Bucket",
                uploaded_at as "uploadedAt", metadata
    `;

    const result = await this.db.queryOne<FileRecord>(sql, [
      data.userId,
      data.fileName,
      data.fileSize,
      data.mimeType,
      data.s3Key,
      data.s3Bucket,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]);

    if (!result) {
      throw new Error('Failed to create file record');
    }

    return result;
  }

  /**
   * Update an existing file record
   */
  async update(id: string, data: Partial<FileRecord>): Promise<FileRecord> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.fileName !== undefined) {
      updates.push(`file_name = $${params.length + 1}`);
      params.push(data.fileName);
    }
    if (data.fileSize !== undefined) {
      updates.push(`file_size = $${params.length + 1}`);
      params.push(data.fileSize);
    }
    if (data.mimeType !== undefined) {
      updates.push(`mime_type = $${params.length + 1}`);
      params.push(data.mimeType);
    }
    if (data.s3Key !== undefined) {
      updates.push(`s3_key = $${params.length + 1}`);
      params.push(data.s3Key);
    }
    if (data.s3Bucket !== undefined) {
      updates.push(`s3_bucket = $${params.length + 1}`);
      params.push(data.s3Bucket);
    }
    if (data.metadata !== undefined) {
      updates.push(`metadata = $${params.length + 1}`);
      params.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);

    const sql = `
      UPDATE files
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, user_id as "userId", file_name as "fileName", 
                file_size as "fileSize", mime_type as "mimeType",
                s3_key as "s3Key", s3_bucket as "s3Bucket",
                uploaded_at as "uploadedAt", metadata
    `;

    const result = await this.db.queryOne<FileRecord>(sql, params);

    if (!result) {
      throw new Error(`File with id ${id} not found`);
    }

    return result;
  }

  /**
   * Delete a file by ID
   */
  async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM files WHERE id = $1';
    const result = await this.db.query(sql, [id]);
    return result.length > 0;
  }

  /**
   * Check if a file exists
   */
  async exists(id: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM files WHERE id = $1';
    const result = await this.db.queryOne(sql, [id]);
    return result !== null;
  }

  /**
   * Find all files for a specific user
   */
  async findByUserId(userId: string): Promise<FileRecord[]> {
    const sql = `
      SELECT id, user_id as "userId", file_name as "fileName", 
             file_size as "fileSize", mime_type as "mimeType",
             s3_key as "s3Key", s3_bucket as "s3Bucket",
             uploaded_at as "uploadedAt", metadata
      FROM files
      WHERE user_id = $1
      ORDER BY uploaded_at DESC
    `;

    return await this.db.query<FileRecord>(sql, [userId]);
  }

  /**
   * Find files by user ID with pagination
   */
  async findByUserIdPaginated(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ files: FileRecord[]; total: number }> {
    // Get total count
    const countSql = 'SELECT COUNT(*) as count FROM files WHERE user_id = $1';
    const countResult = await this.db.queryOne<{ count: string }>(countSql, [userId]);
    const total = countResult ? parseInt(countResult.count, 10) : 0;

    // Get paginated files
    const filesSql = `
      SELECT id, user_id as "userId", file_name as "fileName", 
             file_size as "fileSize", mime_type as "mimeType",
             s3_key as "s3Key", s3_bucket as "s3Bucket",
             uploaded_at as "uploadedAt", metadata
      FROM files
      WHERE user_id = $1
      ORDER BY uploaded_at DESC
      LIMIT $2 OFFSET $3
    `;

    const files = await this.db.query<FileRecord>(filesSql, [userId, limit, offset]);

    return { files, total };
  }

  /**
   * Find a file by S3 key
   */
  async findByS3Key(s3Key: string): Promise<FileRecord | null> {
    const sql = `
      SELECT id, user_id as "userId", file_name as "fileName", 
             file_size as "fileSize", mime_type as "mimeType",
             s3_key as "s3Key", s3_bucket as "s3Bucket",
             uploaded_at as "uploadedAt", metadata
      FROM files
      WHERE s3_key = $1
    `;

    return await this.db.queryOne<FileRecord>(sql, [s3Key]);
  }

  /**
   * Get total storage used by a user (in bytes)
   */
  async getTotalStorageByUser(userId: string): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(file_size), 0) as total
      FROM files
      WHERE user_id = $1
    `;

    const result = await this.db.queryOne<{ total: string }>(sql, [userId]);
    return result ? parseInt(result.total, 10) : 0;
  }

  /**
   * Delete all files for a user
   * Returns the number of files deleted
   */
  async deleteByUserId(userId: string): Promise<number> {
    const sql = 'DELETE FROM files WHERE user_id = $1 RETURNING id';
    const result = await this.db.query(sql, [userId]);
    return result.length;
  }
}
