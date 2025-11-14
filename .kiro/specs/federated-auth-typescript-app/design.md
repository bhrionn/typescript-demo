# Design Document

## Overview

This design document outlines the architecture for a modern, enterprise-grade TypeScript application with federated authentication, secure file upload capabilities, and comprehensive AWS infrastructure. The system is built on SOLID design principles and includes robust security controls across all layers.

The application consists of three main components:

1. **Web Application** - React-based frontend with TypeScript
2. **API & Lambda Functions** - Serverless backend processing
3. **AWS CDK Infrastructure** - Infrastructure as code for all AWS resources

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront CDN                          │
│                    (Global Distribution)                        │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             │ Static Assets                  │ API Requests
             │                                │
┌────────────▼──────────┐         ┌──────────▼─────────────────┐
│   S3 Bucket (Web)     │         │     API Gateway            │
│   - React App         │         │     - REST API             │
│   - Static Files      │         │     - WAF Protected        │
└───────────────────────┘         └──────────┬─────────────────┘
                                              │
                                  ┌───────────▼──────────────┐
                                  │   AWS Cognito            │
                                  │   - User Pool            │
                                  │   - Google/MS Federation │
                                  └──────────────────────────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        │                     │                     │
              ┌─────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
              │ Lambda (Auth)    │  │ Lambda (Upload) │  │ Lambda (API)    │
              │ - Token Validate │  │ - File Process  │  │ - Business Logic│
              └──────────────────┘  └────────┬────────┘  └────────┬────────┘
                                              │                     │
                                    ┌─────────▼─────────┐          │
                                    │   S3 (Files)      │          │
                                    │   - Encrypted     │          │
                                    │   - Private       │          │
                                    └───────────────────┘          │
                                                                   │
                                                         ┌─────────▼─────────┐
                                                         │   RDS PostgreSQL  │
                                                         │   - Private Subnet│
                                                         │   - Encrypted     │
                                                         └───────────────────┘
```

### Network Architecture

```
VPC (10.0.0.0/16)
│
├── Public Subnets (10.0.1.0/24, 10.0.2.0/24)
│   ├── NAT Gateway
│   └── Application Load Balancer (if needed)
│
├── Private Subnets - Application Tier (10.0.10.0/24, 10.0.11.0/24)
│   ├── Lambda Functions (via VPC Interface)
│   └── Security Group: Allow HTTPS from API Gateway
│
└── Private Subnets - Database Tier (10.0.20.0/24, 10.0.21.0/24)
    ├── RDS PostgreSQL (Multi-AZ)
    └── Security Group: Allow PostgreSQL (5432) from Lambda SG only
```

### Security Layers

1. **Edge Security (CloudFront + WAF)**
   - AWS WAF with managed rule sets
   - Rate limiting
   - Geo-blocking capabilities
   - DDoS protection via AWS Shield

2. **Network Security**
   - VPC with public/private subnet separation
   - NACLs for subnet-level filtering
   - Security Groups for instance-level filtering
   - No direct internet access to Lambda or RDS

3. **Application Security**
   - Cognito for authentication
   - JWT token validation in Lambda
   - API Gateway request validation
   - Input sanitization

4. **Data Security**
   - S3 bucket encryption (AES-256)
   - RDS encryption at rest
   - TLS 1.2+ for all data in transit
   - Secrets Manager for credentials

## Components and Interfaces

### 1. Web Application (React + TypeScript)

#### Directory Structure

```
web-app/
├── src/
│   ├── components/          # React components
│   ├── services/            # API clients and business logic
│   ├── hooks/               # Custom React hooks
│   ├── contexts/            # React contexts (Auth, etc.)
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── config/              # Configuration files
├── public/
└── tests/
```

#### Key Components

**AuthService (SOLID: Single Responsibility)**

```typescript
interface IAuthService {
  login(provider: 'google' | 'microsoft'): Promise<void>;
  logout(): Promise<void>;
  getToken(): Promise<string | null>;
  isAuthenticated(): boolean;
  refreshToken(): Promise<string>;
}
```

**FileUploadService (SOLID: Dependency Inversion)**

```typescript
interface IFileUploadService {
  uploadFile(file: File, metadata: FileMetadata): Promise<UploadResult>;
  validateFile(file: File): ValidationResult;
  getUploadProgress(): Observable<number>;
}

