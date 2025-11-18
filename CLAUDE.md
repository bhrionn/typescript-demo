# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** for a federated authentication TypeScript application with three main workspaces:

- `web-app/` - React 18+ frontend with Material-UI
- `api/` - Node.js Lambda functions and API logic
- `infrastructure/` - AWS CDK infrastructure as code

The application demonstrates enterprise-grade patterns including:

- Federated authentication (Google/Microsoft via AWS Cognito)
- File upload system with S3 storage and RDS PostgreSQL metadata
- Comprehensive AWS security (WAF, NACLs, Security Groups, VPC isolation)
- Global content delivery via CloudFront
- SOLID design principles throughout the codebase

## Development Commands

### Root Level Commands

```bash
# Install all dependencies across all workspaces
npm install

# Build all projects
npm run build

# Run all tests
npm run test

# Type check all projects
npm run type-check

# Lint all projects
npm run lint
npm run lint:fix  # Auto-fix issues

# Format code
npm run format

# Docker environment (recommended for local dev)
npm run docker:start      # Start and wait for services to be ready
npm run docker:up         # Start in detached mode
npm run docker:down       # Stop services
npm run docker:logs       # View logs
npm run docker:clean      # Stop and remove volumes
```

### Web App Commands

```bash
cd web-app

npm run dev           # Start dev server on localhost:3000
npm run build         # Production build
npm run test          # Run Jest tests
npm run test:watch    # Watch mode
npm run type-check    # TypeScript checking without emit

# E2E tests with Playwright
npm run test:e2e           # Run E2E tests
npm run test:e2e:ui        # Run with Playwright UI
npm run test:e2e:headed    # Run in headed mode (see browser)
npm run test:e2e:debug     # Debug mode
npm run playwright:install # Install Playwright browsers
```

### API Commands

```bash
cd api

npm run dev           # Start local dev server with hot reload
npm run build         # Compile TypeScript
npm run test          # Run Jest tests
npm run test:watch    # Watch mode
npm run type-check    # TypeScript checking

# Database migrations
npm run migrate:up    # Run migrations
npm run migrate:down  # Rollback migrations
```

### Infrastructure Commands

```bash
cd infrastructure

npm run build         # Compile CDK code
npm run test          # Run tests
npm run test:security # Run security validation tests

# CDK commands
cdk synth             # Synthesize CloudFormation templates
cdk diff              # Show infrastructure changes
cdk deploy            # Deploy to AWS
cdk destroy           # Tear down infrastructure

# With environment context
cdk deploy --context environment=dev
cdk deploy --context environment=staging
cdk deploy --context environment=prod

# Security validation
npm run validate:security  # Run security checklist validation
```

### Running a Single Test

```bash
# Web app - run specific test file
cd web-app
npm test -- src/components/MyComponent.test.tsx

# API - run specific test file
cd api
npm test -- src/handlers/upload-file.test.ts

# Infrastructure - run specific test
cd infrastructure
npm test -- tests/security-checklist.test.ts
```

## Architecture Overview

### Repository Pattern (API)

The API uses a **repository pattern** with dependency injection:

- **Repositories** (`api/src/repositories/`) - Data access layer abstractions
  - `base-repository.ts` - Base class with common DB operations
  - `file-repository.ts` / `file-repository.impl.ts` - File metadata CRUD
  - `user-repository.ts` / `user-repository.impl.ts` - User data access
  - `repository-factory.ts` - Factory for creating repository instances
- **Services** (`api/src/services/`) - Business logic layer
  - `auth-service.ts` - JWT validation and Cognito integration
- **Handlers** (`api/src/handlers/`) - Lambda function handlers
  - `auth/` - Authentication endpoints
  - `files/` - File upload/download/metadata endpoints
  - `api/` - General API endpoints

### Middleware Chain (API)

Lambda functions use a **composable middleware pattern** (`api/src/middleware/`):

- `auth-middleware.ts` - JWT token validation
- `cors.ts` - CORS header handling
- `error-handler.ts` - Centralized error handling
- `logging.ts` - Request/response logging
- `compose.ts` - Middleware composition utility

Example handler structure:

```typescript
export const handler = compose(
  corsMiddleware,
  errorHandlerMiddleware,
  authMiddleware,
  loggingMiddleware,
  async (event, context) => {
    // Business logic here
  }
);
```

### Service Layer Architecture (Web App)

The frontend follows **interface-based dependency injection** (`web-app/src/services/`):

- Services define interfaces (e.g., `IAuthService`, `IApiClient`, `IFileUploadService`)
- Implementations inject dependencies via constructor
- Context providers make services available throughout the app

Key services:

- `AuthService` - Handles Cognito authentication flow
- `ApiClient` - HTTP client with auth token injection
- `FileUploadService` - Manages file uploads to API
- `ErrorHandler` - Global error handling with notification integration
- `NotificationService` / `ErrorLoggingService` - User notifications and error logging

### Context-Based State Management (Web App)

React contexts provide global state (`web-app/src/contexts/`):

- `AuthContext` - User authentication state and token management
- `ErrorHandlerContext` - Global error boundary and handling
- Each context uses the Context API with custom hooks (e.g., `useAuth()`)

### Infrastructure Stack Dependencies

CDK stacks have strict ordering dependencies (`infrastructure/lib/stacks/`):

