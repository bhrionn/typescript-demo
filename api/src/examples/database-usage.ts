/**
 * Example usage of database connection and repositories
 * This file demonstrates how to use the database layer
 */

import { createDatabaseConnection } from '../utils/database-connection';
import { getRepositoryFactory } from '../repositories/repository-factory';

/**
 * Example: Initialize database connection and repositories
 */
async function initializeDatabase() {
  // Create database connection
  const db = createDatabaseConnection({
    useSecretsManager: false, // Use connection string for local dev
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Disable SSL for local development
  });

  // Connect to database
  await db.connect();

  // Check connection health
  const isHealthy = await db.isHealthy();
  console.log('Database connection healthy:', isHealthy);

  return db;
}

/**
 * Example: User repository operations
 */
async function userRepositoryExample() {
  const db = await initializeDatabase();
  const factory = getRepositoryFactory(db);
  const userRepo = factory.createUserRepository();

  try {
    // Create a new user
    const newUser = await userRepo.create({
      email: 'user@example.com',
      provider: 'google',
      providerId: 'google-12345',
      lastLoginAt: new Date(),
    });
    console.log('Created user:', newUser);

    // Find user by email
    const foundUser = await userRepo.findByEmail('user@example.com');
    console.log('Found user by email:', foundUser);

    // Find user by provider
    const providerUser = await userRepo.findByProvider('google', 'google-12345');
    console.log('Found user by provider:', providerUser);

    // Upsert user (create or update)
    const upsertedUser = await userRepo.upsert({
      email: 'user@example.com',
      provider: 'google',
      providerId: 'google-12345',
      lastLoginAt: new Date(),
    });
    console.log('Upserted user:', upsertedUser);

    // Update last login
    await userRepo.updateLastLogin(newUser.id);
    console.log('Updated last login for user:', newUser.id);

    // Find all users
    const allUsers = await userRepo.findAll();
    console.log('All users:', allUsers);
  } finally {
    await db.disconnect();
  }
}

/**
 * Example: File repository operations
 */
async function fileRepositoryExample() {
  const db = await initializeDatabase();
  const factory = getRepositoryFactory(db);
  const fileRepo = factory.createFileRepository();
  const userRepo = factory.createUserRepository();

  try {
    // First, create a user to associate files with
    const user = await userRepo.upsert({
      email: 'fileuser@example.com',
      provider: 'microsoft',
      providerId: 'microsoft-67890',
      lastLoginAt: new Date(),
    });

    // Create a file record
    const newFile = await fileRepo.create({
      userId: user.id,
      fileName: 'example.pdf',
      fileSize: 1024000, // 1MB
      mimeType: 'application/pdf',
      s3Key: 'uploads/user123/example.pdf',
      s3Bucket: 'my-bucket',
      metadata: {
        originalName: 'example.pdf',
        uploadedFrom: 'web-app',
      },
    });
    console.log('Created file:', newFile);

    // Find file by ID
    const foundFile = await fileRepo.findById(newFile.id);
    console.log('Found file by ID:', foundFile);

    // Find all files for a user
    const userFiles = await fileRepo.findByUserId(user.id);
    console.log('User files:', userFiles);

    // Find files with pagination
    const paginatedFiles = await fileRepo.findByUserIdPaginated(user.id, 10, 0);
    console.log('Paginated files:', paginatedFiles);

    // Get total storage used by user
    const totalStorage = await fileRepo.getTotalStorageByUser(user.id);
    console.log('Total storage used:', totalStorage, 'bytes');

    // Find file by S3 key
    const s3File = await fileRepo.findByS3Key('uploads/user123/example.pdf');
    console.log('Found file by S3 key:', s3File);
  } finally {
    await db.disconnect();
  }
}

/**
 * Example: Using transactions
 */
async function transactionExample() {
  const db = await initializeDatabase();

  try {
    // Execute multiple operations in a transaction
    await db.transaction(async (txDb) => {
      // Create user within transaction
      const txFactory = getRepositoryFactory(txDb);
      const txUserRepo = txFactory.createUserRepository();
      const txFileRepo = txFactory.createFileRepository();

      const user = await txUserRepo.create({
        email: 'txuser@example.com',
        provider: 'google',
        providerId: 'google-tx-123',
        lastLoginAt: new Date(),
      });

      // Create file within same transaction
      await txFileRepo.create({
        userId: user.id,
        fileName: 'transaction-file.txt',
        fileSize: 500,
        mimeType: 'text/plain',
        s3Key: 'uploads/tx/file.txt',
        s3Bucket: 'my-bucket',
      });

      // If any operation fails, both will be rolled back
    });

    console.log('Transaction completed successfully');
  } catch (error) {
    console.error('Transaction failed:', error);
  } finally {
    await db.disconnect();
  }
}

/**
 * Example: Production configuration with Secrets Manager
 */
async function productionExample() {
  const db = createDatabaseConnection({
    useSecretsManager: true,
    secretName: 'typescript-demo-prod-db-credentials',
    ssl: true, // Enable SSL for production
    maxConnections: 20,
  });

  await db.connect();

  // Use repositories as normal
  const factory = getRepositoryFactory(db);
  const userRepo = factory.createUserRepository();

  // Example: perform operations
  const users = await userRepo.findAll();
  console.log('Found users:', users.length);

  await db.disconnect();
}

// Export examples for documentation purposes
export {
  initializeDatabase,
  userRepositoryExample,
  fileRepositoryExample,
  transactionExample,
  productionExample,
};