interface IApiClient {
  post<T>(endpoint: string, data: any, token: string): Promise<T>;
  get<T>(endpoint: string, token: string): Promise<T>;
}
```

**UI Components (SOLID: Open-Closed)**

```typescript
// Base component that can be extended
interface IFormComponent {
  validate(): boolean;
  submit(): Promise<void>;
  reset(): void;
}

// Specific implementations
class LoginForm implements IFormComponent {}
class FileUploadForm implements IFormComponent {}
```

### 2. API & Lambda Functions

#### Directory Structure

```
api/
├── src/
│   ├── handlers/            # Lambda function handlers
│   │   ├── auth/
│   │   ├── files/
│   │   └── api/
│   ├── services/            # Business logic services
│   ├── repositories/        # Data access layer
│   ├── middleware/          # Lambda middleware
│   ├── types/               # Shared types
│   └── utils/               # Utility functions
└── tests/
```

#### Lambda Functions

**Auth Handler**

```typescript
interface IAuthHandler {
  validateToken(token: string): Promise<TokenValidationResult>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
}
```

**File Upload Handler**

```typescript
interface IFileHandler {
  processUpload(event: APIGatewayEvent): Promise<APIGatewayResponse>;
  validateRequest(event: APIGatewayEvent): ValidationResult;
  storeFile(file: Buffer, metadata: FileMetadata): Promise<S3Location>;
  recordMetadata(metadata: FileMetadata): Promise<void>;
}
```

**Database Service (SOLID: Interface Segregation)**

```typescript
interface IDatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(sql: string, params: any[]): Promise<T[]>;
}

interface IFileRepository {
  create(file: FileRecord): Promise<string>;
  findById(id: string): Promise<FileRecord | null>;
  findByUserId(userId: string): Promise<FileRecord[]>;
}
```

### 3. AWS CDK Infrastructure

#### Directory Structure

```
infrastructure/
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts       # VPC, Subnets, NACLs
│   │   ├── security-stack.ts      # WAF, Security Groups
│   │   ├── cognito-stack.ts       # User Pool, Identity Providers
│   │   ├── storage-stack.ts       # S3, RDS
│   │   ├── compute-stack.ts       # Lambda Functions
│   │   ├── api-stack.ts           # API Gateway
│   │   └── cdn-stack.ts           # CloudFront
│   ├── constructs/                # Reusable CDK constructs
│   └── config/                    # Environment configurations
├── bin/
│   └── app.ts                     # CDK app entry point
└── tests/
```

#### Stack Organization

**NetworkStack**

- VPC with public/private subnets across 2 AZs
- NAT Gateways for private subnet internet access
- VPC Flow Logs
- NACLs for each subnet tier

**SecurityStack**

- AWS WAF WebACL with rules:
  - AWS Managed Rules (Core, Known Bad Inputs)
  - Rate limiting (2000 requests per 5 minutes)
  - SQL injection protection
  - XSS protection
- Security Groups:
  - Lambda SG (egress to RDS, S3, Secrets Manager)
  - RDS SG (ingress from Lambda SG only)

**CognitoStack**

- User Pool with:
  - Google identity provider
  - Microsoft identity provider
  - MFA optional
  - Password policies
- User Pool Client for web app
- Identity Pool for AWS credentials (if needed)

**StorageStack**

- S3 Buckets:
  - Web app bucket (public read via CloudFront)
  - File storage bucket (private, encrypted)
  - Bucket policies preventing direct access
- RDS PostgreSQL:
  - Multi-AZ deployment
  - Automated backups (7-day retention)
  - Encryption at rest
  - Private subnets only

**ComputeStack**

- Lambda Functions:
  - Auth handler
  - File upload handler
  - API handlers
- Lambda Layers for shared dependencies
- IAM roles with least privilege
- Environment variables from Secrets Manager

**ApiStack**

- API Gateway REST API
- Request validation
- CORS configuration
- Lambda integrations
- Custom domain (optional)
- API keys and usage plans

**CdnStack**

- CloudFront distribution
- Origin: S3 (web app) and API Gateway
- SSL/TLS certificate
- Cache behaviors
- WAF association

## Data Models

### User

```typescript
interface User {
  id: string; // UUID
  email: string;
  provider: 'google' | 'microsoft';
  providerId: string;
  createdAt: Date;
  lastLoginAt: Date;
}
```

### File

```typescript
interface FileRecord {
  id: string; // UUID
  userId: string; // Foreign key to User
  fileName: string;
  fileSize: number; // Bytes
  mimeType: string;
  s3Key: string; // S3 object key
  s3Bucket: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}
