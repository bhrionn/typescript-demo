/**
 * Database connection manager with connection pooling
 * Single Responsibility: Manages PostgreSQL connections
 * Requirements: 10.1, 10.2, 10.3
 */

import { Pool, PoolConfig } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { IDatabaseConnection } from '../repositories/base-repository';

interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
}

interface DatabaseConfig {
  useSecretsManager: boolean;
  secretName?: string;
  connectionString?: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Database connection manager with connection pooling and SSL/TLS support
 */
export class DatabaseConnection implements IDatabaseConnection {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private secretsClient: SecretsManagerClient;

  constructor(config: DatabaseConfig) {
    this.config = {
      maxConnections: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: true,
      ...config,
    };

    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT }),
    });
  }

  /**
   * Retrieve database credentials from AWS Secrets Manager
   */
  private async getCredentialsFromSecretsManager(): Promise<DatabaseCredentials> {
    if (!this.config.secretName) {
      throw new Error('Secret name is required when using Secrets Manager');
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: this.config.secretName,
      });

      const response = await this.secretsClient.send(command);

      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      const secret = JSON.parse(response.SecretString);

      return {
        username: secret.username,
        password: secret.password,
        host: secret.host,
        port: secret.port || 5432,
        database: secret.database || secret.dbname,
      };
    } catch (error) {
      throw new Error(`Failed to retrieve credentials from Secrets Manager: ${error}`);
    }
  }

  /**
   * Create pool configuration with SSL/TLS settings
   */
  private async createPoolConfig(): Promise<PoolConfig> {
    if (this.config.useSecretsManager) {
      const credentials = await this.getCredentialsFromSecretsManager();

      return {
        user: credentials.username,
        password: credentials.password,
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        ssl: this.config.ssl
          ? {
              rejectUnauthorized: true,
              // For RDS, AWS handles certificate validation
            }
          : false,
      };
    } else {
      // Use connection string for local development
      return {
        connectionString: this.config.connectionString,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        ssl: this.config.ssl
          ? {
              rejectUnauthorized: false, // For local development
            }
          : false,
      };
    }
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return; // Already connected
    }

    try {
      const poolConfig = await this.createPoolConfig();
      this.pool = new Pool(poolConfig);

      // Test the connection
      const client = await this.pool.connect();
      client.release();

      console.log('Database connection established successfully');
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error}`);
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection closed');
    }
  }

  /**
   * Execute a query with parameters (using prepared statements)
   */
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Execute a query and return a single result
   */
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Execute a query within a transaction
   */
  async transaction<T>(callback: (connection: IDatabaseConnection) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create a transaction-scoped connection wrapper
      const transactionConnection: IDatabaseConnection = {
        connect: async () => {},
        disconnect: async () => {},
        query: async <R>(sql: string, params?: any[]): Promise<R[]> => {
          const result = await client.query(sql, params);
          return result.rows as R[];
        },
        queryOne: async <R>(sql: string, params?: any[]): Promise<R | null> => {
          const result = await client.query(sql, params);
          return result.rows.length > 0 ? result.rows[0] : null;
        },
        transaction: async <R>(_cb: (conn: IDatabaseConnection) => Promise<R>): Promise<R> => {
          throw new Error('Nested transactions are not supported');
        },
        isHealthy: async () => true,
      };

      const result = await callback(transactionConnection);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if the connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the underlying pool for advanced use cases
   */
  getPool(): Pool | null {
    return this.pool;
  }
}

/**
 * Factory function to create a database connection
 */
export function createDatabaseConnection(config?: Partial<DatabaseConfig>): DatabaseConnection {
  const defaultConfig: DatabaseConfig = {
    useSecretsManager: process.env.NODE_ENV === 'production',
    secretName: process.env.DB_SECRET_NAME,
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  };

  return new DatabaseConnection({ ...defaultConfig, ...config });
}
