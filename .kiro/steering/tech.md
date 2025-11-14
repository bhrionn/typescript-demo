---
inclusion: always
---

# Technology Stack

## Frontend (web-app/)

- **Runtime**: React 18+
- **Language**: TypeScript 5+ (strict mode)
- **Routing**: React Router
- **HTTP Client**: Axios
- **Auth Integration**: AWS Amplify
- **UI Framework**: Material-UI or Tailwind CSS
- **Testing**: Jest + React Testing Library
- **E2E Testing**: Playwright

## Backend (api/)

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+ (strict mode)
- **AWS SDK**: AWS SDK v3
- **Database Client**: pg (PostgreSQL)
- **Testing**: Jest

## Infrastructure (infrastructure/)

- **IaC Tool**: AWS CDK 2.x
- **Language**: TypeScript 5+
- **AWS Services**: CloudFront, WAF, Cognito, API Gateway, Lambda, S3, RDS PostgreSQL, Secrets Manager, CloudTrail, Config

## Development Tools

- **Containerization**: Docker + Docker Compose
- **AWS Mocking**: LocalStack
- **Code Quality**: ESLint + Prettier
- **Git Hooks**: Husky
- **Package Manager**: npm

## Common Commands

### Local Development
```bash
# Start local Docker environment
docker-compose up

# Stop local environment
docker-compose down

# View logs
docker-compose logs -f [service-name]
```

### Web Application
```bash
cd web-app
npm install
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Lint code
```

### API
```bash
cd api
npm install
npm run dev          # Start local API server
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run lint         # Lint code
```

### Infrastructure
```bash
cd infrastructure
npm install
npm run build        # Compile CDK code
cdk synth            # Synthesize CloudFormation
cdk diff             # Show changes
cdk deploy           # Deploy to AWS
cdk destroy          # Tear down stack
```

### Database Migrations
```bash
# Run migrations (local)
npm run migrate:up

# Rollback migrations
npm run migrate:down
```

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
