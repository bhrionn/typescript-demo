/**
 * Database migration runner
 * Executes SQL migration files in order
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection, createDatabaseConnection } from '../src/utils/database-connection';

interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
}

/**
 * Load all migration files from the migrations directory
 */
function loadMigrations(): Migration[] {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir);

  const migrations: Migration[] = files
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${file}`);
      }

      const id = parseInt(match[1], 10);
      const name = match[2];
      const filepath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filepath, 'utf-8');

      return { id, name, filename: file, sql };
    })
    .sort((a, b) => a.id - b.id);

  return migrations;
}

/**
 * Create migrations tracking table
 */
async function createMigrationsTable(db: DatabaseConnection): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `;

  await db.query(sql);
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations(db: DatabaseConnection): Promise<number[]> {
  const sql = 'SELECT id FROM schema_migrations ORDER BY id';
  const results = await db.query<{ id: number }>(sql);
  return results.map((row) => row.id);
}

/**
 * Record a migration as executed
 */
async function recordMigration(db: DatabaseConnection, migration: Migration): Promise<void> {
  const sql = `
    INSERT INTO schema_migrations (id, name, filename)
    VALUES ($1, $2, $3)
  `;

  await db.query(sql, [migration.id, migration.name, migration.filename]);
}

/**
 * Run pending migrations
 */
async function runMigrations(): Promise<void> {
  const db = createDatabaseConnection();

  try {
    console.log('Connecting to database...');
    await db.connect();

    console.log('Creating migrations tracking table...');
    await createMigrationsTable(db);

    console.log('Loading migration files...');
    const migrations = loadMigrations();
    console.log(`Found ${migrations.length} migration(s)`);

    console.log('Checking executed migrations...');
    const executedIds = await getExecutedMigrations(db);
    console.log(`Already executed: ${executedIds.length} migration(s)`);

    const pendingMigrations = migrations.filter((m) => !executedIds.includes(m.id));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to run');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migration(s)...`);

    for (const migration of pendingMigrations) {
      console.log(`\nExecuting migration ${migration.id}: ${migration.name}`);

      await db.transaction(async (txDb) => {
        // Execute the migration SQL
        await txDb.query(migration.sql);

        // Record the migration
        await recordMigration(db, migration);
      });

      console.log(`✓ Migration ${migration.id} completed successfully`);
    }

    console.log('\n✓ All migrations completed successfully');
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

/**
 * Rollback the last migration
 */
async function rollbackMigration(): Promise<void> {
  console.log('Rollback functionality not implemented yet');
  console.log('Manual rollback required by running SQL scripts');
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'rollback') {
    rollbackMigration().catch((error) => {
      console.error('Rollback failed:', error);
      process.exit(1);
    });
  } else {
    runMigrations().catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
  }
}

export { runMigrations, rollbackMigration };