1. **NetworkStack** - VPC, subnets (public, private app, private database)
2. **SecurityStack** - NACLs, Security Groups (depends on NetworkStack)
3. **WafStack** - AWS WAF rules (deployed to us-east-1 for CloudFront)
4. **CognitoStack** - User pools, identity providers
5. **StorageStack** - S3 buckets, RDS PostgreSQL (depends on NetworkStack, SecurityStack)
6. **ComputeStack** - Lambda functions (depends on StorageStack, CognitoStack, NetworkStack, SecurityStack)
7. **ApiStack** - API Gateway (depends on ComputeStack)
8. **CdnStack** - CloudFront distribution (depends on StorageStack, ApiStack, WafStack)
9. **MonitoringStack** - CloudTrail, CloudWatch, AWS Config (depends on most other stacks)

### Docker Environment

The `docker-compose.yml` provides a complete local development environment:

- **web** - React dev server with hot reload (port 3000)
- **api** - Node.js API server with hot reload (port 4000)
- **postgres** - PostgreSQL 15 database (port 5432)
- **localstack** - AWS service mocks (S3, Secrets Manager, Cognito) (port 4566)

Initialization scripts:

- `docker/init-db.sql` - PostgreSQL schema and test data
- `docker/init-localstack.sh` - LocalStack AWS service setup

## TypeScript Configuration

All workspaces use **TypeScript 5+ with strict mode**:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

Each workspace has its own `tsconfig.json` with project-specific settings.

## Testing Strategy

- **Unit tests** - Jest for all workspaces
- **Integration tests** - See `INTEGRATION_TESTING_GUIDE.md` and `run-integration-tests.sh`
- **E2E tests** - Playwright for web-app
- **Security validation** - Infrastructure security checklist tests

## Code Patterns

### SOLID Principles

This codebase strictly follows SOLID principles:

- **Single Responsibility** - Each class/module has one reason to change
- **Open-Closed** - Extend behavior without modifying existing code (e.g., middleware composition)
- **Liskov Substitution** - Interface implementations are fully substitutable
- **Interface Segregation** - Focused, role-specific interfaces (e.g., separate repository interfaces)
- **Dependency Inversion** - Depend on abstractions (interfaces) not implementations

### Error Handling

- **API** - Centralized error handler middleware catches and formats errors
- **Web App** - Global `ErrorBoundary` component and `ErrorHandlerContext` with notification integration
- **Infrastructure** - Errors fail the CDK synthesis process

### Security Considerations

- Never commit AWS credentials or secrets
- Database passwords stored in AWS Secrets Manager
- All data encrypted at rest (S3, RDS) and in transit (TLS 1.2+)
- WAF rules protect against SQL injection, XSS
- Network isolation: RDS only accessible from Lambda functions in private subnets
- JWT tokens validated on every API request

## Environment Variables

### Web App

- `REACT_APP_API_URL` - API Gateway endpoint
- `REACT_APP_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `REACT_APP_COGNITO_CLIENT_ID` - Cognito Client ID
- `REACT_APP_COGNITO_DOMAIN` - Cognito OAuth domain
- `REACT_APP_AWS_REGION` - AWS region

### API (Lambda)

- `DATABASE_URL` - PostgreSQL connection string
- `AWS_REGION` - AWS region
- `S3_BUCKET_NAME` - File storage bucket
- `COGNITO_USER_POOL_ID` - For token validation
- `JWT_SECRET` - Local dev only

### Infrastructure (CDK)

- `ENVIRONMENT` - dev/staging/prod
- `AWS_ACCOUNT` - AWS account ID
- `AWS_REGION` - Deployment region
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` - Microsoft OAuth
- `ALARM_EMAIL` - CloudWatch alarm notifications

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- `ci.yml` - Lint, type check, test on all PRs
- `security-scan.yml` - Daily security scans
- `deploy-dev.yml` - Auto-deploy to dev on `develop` branch
- `deploy-staging.yml` - Auto-deploy to staging on `main` branch
- `deploy-production.yml` - Manual production deployment with approval

See `.github/workflows/README.md` and `DEPLOYMENT_GUIDE.md` for details.

## Important Notes

- **WAF Stack Region**: The WafStack must be deployed to `us-east-1` because it's used with CloudFront (global service requirement)
- **Workspace Structure**: This is an npm workspace. Always install dependencies from root with `npm install`, not individual workspace directories
- **Migration Pattern**: When changing database schema, create a migration in `api/migrations/` and run with `npm run migrate:up`
- **Lambda Code Changes**: After modifying Lambda handlers in `api/src/handlers/`, rebuild with `npm run build` before deploying infrastructure
- **Docker First**: Always test changes in Docker environment before deploying to AWS
- **Git Hooks**: Husky pre-commit hooks automatically lint and format code

## Common Development Workflows

### Adding a New API Endpoint

1. Create handler in `api/src/handlers/[category]/`
2. Export handler in `api/src/handlers/index.ts`
3. Add Lambda function in `infrastructure/lib/stacks/compute-stack.ts`
4. Add API Gateway route in `infrastructure/lib/stacks/api-stack.ts`
5. Update `web-app/src/services/ApiClient.ts` to call the endpoint
6. Test in Docker environment first

### Adding a New React Component

1. Create component in `web-app/src/components/[category]/`
2. Create corresponding test file `*.test.tsx`
3. Export from component directory index if needed
4. Import and use in pages or other components

### Modifying Database Schema

1. Create migration file in `api/migrations/`
2. Test migration locally: `cd api && npm run migrate:up`
3. Update repository interfaces in `api/src/repositories/`
4. Update corresponding implementation classes

### Deploying to AWS

1. Test changes in Docker: `npm run docker:start`
2. Ensure all tests pass: `npm run test`
3. Build all projects: `npm run build`
4. Set environment variables for OAuth and AWS
5. Deploy infrastructure: `cd infrastructure && cdk deploy --context environment=dev`
6. Build and upload web app to S3
7. Run integration tests: `./run-integration-tests.sh dev`
