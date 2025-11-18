# Federated Auth TypeScript Application

[![CI Pipeline](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml)
[![Security Scan](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/security-scan.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/security-scan.yml)
[![Deploy to Dev](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy-dev.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy-dev.yml)
[![Deploy to Staging](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/deploy-staging.yml)

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

### Using Docker Compose (Recommended)

Start the local development environment with all services:

```bash
# Start all services and wait for them to be ready
npm run docker:start

# Or start services in detached mode
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down

# Clean up (remove volumes)
npm run docker:clean
```

This will start:

- **Web application** on http://localhost:3000
- **API server** on http://localhost:4000
- **PostgreSQL database** on localhost:5432
- **LocalStack** (AWS services mock) on localhost:4566

#### Test Credentials

- **Email**: test@example.com
- **Password**: TestPass123!

#### What's Included

The Docker environment automatically:

- Initializes PostgreSQL with the database schema
- Creates sample test users
- Sets up LocalStack with S3 buckets, Secrets Manager, and Cognito
- Enables hot-reload for both web and API
- Configures networking between all services

For more details, see [docker/README.md](docker/README.md)

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

#### General

- `npm run install:all` - Install all dependencies
- `npm run build` - Build all projects
- `npm run test` - Run all tests
- `npm run lint` - Lint all projects
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format all code with Prettier

#### Docker

- `npm run docker:start` - Start Docker environment and wait for services
- `npm run docker:up` - Start Docker environment in detached mode
- `npm run docker:down` - Stop Docker environment
- `npm run docker:logs` - View logs from all services
- `npm run docker:restart` - Restart all services
- `npm run docker:clean` - Stop and remove all volumes
- `npm run docker:build` - Rebuild Docker images
- `npm run docker:ps` - Show running containers
- `npm run docker:wait` - Wait for services to be healthy

## Integration Testing

Comprehensive end-to-end integration testing documentation and tools are available:

### Quick Start

Run automated integration tests:

```bash
./run-integration-tests.sh dev
```

### Documentation

- **[Integration Testing Guide](INTEGRATION_TESTING_GUIDE.md)** - Complete testing procedures
- **[Automated Test Script](run-integration-tests.sh)** - Automated verification
- **[Test Report Template](INTEGRATION_TEST_REPORT_TEMPLATE.md)** - Document test results
- **[Manual Testing Checklist](MANUAL_TESTING_CHECKLIST.md)** - Quick reference for manual tests
- **[Testing README](INTEGRATION_TESTING_README.md)** - Overview of all testing resources

### What's Tested

- ✅ Federated authentication (Google, Microsoft)
- ✅ File upload and storage (S3)
- ✅ Database operations (RDS)
- ✅ API functionality
- ✅ Security controls (WAF, NACLs, Security Groups)
- ✅ Network isolation (VPC)
- ✅ Encryption (at rest and in transit)
- ✅ Monitoring and logging

See [INTEGRATION_TESTING_README.md](INTEGRATION_TESTING_README.md) for complete details.

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment. See [CI/CD Documentation](.github/workflows/README.md) for details.

### Workflows

- **CI Pipeline**: Runs on all PRs and pushes - linting, type checking, tests, security scans
- **Security Scanning**: Daily security scans and vulnerability checks
- **Deploy to Development**: Automatic deployment on push to `develop` branch
- **Deploy to Staging**: Automatic deployment on push to `main` branch
- **Deploy to Production**: Manual deployment with approval required

### Deployment Guide

See [Deployment Guide](.github/DEPLOYMENT_GUIDE.md) for detailed deployment instructions and troubleshooting.

## Next Steps

1. Review the requirements document: `.kiro/specs/federated-auth-typescript-app/requirements.md`
2. Review the design document: `.kiro/specs/federated-auth-typescript-app/design.md`
3. Follow the implementation tasks: `.kiro/specs/federated-auth-typescript-app/tasks.md`
4. Configure GitHub secrets for CI/CD: [CI/CD Setup](.github/workflows/README.md#setup-instructions)

## License

Private - All rights reserved by Brian Byrne
