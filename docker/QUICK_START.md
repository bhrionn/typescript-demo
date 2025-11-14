# Docker Quick Start Guide

## Start Everything

```bash
npm run docker:start
```

This command will:

1. Start all Docker services
2. Wait for them to be healthy
3. Display access URLs and test credentials

## Access the Application

- **Web App**: http://localhost:3000
- **API**: http://localhost:4000
- **PostgreSQL**: localhost:5432
- **LocalStack**: http://localhost:4566

## Test Credentials

**Cognito User**:

- Email: test@example.com
- Password: TestPass123!

**Database**:

- Host: localhost
- Port: 5432
- Database: appdb
- Username: user
- Password: pass

## Common Commands

```bash
# View logs
npm run docker:logs

# Stop everything
npm run docker:down

# Restart services
npm run docker:restart

# Clean up (removes data)
npm run docker:clean

# Rebuild images
npm run docker:build
```

## Troubleshooting

### Port Already in Use

If you get port conflicts, check what's using the ports:

```bash
lsof -i :3000  # Web
lsof -i :4000  # API
lsof -i :5432  # PostgreSQL
lsof -i :4566  # LocalStack
```

### Services Not Starting

Check service status:

```bash
npm run docker:ps
```

View specific service logs:

```bash
docker-compose logs web
docker-compose logs api
docker-compose logs postgres
docker-compose logs localstack
```

### Reset Everything

```bash
npm run docker:clean
npm run docker:build
npm run docker:start
```

## Development Workflow

1. Start Docker: `npm run docker:start`
2. Open web app: http://localhost:3000
3. Make code changes (hot reload enabled)
4. View logs: `npm run docker:logs`
5. Stop when done: `npm run docker:down`

## LocalStack AWS Services

LocalStack provides local AWS service emulation:

### S3 Buckets

- `typescript-demo-dev-web-app` - Web application assets
- `typescript-demo-dev-file-uploads` - User file uploads (encrypted)

### Secrets Manager

- `typescript-demo-dev-db-credentials` - Database credentials
- `typescript-demo-dev-jwt-secret` - JWT signing secret

### Cognito

- User Pool ID: `us-east-1_localpool`
- Client ID: `local-client-id`
- Test user: test@example.com / TestPass123!

### Using AWS CLI with LocalStack

```bash
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# List S3 buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List secrets
aws --endpoint-url=http://localhost:4566 secretsmanager list-secrets

# Describe Cognito User Pool
aws --endpoint-url=http://localhost:4566 cognito-idp describe-user-pool \
  --user-pool-id us-east-1_localpool
```

## Database Access

### Using psql

```bash
psql -h localhost -p 5432 -U user -d appdb
# Password: pass
```

### Using Docker

```bash
docker-compose exec postgres psql -U user -d appdb
```

### Sample Queries

```sql
-- List all users
SELECT * FROM users;

-- List all files
SELECT * FROM files;

-- Check table structure
\d users
\d files
```

## Hot Reload

Both web and API support hot reload:

- **Web**: Changes to files in `web-app/src/` trigger automatic reload
- **API**: Changes to files in `api/src/` trigger automatic restart

## Production Builds

To test production builds:

```bash
# Build production images
docker-compose build --target production web
docker-compose build --target production api

# Run production web
docker run -p 80:80 typescript-demo-web

# Run production API
docker run -p 4000:4000 typescript-demo-api
```

## Health Checks

Services include health checks:

- **PostgreSQL**: Checks if database accepts connections
- **LocalStack**: Checks if services are ready

View health status:

```bash
docker-compose ps
```

## Network

All services run on a custom bridge network (`app-network`), allowing them to communicate using service names:

- Web can access API at `http://api:4000`
- API can access PostgreSQL at `postgres:5432`
- API can access LocalStack at `http://localstack:4566`

## Data Persistence

Data is persisted in Docker volumes:

- `postgres-data`: Database data
- `localstack-data`: LocalStack state

To remove all data:

```bash
npm run docker:clean
```
