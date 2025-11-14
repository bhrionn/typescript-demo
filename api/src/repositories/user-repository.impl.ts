/**
 * User repository implementation
 * Requirements: 10.4, 10.5
 * Uses prepared statements to prevent SQL injection
 */

import { User } from '../types/database';
import { IUserRepository } from './user-repository';
import { IDatabaseConnection } from './base-repository';

/**
 * PostgreSQL implementation of User repository
 * Single Responsibility: Handles user data persistence
 */
export class UserRepository implements IUserRepository {
  constructor(private db: IDatabaseConnection) {}

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | null> {
    const sql = `
      SELECT id, email, provider, provider_id as "providerId", 
             created_at as "createdAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE id = $1
    `;

    return await this.db.queryOne<User>(sql, [id]);
  }

  /**
   * Find all users matching criteria
   */
  async findAll(criteria?: Partial<User>): Promise<User[]> {
    let sql = `
      SELECT id, email, provider, provider_id as "providerId", 
             created_at as "createdAt", last_login_at as "lastLoginAt"
      FROM users
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (criteria) {
      if (criteria.email) {
        conditions.push(`email = $${params.length + 1}`);
        params.push(criteria.email);
      }
      if (criteria.provider) {
        conditions.push(`provider = $${params.length + 1}`);
        params.push(criteria.provider);
      }
      if (criteria.providerId) {
        conditions.push(`provider_id = $${params.length + 1}`);
        params.push(criteria.providerId);
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY created_at DESC';

    return await this.db.query<User>(sql, params);
  }

  /**
   * Create a new user
   */
  async create(data: Omit<User, 'id'>): Promise<User> {
    const sql = `
      INSERT INTO users (email, provider, provider_id, last_login_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, provider, provider_id as "providerId", 
                created_at as "createdAt", last_login_at as "lastLoginAt"
    `;

    const result = await this.db.queryOne<User>(sql, [
      data.email,
      data.provider,
      data.providerId,
      data.lastLoginAt || null,
    ]);

    if (!result) {
      throw new Error('Failed to create user');
    }

    return result;
  }

  /**
   * Update an existing user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.email !== undefined) {
      updates.push(`email = $${params.length + 1}`);
      params.push(data.email);
    }
    if (data.provider !== undefined) {
      updates.push(`provider = $${params.length + 1}`);
      params.push(data.provider);
    }
    if (data.providerId !== undefined) {
      updates.push(`provider_id = $${params.length + 1}`);
      params.push(data.providerId);
    }
    if (data.lastLoginAt !== undefined) {
      updates.push(`last_login_at = $${params.length + 1}`);
      params.push(data.lastLoginAt);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);

    const sql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, email, provider, provider_id as "providerId", 
                created_at as "createdAt", last_login_at as "lastLoginAt"
    `;

    const result = await this.db.queryOne<User>(sql, params);

    if (!result) {
      throw new Error(`User with id ${id} not found`);
    }

    return result;
  }

  /**
   * Delete a user by ID
   */
  async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = $1';
    const result = await this.db.query(sql, [id]);
    return result.length > 0;
  }

  /**
   * Check if a user exists
   */
  async exists(id: string): Promise<boolean> {
    const sql = 'SELECT 1 FROM users WHERE id = $1';
    const result = await this.db.queryOne(sql, [id]);
    return result !== null;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT id, email, provider, provider_id as "providerId", 
             created_at as "createdAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE email = $1
    `;

    return await this.db.queryOne<User>(sql, [email]);
  }

  /**
   * Find a user by provider and provider ID
   */
  async findByProvider(provider: 'google' | 'microsoft', providerId: string): Promise<User | null> {
    const sql = `
      SELECT id, email, provider, provider_id as "providerId", 
             created_at as "createdAt", last_login_at as "lastLoginAt"
      FROM users
      WHERE provider = $1 AND provider_id = $2
    `;

    return await this.db.queryOne<User>(sql, [provider, providerId]);
  }

  /**
   * Create or update a user (upsert)
   */
  async upsert(user: Omit<User, 'id'>): Promise<User> {
    const sql = `
      INSERT INTO users (email, provider, provider_id, last_login_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (provider, provider_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        last_login_at = EXCLUDED.last_login_at
      RETURNING id, email, provider, provider_id as "providerId", 
                created_at as "createdAt", last_login_at as "lastLoginAt"
    `;

    const result = await this.db.queryOne<User>(sql, [
      user.email,
      user.provider,
      user.providerId,
      user.lastLoginAt || new Date(),
    ]);

    if (!result) {
      throw new Error('Failed to upsert user');
    }

    return result;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    const sql = `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.query(sql, [userId]);
  }
}
