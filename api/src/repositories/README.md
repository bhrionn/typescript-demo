# Repository Layer

This directory contains the data access layer for the application, following SOLID design principles.

## Architecture

The repository layer is organized following these principles:

- **Single Responsibility**: Each repository handles one entity type
- **Interface Segregation**: Specific interfaces for different operations
- **Dependency Inversion**: Depend on abstractions (interfaces), not implementations
- **Open-Closed**: Can be extended without modification

## Components

### Interfaces

- `base-repository.ts` - Base interfaces for all repositories
  - `IBaseRepository<T>` - Common CRUD operations
  - `IDatabaseConnection` - Database connection abstraction
  - `IQueryBuilder<T>` - Type-safe query building
  - `IRepositoryFactory` - Factory for creating repositories

- `user-repository.ts` - User-specific repository interface
  - `IUserRepository` - Extends IBaseRepository with user-specific methods

- `file-repository.ts` - File-specific repository interface
  - `IFileRepository` - Extends IBaseRepository with file-specific methods

### Implementations

- `user-repository.impl.ts` - PostgreSQL implementation of IUserRepository
- `file-repository.impl.ts` - PostgreSQL implementation of IFileRepository
- `repository-factory.ts` - Factory for creating repository instances

## Usage

### Initialize Database Connection

```typescript
import { createDatabaseConnection } from '../utils/database-connection';

// Local development
const db = createDatabaseConnection({
  useSecretsManager: false,
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// Production with AWS Secrets Manager
const db = createDatabaseConnection({
  useSecretsManager: true,
  secretName: 'my-db-credentials',
  ssl: true,
});

await db.connect();
```

### Create Repositories

```typescript
import { getRepositoryFactory } from './repositories';

const factory = getRepositoryFactory(db);
const userRepo = factory.createUserRepository();
const fileRepo = factory.createFileRepository();
```

### User Repository Operations

```typescript
// Create a user
const user = await userRepo.create({
  email: 'user@example.com',
  provider: 'google',
  providerId: 'google-123',
  lastLoginAt: new Date(),
});

// Find by email
const foundUser = await userRepo.findByEmail('user@example.com');

// Find by provider
const providerUser = await userRepo.findByProvider('google', 'google-123');

// Upsert (create or update)
const upsertedUser = await userRepo.upsert({
  email: 'user@example.com',
  provider: 'google',
  providerId: 'google-123',
  lastLoginAt: new Date(),
});

// Update last login
await userRepo.updateLastLogin(user.id);

// Find all users
const allUsers = await userRepo.findAll();

// Delete user
await userRepo.delete(user.id);
```

### File Repository Operations

```typescript
// Create a file record
const file = await fileRepo.create({
  userId: user.id,
  fileName: 'document.pdf',
  fileSize: 1024000,
  mimeType: 'application/pdf',
  s3Key: 'uploads/user123/document.pdf',
  s3Bucket: 'my-bucket',
  metadata: { tags: ['important'] },
});

// Find by user ID
const userFiles = await fileRepo.findByUserId(user.id);

// Find with pagination
const { files, total } = await fileRepo.findByUserIdPaginated(user.id, 10, 0);

// Get total storage
const totalBytes = await fileRepo.getTotalStorageByUser(user.id);

// Find by S3 key
const s3File = await fileRepo.findByS3Key('uploads/user123/document.pdf');

// Delete all user files
const deletedCount = await fileRepo.deleteByUserId(user.id);
```

### Using Transactions

```typescript
await db.transaction(async (txDb) => {
  const txFactory = getRepositoryFactory(txDb);
  const txUserRepo = txFactory.createUserRepository();
  const txFileRepo = txFactory.createFileRepository();

  // Create user
  const user = await txUserRepo.create({
    email: 'user@example.com',
    provider: 'google',
    providerId: 'google-123',
    lastLoginAt: new Date(),
  });

  // Create file
  await txFileRepo.create({
    userId: user.id,
    fileName: 'file.txt',
    fileSize: 100,
    mimeType: 'text/plain',
    s3Key: 'uploads/file.txt',
    s3Bucket: 'bucket',
  });

  // Both operations committed together
  // If any fails, both are rolled back
});
```

## Security Features

### SQL Injection Prevention

All queries use **prepared statements** with parameterized queries:

```typescript
// ✓ SAFE - Uses prepared statement
const user = await userRepo.findByEmail(email);

// ✗ UNSAFE - Never do this
const sql = `SELECT * FROM users WHERE email = '${email}'`;
```

### SSL/TLS Encryption

Database connections support SSL/TLS encryption:

```typescript
const db = createDatabaseConnection({
  ssl: true, // Enable SSL/TLS
});
```

### Credentials Management

Production credentials are retrieved from AWS Secrets Manager:

```typescript
const db = createDatabaseConnection({
  useSecretsManager: true,
  secretName: 'my-db-credentials',
});
```

## Connection Pooling

The database connection manager uses connection pooling for optimal performance:

- Default pool size: 10 connections
- Configurable via `maxConnections` option
- Automatic connection reuse
- Idle connection timeout: 30 seconds

```typescript
const db = createDatabaseConnection({
  maxConnections: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

## Error Handling

All repository methods throw errors on failure:

```typescript
try {
  const user = await userRepo.findById(userId);
  if (!user) {
    // Handle not found
  }
} catch (error) {
  // Handle database error
  console.error('Database error:', error);
}
```

## Testing

See `api/src/examples/database-usage.ts` for complete usage examples.

## Best Practices

1. **Always use the factory** to create repository instances
2. **Use transactions** for operations that must succeed or fail together
3. **Close connections** when done (especially in Lambda functions)
4. **Handle null results** - findById and findOne return null if not found
5. **Use prepared statements** - never concatenate user input into SQL
6. **Enable SSL** in production environments
7. **Use Secrets Manager** for production credentials

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 2.5**: Database operations with prepared statements
- **Requirement 3.5**: RDS connection with encryption
- **Requirement 10.1**: Credentials from AWS Secrets Manager
- **Requirement 10.2**: SSL/TLS connection configuration
- **Requirement 10.3**: Connection pooling
- **Requirement 10.4**: Prepared statements to prevent SQL injection
- **Requirement 10.5**: CRUD operations for users and files
