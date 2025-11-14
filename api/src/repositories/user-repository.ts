/**
 * User repository interface
 * Interface Segregation: Specific interface for user operations
 */

import { User } from '../types/database';
import { IBaseRepository } from './base-repository';

/**
 * User-specific repository operations
 */
export interface IUserRepository extends IBaseRepository<User> {
  /**
   * Find a user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find a user by provider and provider ID
   */
  findByProvider(provider: 'google' | 'microsoft', providerId: string): Promise<User | null>;

  /**
   * Create or update a user (upsert)
   */
  upsert(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;

  /**
   * Update last login timestamp
   */
  updateLastLogin(userId: string): Promise<void>;
}
