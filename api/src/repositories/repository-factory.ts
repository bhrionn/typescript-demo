/**
 * Repository factory for creating repository instances
 * Dependency Inversion: Depend on factory abstraction
 * Single Responsibility: Creates and manages repository instances
 */

import { IDatabaseConnection, IRepositoryFactory } from './base-repository';
import { IUserRepository } from './user-repository';
import { IFileRepository } from './file-repository';
import { UserRepository } from './user-repository.impl';
import { FileRepository } from './file-repository.impl';

/**
 * Factory for creating repository instances
 */
export class RepositoryFactory implements IRepositoryFactory {
  constructor(private db: IDatabaseConnection) {}

  /**
   * Create a UserRepository instance
   */
  createUserRepository(): IUserRepository {
    return new UserRepository(this.db);
  }

  /**
   * Create a FileRepository instance
   */
  createFileRepository(): IFileRepository {
    return new FileRepository(this.db);
  }
}

/**
 * Singleton instance for the repository factory
 */
let factoryInstance: RepositoryFactory | null = null;

/**
 * Get or create the repository factory instance
 */
export function getRepositoryFactory(db: IDatabaseConnection): RepositoryFactory {
  if (!factoryInstance) {
    factoryInstance = new RepositoryFactory(db);
  }
  return factoryInstance;
}

/**
 * Reset the factory instance (useful for testing)
 */
export function resetRepositoryFactory(): void {
  factoryInstance = null;
}
