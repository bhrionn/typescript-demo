# Docker Local Development Environment

This directory contains configuration files for running the application locally using Docker.

## Overview

The Docker setup includes:

- **web**: React frontend application (port 3000)
- **api**: Node.js backend API (port 4000)
- **postgres**: PostgreSQL database (port 5432)
- **localstack**: AWS service emulation (port 4566)

## Quick Start

### Start the environment

```bash
npm run docker:up
```

This will start all services in detached mode.

### View logs

```bash
npm run docker:logs
```

### Stop the environment

```bash
npm run docker:down
```

### Clean up (remove volumes)

```bash
npm run docker:clean
```

## Services

### Web Application

- **URL**: http://localhost:3000
- **Hot Reload**: Enabled via volume mounts
- **Environment Variables**:
  - `REACT_APP_API_URL`: API endpoint
  - `REACT_APP_COGNITO_USER_POOL_ID`: Cognito User Pool ID
  - `REACT_APP_COGNITO_CLIENT_ID`: Cognito Client ID

### API

- **URL**: http://localhost:4000
- **Hot Reload**: Enabled via ts-node-dev
- **Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `AWS_ENDPOINT`: LocalStack endpoint
  - `JWT_SECRET`: JWT signing secret

### PostgreSQL

- **Host**: localhost
- **Port**: 5432
- **Database**: appdb
- **Username**: user
- **Password**: pass

The database is automatically initialized with the schema from `init-db.sql`.

### LocalStack

- **Endpoint**: http://localhost:4566
- **Services**: S3, Secrets Manager, Cognito
- **AWS CLI Configuration**:
  ```bash
  export AWS_ACCESS_KEY_ID=test
  export AWS_SECRET_ACCESS_KEY=test
  export AWS_DEFAULT_REGION=us-east-1
  ```

LocalStack is automatically initialized with:

- S3 buckets for web app and file uploads
- Secrets Manager secrets for database credentials
- Cognito User Pool with test user

## Test Credentials

### Cognito Test User

- **Email**: test@example.com
- **Password**: TestPass123!

### Database Test Users

Two sample users are pre-loaded:

- test@example.com (Google provider)
- demo@example.com (Microsoft provider)

## Initialization Scripts

### init-db.sql

Creates the database schema:

- `users` table
- `files` table
- Indexes for performance
- Sample test data

### init-localstack.sh

Sets up AWS services:

- Creates S3 buckets with encryption
- Creates Secrets Manager secrets
- Creates Cognito User Pool and Client
- Creates test user

## Troubleshooting

### Services not starting

Check if ports are already in use:

```bash
lsof -i :3000  # Web
lsof -i :4000  # API
lsof -i :5432  # PostgreSQL
lsof -i :4566  # LocalStack
```

### Database connection issues

Ensure PostgreSQL is healthy:

```bash
docker-compose ps postgres
```

### LocalStack not initialized

Check LocalStack logs:

```bash
docker-compose logs localstack
```

### Reset everything

```bash
npm run docker:clean
npm run docker:build
npm run docker:up
```

## Development Workflow

1. Start Docker environment: `npm run docker:up`
2. Wait for services to be healthy (check with `docker-compose ps`)
3. Access web app at http://localhost:3000
4. Make code changes (hot reload is enabled)
5. View logs with `npm run docker:logs`
6. Stop when done: `npm run docker:down`

## Production Builds

To test production builds locally:

### Web Application

```bash
docker-compose build --target production web
docker run -p 80:80 typescript-demo-web
```

### API

```bash
docker-compose build --target production api
docker run -p 4000:4000 typescript-demo-api
```

## Network Architecture

All services run on a custom bridge network (`app-network`) allowing them to communicate using service names as hostnames.

```
┌─────────────────────────────────────────┐
│         Docker Network (bridge)         │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────────┐     │
│  │ web  │  │ api  │  │ postgres │     │
│  │:3000 │→ │:4000 │→ │  :5432   │     │
│  └──────┘  └──┬───┘  └──────────┘     │
│              ↓                          │
│         ┌────────────┐                 │
│         │ localstack │                 │
│         │   :4566    │                 │
│         └────────────┘                 │
└─────────────────────────────────────────┘
```

## Multi-Stage Builds

Both web and api Dockerfiles use multi-stage builds:

1. **Development**: Full dev dependencies, hot reload
2. **Build**: Compile TypeScript, optimize assets
3. **Production**: Minimal runtime, optimized for deployment

Use the `target` parameter to specify which stage to build:

```bash
docker-compose build --target development
docker-compose build --target production
```