```

### Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  CONSTRAINT unique_provider_user UNIQUE (provider, provider_id)
);

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  s3_key VARCHAR(1024) NOT NULL,
  s3_bucket VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at);
```

## Error Handling

### Web Application

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

// Specific error types
class AuthenticationError extends AppError {
  constructor(message: string) {
    super('AUTH_ERROR', message, 401);
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

// Global error handler
class ErrorHandler {
  handle(error: Error): void {
    if (error instanceof AppError && error.isOperational) {
      // Show user-friendly message
      this.showNotification(error.message);
    } else {
      // Log to monitoring service
      this.logError(error);
      this.showGenericError();
    }
  }
}
```

### Lambda Functions

```typescript
class LambdaError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

// Error response formatter
function formatErrorResponse(error: Error): APIGatewayResponse {
  if (error instanceof LambdaError) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({
        error: error.code,
        message: error.message,
      }),
    };
  }

  // Don't expose internal errors
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }),
  };
}
```

## Testing Strategy

### Web Application Testing

1. **Unit Tests** (Jest + React Testing Library)
   - Service layer logic
   - Utility functions
   - Custom hooks
   - Component logic

2. **Integration Tests**
   - API client interactions
   - Authentication flows
   - File upload workflows

3. **E2E Tests** (Playwright)
   - Login flow with mock Cognito
   - File upload and retrieval
   - Error scenarios

### Lambda Function Testing

1. **Unit Tests** (Jest)
   - Handler logic
   - Service layer
   - Repository layer
   - Middleware

2. **Integration Tests**
   - Database operations (with test DB)
   - S3 operations (with LocalStack)
   - Secrets Manager (with LocalStack)

### Infrastructure Testing

1. **CDK Tests**
   - Snapshot tests for stack outputs
   - Fine-grained assertions for resources
   - Security configuration validation

2. **Security Validation**
   - cfn-nag for CloudFormation security
   - Checkov for policy validation
   - Custom scripts for security checklist

## Local Development Environment

### Docker Compose Setup

```yaml
version: '3.8'

services:
  web:
    build: ./web-app
    ports:
      - '3000:3000'
    environment:
      - REACT_APP_API_URL=http://localhost:4000
      - REACT_APP_COGNITO_DOMAIN=http://localhost:9229
    volumes:
      - ./web-app:/app
      - /app/node_modules

  api:
    build: ./api
    ports:
      - '4000:4000'
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/appdb
      - AWS_ENDPOINT=http://localstack:4566
      - JWT_SECRET=local-dev-secret
    depends_on:
      - postgres
      - localstack

  postgres:
    image: postgres:15-alpine
    ports:
      - '5432:5432'
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=appdb
    volumes:
      - postgres-data:/var/lib/postgresql/data

  localstack:
    image: localstack/localstack:latest
    ports:
      - '4566:4566'
    environment:
      - SERVICES=s3,secretsmanager,cognito-idp
      - DEBUG=1
    volumes:
      - localstack-data:/tmp/localstack

volumes:
  postgres-data:
  localstack-data:
