/**
 * Base repository interface for data access abstraction
 * Following SOLID principles:
 * - Interface Segregation: Specific interfaces for different operations
 * - Dependency Inversion: Depend on abstractions, not concrete implementations
 */

/**
 * Base repository interface with common CRUD operations
 */
export interface IBaseRepository<T, ID = string> {
  /**
   * Find a record by its ID
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find all records matching the criteria
   */
  findAll(criteria?: Partial<T>): Promise<T[]>;

  /**
   * Create a new record
   */
  create(data: Omit<T, 'id'>): Promise<T>;

  /**
   * Update an existing record
   */
  update(id: ID, data: Partial<T>): Promise<T>;

  /**
   * Delete a record by its ID
   */
  delete(id: ID): Promise<boolean>;

  /**
   * Check if a record exists
   */
  exists(id: ID): Promise<boolean>;
}

/**
 * Database connection interface
 * Single Responsibility: Manages database connections only
 */
export interface IDatabaseConnection {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Execute a query with parameters
   */
  query<T>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * Execute a query and return a single result
   */
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;

  /**
   * Execute a query within a transaction
   */
  transaction<T>(callback: (connection: IDatabaseConnection) => Promise<T>): Promise<T>;

  /**
   * Check if the connection is healthy
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Query builder interface for type-safe queries
 * Open-Closed Principle: Can be extended without modification
 */
export interface IQueryBuilder<T> {
  select(...columns: (keyof T)[]): IQueryBuilder<T>;
  where(column: keyof T, operator: string, value: any): IQueryBuilder<T>;
  orderBy(column: keyof T, direction: 'ASC' | 'DESC'): IQueryBuilder<T>;
  limit(count: number): IQueryBuilder<T>;
  offset(count: number): IQueryBuilder<T>;
  build(): { sql: string; params: any[] };
}

/**
 * Repository factory interface
 * Dependency Inversion: Depend on factory abstraction
 */
export interface IRepositoryFactory {
  createUserRepository(): any; // Will be typed properly when UserRepository is implemented
  createFileRepository(): any; // Will be typed properly when FileRepository is implemented
}
