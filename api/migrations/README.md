# Database Migrations

This directory contains SQL migration scripts for the database schema.

## Migration Files

Migrations are numbered sequentially and executed in order:

- `001_create_users_table.sql` - Creates the users table with indexes
- `002_create_files_table.sql` - Creates the files table with foreign keys and indexes

## Running Migrations

### Using npm scripts

```bash
# Run all pending migrations
npm run migrate:up

# Rollback last migration (manual process)
npm run migrate:down
```

### Using ts-node directly

```bash
# Run migrations
npx ts-node migrations/run-migrations.ts

# Rollback (not yet implemented)
npx ts-node migrations/run-migrations.ts rollback
```

## Migration Tracking

Migrations are tracked in the `schema_migrations` table, which is automatically created on first run. This table records:

- Migration ID
- Migration name
- Filename
- Execution timestamp

## Creating New Migrations

1. Create a new SQL file with the naming pattern: `{number}_{description}.sql`
   - Example: `003_add_user_preferences.sql`
2. Write your SQL DDL statements
3. Run the migration using `npm run migrate:up`

## Best Practices

- Always use `IF NOT EXISTS` for CREATE statements
- Include rollback instructions in comments
- Test migrations on a development database first
- Keep migrations small and focused
- Never modify existing migration files after they've been run in production

## Local Development

For local development with Docker, migrations are automatically run via the `docker/init-db.sql` script when the database container starts.

## Production Deployment

For production deployments:

1. Ensure `DATABASE_URL` or Secrets Manager is configured
2. Run migrations as part of the deployment pipeline
3. Verify migrations completed successfully before deploying application code
4. Keep backups before running migrations

## Environment Variables

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string (for local/dev)
- `DB_SECRET_NAME` - AWS Secrets Manager secret name (for production)
- `AWS_REGION` - AWS region (for production)
- `NODE_ENV` - Environment (development/production)
