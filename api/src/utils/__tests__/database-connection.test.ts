/**
 * Unit tests for Database Connection
 * Requirements: 10.4
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock dependencies BEFORE imports
jest.mock('pg');
jest.mock('@aws-sdk/client-secrets-manager');

import { DatabaseConnection, createDatabaseConnection } from '../database-connection';
import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const MockPool = Pool as jest.MockedClass<typeof Pool>;
const MockSecretsManagerClient = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>;

describe('DatabaseConnection', () => {
  let mockPoolInstance: any;
  let mockSecretsManagerSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Pool instance
    mockPoolInstance = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    };

    MockPool.mockImplementation(() => mockPoolInstance);

    // Mock Secrets Manager
    mockSecretsManagerSend = jest.fn();
    MockSecretsManagerClient.mockImplementation(
      () =>
        ({
          send: mockSecretsManagerSend,
        }) as any
    );
  });

  describe('Connection with connection string', () => {
    it('should connect successfully with connection string', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        ssl: false,
      });

      await db.connect();

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://user:pass@localhost:5432/testdb',
          ssl: false,
        })
      );
      expect(mockPoolInstance.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      await db.connect();

      expect(MockPool).toHaveBeenCalledTimes(1);
    });

    it('should throw error when connection fails', async () => {
      mockPoolInstance.connect.mockRejectedValue(new Error('Connection refused'));

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await expect(db.connect()).rejects.toThrow('Failed to connect to database');
    });
  });

  describe('Connection with Secrets Manager', () => {
    it('should connect using credentials from Secrets Manager', async () => {
      const mockCredentials = {
        username: 'dbuser',
        password: 'dbpass',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
      };

      mockSecretsManagerSend.mockResolvedValue({
        SecretString: JSON.stringify(mockCredentials),
      });

      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const db = new DatabaseConnection({
        useSecretsManager: true,
        secretName: 'my-db-secret',
        ssl: true,
      });

      await db.connect();

      expect(mockSecretsManagerSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'dbuser',
          password: 'dbpass',
          host: 'db.example.com',
          port: 5432,
          database: 'mydb',
        })
      );
    });

    it('should handle dbname field in secrets', async () => {
      const mockCredentials = {
        username: 'dbuser',
        password: 'dbpass',
        host: 'db.example.com',
        port: 5432,
        dbname: 'mydb',
      };

      mockSecretsManagerSend.mockResolvedValue({
        SecretString: JSON.stringify(mockCredentials),
      });

      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const db = new DatabaseConnection({
        useSecretsManager: true,
        secretName: 'my-db-secret',
      });

      await db.connect();

      expect(MockPool).toHaveBeenCalledWith(
        expect.objectContaining({
          database: 'mydb',
        })
      );
    });

    it('should throw error when secret name is missing', async () => {
      const db = new DatabaseConnection({
        useSecretsManager: true,
      });

      await expect(db.connect()).rejects.toThrow(
        'Secret name is required when using Secrets Manager'
      );
    });

    it('should throw error when secret value is empty', async () => {
      mockSecretsManagerSend.mockResolvedValue({});

      const db = new DatabaseConnection({
        useSecretsManager: true,
        secretName: 'my-db-secret',
      });

      await expect(db.connect()).rejects.toThrow('Failed to connect to database');
    });

    it('should throw error when Secrets Manager fails', async () => {
      mockSecretsManagerSend.mockRejectedValue(new Error('Access denied'));

      const db = new DatabaseConnection({
        useSecretsManager: true,
        secretName: 'my-db-secret',
      });

      await expect(db.connect()).rejects.toThrow('Failed to connect to database');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.end.mockResolvedValue(undefined);

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      await db.disconnect();

      expect(mockPoolInstance.end).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await expect(db.disconnect()).resolves.not.toThrow();
    });
  });

  describe('query', () => {
    it('should execute query successfully', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
      });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      const result = await db.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(result).toEqual([{ id: 1, name: 'Test' }]);
      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });

    it('should throw error when not connected', async () => {
      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await expect(db.query('SELECT 1')).rejects.toThrow(
        'Database not connected. Call connect() first.'
      );
    });

    it('should throw error when query fails', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.query.mockRejectedValue(new Error('Syntax error'));

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      await expect(db.query('INVALID SQL')).rejects.toThrow('Query execution failed');
    });
  });

  describe('queryOne', () => {
    it('should return first result', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ id: 1, name: 'Test' }],
      });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      const result = await db.queryOne('SELECT * FROM users WHERE id = $1', [1]);

      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('should return null when no results', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.query.mockResolvedValue({ rows: [] });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      const result = await db.queryOne('SELECT * FROM users WHERE id = $1', [999]);

      expect(result).toBeNull();
    });
  });

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const mockClient = {
        release: jest.fn(),
        query: jest.fn(),
      };

      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [] });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();

      const result = await db.transaction(async (conn) => {
        await conn.query('INSERT INTO users (name) VALUES ($1)', ['Test']);
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        release: jest.fn(),
        query: jest.fn(),
      };

      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [] });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();

      await expect(
        db.transaction(async () => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error for nested transactions', async () => {
      const mockClient = {
        release: jest.fn(),
        query: jest.fn(),
      };

      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [] });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();

      await expect(
        db.transaction(async (conn) => {
          await conn.transaction(async () => {
            return 'nested';
          });
        })
      ).rejects.toThrow('Nested transactions are not supported');
    });
  });

  describe('isHealthy', () => {
    it('should return true when connection is healthy', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.query.mockResolvedValue({ rows: [{ result: 1 }] });

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      const result = await db.isHealthy();

      expect(result).toBe(true);
      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when not connected', async () => {
      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      const result = await db.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when query fails', async () => {
      const mockClient = { release: jest.fn() };
      mockPoolInstance.connect.mockResolvedValue(mockClient);
      mockPoolInstance.query.mockRejectedValue(new Error('Connection lost'));

      const db = new DatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      });

      await db.connect();
      const result = await db.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('createDatabaseConnection factory', () => {
    it('should create connection with default config', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/testdb';

      const db = createDatabaseConnection();

      expect(db).toBeInstanceOf(DatabaseConnection);
    });

    it('should create connection with custom config', () => {
      const db = createDatabaseConnection({
        useSecretsManager: false,
        connectionString: 'postgresql://custom/db',
        maxConnections: 20,
      });

      expect(db).toBeInstanceOf(DatabaseConnection);
    });

    it('should use Secrets Manager in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DB_SECRET_NAME = 'prod-db-secret';

      const db = createDatabaseConnection();

      expect(db).toBeInstanceOf(DatabaseConnection);
    });
  });
});
