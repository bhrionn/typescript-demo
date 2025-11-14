# Federated Auth TypeScript Application

A modern, enterprise-grade TypeScript application demonstrating federated authentication with comprehensive AWS cloud infrastructure. The system enables users to authenticate via Google or Microsoft accounts and securely upload files through a React-based web interface.

## Project Structure

This is a monorepo containing three main projects:

```
typescript-demo/
├── web-app/              # React frontend application
├── api/                  # Lambda functions and API logic
├── infrastructure/       # AWS CDK infrastructure code
├── docker-compose.yml    # Local development environment
└── README.md
```

## Prerequisites

- Node.js 20+
- npm
- Docker and Docker Compose (for local development)
- AWS CLI (for deployment)
- AWS CDK CLI (for infrastructure deployment)

## Getting Started

### 1. Install Dependencies

```bash
# Install root dependencies and all workspace dependencies
npm install
```

### 2. Build All Projects

```bash
npm run build
```

### 3. Run Tests

```bash
npm run test
```

### 4. Lint Code

```bash
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### 5. Format Code

```bash
npm run format
```

## Local Development

### Using Docker Compose

Start the local development environment with all services:

```bash
docker-compose up
```

This will start:

- Web application on http://localhost:3000
- API server on http://localhost:4000
- PostgreSQL database on localhost:5432
- LocalStack (AWS services mock) on localhost:4566

Stop the environment:

```bash
docker-compose down
```

### Individual Project Development

#### Web Application

```bash
cd web-app
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
```

#### API

```bash
cd api
npm run dev          # Start local API server
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run lint         # Lint code
```

#### Infrastructure

```bash
cd infrastructure
npm run build        # Compile CDK code
cdk synth            # Synthesize CloudFormation
cdk diff             # Show changes
cdk deploy           # Deploy to AWS
cdk destroy          # Tear down stack
```

## Technology Stack

### Frontend (web-app/)

- React 18+
- TypeScript 5+ (strict mode)
- React Router
- Axios
- AWS Amplify
- Material-UI or Tailwind CSS
- Jest + React Testing Library

### Backend (api/)

- Node.js 20+
- TypeScript 5+ (strict mode)
- AWS SDK v3
- pg (PostgreSQL)
- Jest

### Infrastructure (infrastructure/)

- AWS CDK 2.x
- TypeScript 5+
- AWS Services: CloudFront, WAF, Cognito, API Gateway, Lambda, S3, RDS PostgreSQL, Secrets Manager, CloudTrail, Config

### Development Tools

- Docker + Docker Compose
- LocalStack for AWS service mocking
- ESLint + Prettier
- Husky for git hooks
- lint-staged

## Code Quality

### Pre-commit Hooks

Git hooks are automatically installed via Husky. Before each commit:

- Code is linted and auto-fixed where possible
- Code is formatted with Prettier

### TypeScript Configuration

All projects use TypeScript 5+ with strict mode enabled:

- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

### SOLID Principles

All code follows SOLID design principles:

- Single Responsibility: Each class has one reason to change
- Open-Closed: Extension without modification
- Liskov Substitution: Derived classes are substitutable
- Interface Segregation: Focused interfaces
- Dependency Inversion: Depend on abstractions, not concretions

## Environment Variables

### Web App

- `REACT_APP_API_URL` - API Gateway endpoint
- `REACT_APP_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `REACT_APP_COGNITO_CLIENT_ID` - Cognito Client ID
- `REACT_APP_COGNITO_DOMAIN` - Cognito domain for OAuth

### API

- `DATABASE_URL` - PostgreSQL connection string
- `AWS_REGION` - AWS region
- `S3_BUCKET_NAME` - File storage bucket name
- `COGNITO_USER_POOL_ID` - For token validation

### Infrastructure

- `AWS_ACCOUNT` - AWS account ID
- `AWS_REGION` - Deployment region
- `ENVIRONMENT` - dev/staging/prod

## Available Scripts

### Root Level

- `npm run install:all` - Install all dependencies
- `npm run build` - Build all projects
- `npm run test` - Run all tests
- `npm run lint` - Lint all projects
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format all code with Prettier

## Next Steps

1. Review the requirements document: `.kiro/specs/federated-auth-typescript-app/requirements.md`
2. Review the design document: `.kiro/specs/federated-auth-typescript-app/design.md`
3. Follow the implementation tasks: `.kiro/specs/federated-auth-typescript-app/tasks.md`

## License

Private - All rights reserved
