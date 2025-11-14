---
inclusion: always
---

# Project Structure

This is a monorepo containing three main projects: web application, API/Lambda functions, and AWS infrastructure.

## Root Structure

```
typescript-demo/
├── web-app/              # React frontend application
├── api/                  # Lambda functions and API logic
├── infrastructure/       # AWS CDK infrastructure code
├── .kiro/               # Kiro configuration and specs
├── docker-compose.yml   # Local development environment
└── README.md
```

## Web Application (web-app/)

```
web-app/
├── src/
│   ├── components/      # React components (UI building blocks)
│   ├── services/        # Business logic and API clients
│   │   ├── AuthService.ts
│   │   ├── ApiClient.ts
│   │   └── FileUploadService.ts
│   ├── hooks/           # Custom React hooks
│   ├── contexts/        # React contexts (Auth, etc.)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── config/          # Configuration files
├── public/              # Static assets
├── tests/               # Test files
└── package.json
```

### Component Organization
- Components follow SOLID principles with clear interfaces
- Each component has a single responsibility
- Shared components in `components/common/`
- Feature-specific components in `components/[feature]/`

## API & Lambda Functions (api/)

```
api/
├── src/
│   ├── handlers/        # Lambda function entry points
│   │   ├── auth/        # Authentication handlers
│   │   ├── files/       # File upload handlers
│   │   └── api/         # Business logic handlers
│   ├── services/        # Business logic services
│   ├── repositories/    # Data access layer (database)
│   │   ├── UserRepository.ts
│   │   └── FileRepository.ts
│   ├── middleware/      # Lambda middleware (auth, logging, CORS)
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Utility functions
├── tests/               # Test files
└── package.json
```

### Lambda Handler Pattern
- Each handler validates input, calls services, returns formatted response
- Middleware handles cross-cutting concerns (auth, logging, errors)
- Services contain business logic
- Repositories handle database operations with prepared statements

## Infrastructure (infrastructure/)

```
infrastructure/
├── lib/
│   ├── stacks/          # CDK stack definitions
│   │   ├── network-stack.ts       # VPC, subnets, NACLs
│   │   ├── security-stack.ts      # WAF, Security Groups
│   │   ├── cognito-stack.ts       # User Pool, Identity Providers
│   │   ├── storage-stack.ts       # S3, RDS
│   │   ├── compute-stack.ts       # Lambda functions
│   │   ├── api-stack.ts           # API Gateway
│   │   └── cdn-stack.ts           # CloudFront
│   ├── constructs/      # Reusable CDK constructs
│   └── config/          # Environment-specific configurations
├── bin/
│   └── app.ts           # CDK app entry point
├── tests/               # Infrastructure tests
└── package.json
```

### Stack Dependencies
- NetworkStack → SecurityStack → StorageStack → ComputeStack → ApiStack → CdnStack
- Each stack exports values consumed by dependent stacks
- Stacks are environment-aware (dev/staging/prod)

## Database Schema

Located in `api/migrations/` or documented in design spec:

```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  provider VARCHAR(50),
  provider_id VARCHAR(255),
  created_at TIMESTAMP,
  last_login_at TIMESTAMP
)

files (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  file_name VARCHAR(500),
  file_size BIGINT,
  mime_type VARCHAR(100),
  s3_key VARCHAR(1024),
  s3_bucket VARCHAR(255),
  uploaded_at TIMESTAMP,
  metadata JSONB
)
```

## Network Architecture

```
VPC (10.0.0.0/16)
├── Public Subnets (10.0.1.0/24, 10.0.2.0/24)
│   └── NAT Gateway
├── Private App Subnets (10.0.10.0/24, 10.0.11.0/24)
│   └── Lambda Functions
└── Private DB Subnets (10.0.20.0/24, 10.0.21.0/24)
    └── RDS PostgreSQL
```

## Naming Conventions

### TypeScript
- **Interfaces**: PascalCase with `I` prefix (e.g., `IAuthService`)
- **Classes**: PascalCase (e.g., `AuthService`)
- **Functions/Methods**: camelCase (e.g., `validateToken`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Files**: kebab-case for components, PascalCase for classes

### AWS Resources
- Format: `{project}-{environment}-{resource-type}-{name}`
- Example: `typescript-demo-prod-lambda-file-upload`

## Testing Structure

- Unit tests colocated with source: `*.test.ts` or `*.spec.ts`
- Integration tests in `tests/integration/`
- E2E tests in `tests/e2e/`
- Test files mirror source structure