```

### Local Testing Workflow

1. Start Docker environment: `docker-compose up`
2. Run database migrations
3. Seed test data
4. Access web app at `http://localhost:3000`
5. Mock Cognito responses for authentication
6. Test file uploads to LocalStack S3

## Security Checklist

### Infrastructure Security

- [ ] VPC with private subnets for Lambda and RDS
- [ ] NACLs configured for each subnet tier
- [ ] Security Groups with least privilege rules
- [ ] AWS WAF with managed rule sets enabled
- [ ] CloudFront with HTTPS enforcement
- [ ] S3 buckets with encryption at rest (AES-256)
- [ ] S3 bucket policies preventing public access
- [ ] RDS encryption at rest enabled
- [ ] RDS in private subnets only
- [ ] RDS automated backups enabled
- [ ] Secrets Manager for database credentials
- [ ] IAM roles with least privilege policies
- [ ] CloudTrail enabled for audit logging
- [ ] VPC Flow Logs enabled
- [ ] AWS Config for compliance monitoring

### Application Security

- [ ] Cognito User Pool with federated identity providers
- [ ] JWT token validation in all Lambda functions
- [ ] API Gateway request validation
- [ ] Input sanitization for all user inputs
- [ ] Prepared statements for database queries
- [ ] TLS 1.2+ for all API communications
- [ ] CORS properly configured
- [ ] Rate limiting on API endpoints
- [ ] File type and size validation
- [ ] No direct S3 access from web application

### Code Security

- [ ] Dependency vulnerability scanning
- [ ] SAST (Static Application Security Testing)
- [ ] Secrets not hardcoded in source
- [ ] Environment-specific configurations
- [ ] Error messages don't expose sensitive info
- [ ] Logging excludes PII and credentials

## Deployment Strategy

### Environments

1. **Development** - For active development
2. **Staging** - Pre-production testing
3. **Production** - Live environment

### CI/CD Pipeline

1. Code commit triggers pipeline
2. Run linting and type checking
3. Run unit tests
4. Run integration tests
5. Build artifacts
6. Deploy infrastructure (CDK)
7. Deploy application code
8. Run smoke tests
9. Security validation
10. Promote to next environment

### Rollback Strategy

- CloudFormation stack rollback on failure
- Lambda function versions and aliases
- Database migration rollback scripts
- CloudFront cache invalidation

## Monitoring and Observability

### Metrics

- CloudWatch metrics for Lambda (duration, errors, throttles)
- API Gateway metrics (latency, 4xx, 5xx)
- RDS metrics (connections, CPU, storage)
- CloudFront metrics (requests, cache hit rate)

### Logging

- CloudWatch Logs for Lambda functions
- VPC Flow Logs for network traffic
- CloudTrail for API calls
- Application logs with structured JSON

### Alarms

- Lambda error rate > 5%
- API Gateway 5xx rate > 1%
- RDS CPU > 80%
- RDS storage < 20% free
- Unusual authentication patterns

## Performance Considerations

### Web Application

- Code splitting for optimal bundle size
- Lazy loading for routes
- Image optimization
- Service worker for offline capability (optional)

### API & Lambda

- Lambda warm-up strategies
- Connection pooling for RDS
- Caching frequently accessed data
- Optimized Lambda memory allocation

### Database

- Proper indexing strategy
- Query optimization
- Read replicas for scaling (if needed)
- Connection pooling

## Technology Stack Summary

### Web Application

- React 18+
- TypeScript 5+
- React Router for navigation
- Axios for HTTP client
- AWS Amplify for Cognito integration
- Material-UI or Tailwind CSS for UI
- Jest + React Testing Library for testing

### API & Lambda

- Node.js 20+
- TypeScript 5+
- AWS SDK v3
- pg (PostgreSQL client)
- Jest for testing

### Infrastructure

- AWS CDK 2.x
- TypeScript 5+
- AWS Services: CloudFront, WAF, Cognito, API Gateway, Lambda, S3, RDS, Secrets Manager, CloudTrail, Config

### Development Tools

- Docker & Docker Compose
- LocalStack for AWS service mocking
- ESLint + Prettier
- Husky for git hooks
