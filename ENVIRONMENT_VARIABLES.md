# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used across the application.

## Table of Contents

- [Overview](#overview)
- [Web Application Variables](#web-application-variables)
- [API Variables](#api-variables)
- [Infrastructure Variables](#infrastructure-variables)
- [Local Development Variables](#local-development-variables)
- [CI/CD Variables](#cicd-variables)
- [Security Best Practices](#security-best-practices)

## Overview

The application uses environment variables for configuration across three main components:

1. **Web Application** (React frontend)
2. **API** (Lambda functions)
3. **Infrastructure** (AWS CDK)

Environment variables are managed differently in each environment:

- **Local Development**: `.env` files (not committed to Git)
- **AWS Deployment**: AWS Secrets Manager, Systems Manager Parameter Store, Lambda environment variables
- **CI/CD**: GitHub Secrets

## Web Application Variables

### Required Variables

#### `REACT_APP_API_URL`

- **Description**: API Gateway endpoint URL
- **Format**: `https://api-id.execute-api.region.amazonaws.com/prod`
- **Example**: `https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod`
- **Local**: `http://localhost:4000`
- **Required**: Yes
- **Source**: CDK Output from ApiStack

#### `REACT_APP_COGNITO_USER_POOL_ID`

- **Description**: AWS Cognito User Pool ID
- **Format**: `region_alphanumeric`
- **Example**: `us-east-1_abc123XYZ`
- **Local**: `us-east-1_localpool` (LocalStack)
- **Required**: Yes
- **Source**: CDK Output from CognitoStack

#### `REACT_APP_COGNITO_CLIENT_ID`

- **Description**: Cognito User Pool Client ID
- **Format**: Alphanumeric string
- **Example**: `1a2b3c4d5e6f7g8h9i0j1k2l3m`
- **Local**: `local-client-id` (LocalStack)
- **Required**: Yes
- **Source**: CDK Output from CognitoStack

#### `REACT_APP_COGNITO_DOMAIN`

- **Description**: Cognito hosted UI domain
- **Format**: `domain-prefix.auth.region.amazoncognito.com`
- **Example**: `typescript-demo-prod.auth.us-east-1.amazoncognito.com`
- **Local**: `localhost:9229` (LocalStack)
- **Required**: Yes
- **Source**: CDK Output from CognitoStack

#### `REACT_APP_AWS_REGION`

- **Description**: AWS region for Cognito and other services
- **Format**: AWS region code
- **Example**: `us-east-1`
- **Local**: `us-east-1`
- **Required**: Yes
- **Default**: `us-east-1`

### Optional Variables

#### `REACT_APP_ENVIRONMENT`

- **Description**: Environment name for display/debugging
- **Format**: `dev` | `staging` | `prod`
- **Example**: `prod`
- **Local**: `local`
- **Required**: No
- **Default**: `production`

#### `REACT_APP_LOG_LEVEL`

- **Description**: Client-side logging level
- **Format**: `debug` | `info` | `warn` | `error`
- **Example**: `info`
- **Local**: `debug`
- **Required**: No
- **Default**: `warn`

#### `REACT_APP_ENABLE_ANALYTICS`

- **Description**: Enable analytics tracking
- **Format**: `true` | `false`
- **Example**: `true`
- **Local**: `false`
- **Required**: No
- **Default**: `false`

### Configuration File

Create `web-app/.env` for local development:

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:4000

# Cognito Configuration
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_localpool
REACT_APP_COGNITO_CLIENT_ID=local-client-id
REACT_APP_COGNITO_DOMAIN=localhost:9229
REACT_APP_AWS_REGION=us-east-1

# Optional
REACT_APP_ENVIRONMENT=local
REACT_APP_LOG_LEVEL=debug
REACT_APP_ENABLE_ANALYTICS=false
```

### Environment-Specific Files

#### Development (`.env.dev`)

```bash
REACT_APP_API_URL=https://dev-api.example.com
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_devpool123
REACT_APP_COGNITO_CLIENT_ID=dev-client-id-123
REACT_APP_COGNITO_DOMAIN=typescript-demo-dev.auth.us-east-1.amazoncognito.com
REACT_APP_AWS_REGION=us-east-1
REACT_APP_ENVIRONMENT=dev
REACT_APP_LOG_LEVEL=debug
```

#### Staging (`.env.staging`)

```bash
REACT_APP_API_URL=https://staging-api.example.com
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_stagingpool123
REACT_APP_COGNITO_CLIENT_ID=staging-client-id-123
REACT_APP_COGNITO_DOMAIN=typescript-demo-staging.auth.us-east-1.amazoncognito.com
REACT_APP_AWS_REGION=us-east-1
REACT_APP_ENVIRONMENT=staging
REACT_APP_LOG_LEVEL=info
```

#### Production (`.env.prod`)

```bash
REACT_APP_API_URL=https://api.example.com
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_prodpool123
REACT_APP_COGNITO_CLIENT_ID=prod-client-id-123
REACT_APP_COGNITO_DOMAIN=typescript-demo-prod.auth.us-east-1.amazoncognito.com
REACT_APP_AWS_REGION=us-east-1
REACT_APP_ENVIRONMENT=prod
REACT_APP_LOG_LEVEL=warn
REACT_APP_ENABLE_ANALYTICS=true
```

## API Variables

### Required Variables

#### `DATABASE_URL`

- **Description**: PostgreSQL connection string
- **Format**: `postgresql://user:password@host:port/database?ssl=true`
- **Example**: `postgresql://admin:pass123@db.region.rds.amazonaws.com:5432/appdb?ssl=true`
- **Local**: `postgresql://user:pass@localhost:5432/appdb`
- **Required**: Yes
- **Source**: AWS Secrets Manager
- **Secret Name**: `typescript-demo-{env}-db-credentials`

#### `AWS_REGION`

- **Description**: AWS region for SDK operations
- **Format**: AWS region code
- **Example**: `us-east-1`
- **Local**: `us-east-1`
- **Required**: Yes
- **Default**: `us-east-1`

#### `S3_BUCKET_NAME`

- **Description**: S3 bucket for file uploads
- **Format**: Bucket name
- **Example**: `typescript-demo-prod-file-uploads`
- **Local**: `typescript-demo-dev-file-uploads`
- **Required**: Yes
- **Source**: CDK Output from StorageStack

#### `COGNITO_USER_POOL_ID`

- **Description**: Cognito User Pool ID for token validation
- **Format**: `region_alphanumeric`
- **Example**: `us-east-1_abc123XYZ`
- **Local**: `us-east-1_localpool`
- **Required**: Yes
- **Source**: CDK Output from CognitoStack

### Optional Variables

#### `AWS_ENDPOINT`

- **Description**: Custom AWS endpoint (for LocalStack)
- **Format**: URL
- **Example**: `http://localstack:4566`
- **Local**: `http://localstack:4566`
- **Required**: No (only for local development)

#### `JWT_SECRET`

- **Description**: JWT signing secret (local development only)
- **Format**: Random string
- **Example**: `local-dev-secret-key-12345`
- **Local**: `local-dev-secret`
- **Required**: No (only for local development)
- **Note**: Not used in AWS (Cognito handles JWT)

#### `LOG_LEVEL`

- **Description**: Logging level
- **Format**: `debug` | `info` | `warn` | `error`
- **Example**: `info`
- **Local**: `debug`
- **Required**: No
- **Default**: `info`

#### `NODE_ENV`

- **Description**: Node.js environment
- **Format**: `development` | `production` | `test`
- **Example**: `production`
- **Local**: `development`
- **Required**: No
- **Default**: `production`

#### `MAX_FILE_SIZE_MB`

- **Description**: Maximum file upload size in MB
- **Format**: Number
- **Example**: `50`
- **Local**: `50`
- **Required**: No
- **Default**: `50`

#### `ALLOWED_FILE_TYPES`

- **Description**: Comma-separated list of allowed MIME types
- **Format**: `type1,type2,type3`
- **Example**: `image/jpeg,image/png,application/pdf`
- **Local**: `*/*` (all types)
- **Required**: No
- **Default**: All types allowed

### Configuration File

Create `api/.env` for local development:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/appdb

# AWS Configuration
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localstack:4566
S3_BUCKET_NAME=typescript-demo-dev-file-uploads

# Cognito
COGNITO_USER_POOL_ID=us-east-1_localpool

# Local Development
JWT_SECRET=local-dev-secret
NODE_ENV=development
LOG_LEVEL=debug

# File Upload
MAX_FILE_SIZE_MB=50
ALLOWED_FILE_TYPES=*/*
```

### Lambda Environment Variables

Lambda functions receive environment variables from CDK:

```typescript
// infrastructure/lib/stacks/compute-stack.ts
new lambda.Function(this, 'FileUploadFunction', {
  environment: {
    DATABASE_URL: databaseSecret.secretValueFromJson('connectionString').toString(),
    S3_BUCKET_NAME: fileUploadBucket.bucketName,
    COGNITO_USER_POOL_ID: userPool.userPoolId,
    AWS_REGION: this.region,
    LOG_LEVEL: 'info',
    MAX_FILE_SIZE_MB: '50',
  },
});
```

## Infrastructure Variables

### Required Variables

#### `AWS_ACCOUNT`

- **Description**: AWS account ID
- **Format**: 12-digit number
- **Example**: `123456789012`
- **Required**: Yes
- **Source**: Manual configuration

#### `AWS_REGION`

- **Description**: Target AWS region for deployment
- **Format**: AWS region code
- **Example**: `us-east-1`
- **Required**: Yes
- **Default**: `us-east-1`

#### `ENVIRONMENT`

- **Description**: Deployment environment
- **Format**: `dev` | `staging` | `prod`
- **Example**: `prod`
- **Required**: Yes
- **Source**: Manual configuration

### Optional Variables

#### `PROJECT_NAME`

- **Description**: Project name for resource naming
- **Format**: Kebab-case string
- **Example**: `typescript-demo`
- **Required**: No
- **Default**: `typescript-demo`

#### `DOMAIN_NAME`

- **Description**: Custom domain name
- **Format**: Domain name
- **Example**: `example.com`
- **Required**: No
- **Note**: If not provided, uses CloudFront domain

#### `DB_INSTANCE_CLASS`

- **Description**: RDS instance type
- **Format**: AWS instance class
- **Example**: `db.t3.micro` (dev), `db.r5.large` (prod)
- **Required**: No
- **Default**: Environment-specific

#### `DB_ALLOCATED_STORAGE`

- **Description**: RDS storage size in GB
- **Format**: Number
- **Example**: `20` (dev), `100` (prod)
- **Required**: No
- **Default**: Environment-specific

#### `DB_BACKUP_RETENTION_DAYS`

- **Description**: RDS backup retention period
- **Format**: Number (1-35)
- **Example**: `7` (dev), `30` (prod)
- **Required**: No
- **Default**: Environment-specific

#### `DB_MULTI_AZ`

- **Description**: Enable RDS Multi-AZ deployment
- **Format**: `true` | `false`
- **Example**: `false` (dev), `true` (prod)
- **Required**: No
- **Default**: Environment-specific

#### `LAMBDA_MEMORY_SIZE`

- **Description**: Lambda function memory in MB
- **Format**: Number (128-10240)
- **Example**: `512` (dev), `2048` (prod)
- **Required**: No
- **Default**: `1024`

#### `LAMBDA_TIMEOUT`

- **Description**: Lambda function timeout in seconds
- **Format**: Number (1-900)
- **Example**: `30` (dev), `60` (prod)
- **Required**: No
- **Default**: `30`

#### `LOG_RETENTION_DAYS`

- **Description**: CloudWatch Logs retention period
- **Format**: Number
- **Example**: `7` (dev), `90` (prod)
- **Required**: No
- **Default**: Environment-specific

#### `ENABLE_XRAY`

- **Description**: Enable AWS X-Ray tracing
- **Format**: `true` | `false`
- **Example**: `true`
- **Required**: No
- **Default**: `true`

### Configuration File

Create `infrastructure/.env` for deployment:

```bash
# AWS Configuration
AWS_ACCOUNT=123456789012
AWS_REGION=us-east-1
ENVIRONMENT=dev

# Project Configuration
PROJECT_NAME=typescript-demo
DOMAIN_NAME=dev.example.com

# Database Configuration
DB_INSTANCE_CLASS=db.t3.micro
DB_ALLOCATED_STORAGE=20
DB_BACKUP_RETENTION_DAYS=7
DB_MULTI_AZ=false

# Lambda Configuration
LAMBDA_MEMORY_SIZE=512
LAMBDA_TIMEOUT=30

# Monitoring
LOG_RETENTION_DAYS=7
ENABLE_XRAY=true
```

## Local Development Variables

### Docker Compose Variables

Variables used in `docker-compose.yml`:

#### PostgreSQL

```yaml
POSTGRES_USER=user
POSTGRES_PASSWORD=pass
POSTGRES_DB=appdb
```

#### LocalStack

```yaml
SERVICES=s3,secretsmanager,cognito-idp
DEBUG=1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-1
```

#### Web Application

```yaml
REACT_APP_API_URL=http://localhost:4000
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_localpool
REACT_APP_COGNITO_CLIENT_ID=local-client-id
REACT_APP_COGNITO_DOMAIN=localhost:9229
```

#### API

```yaml
DATABASE_URL=postgresql://user:pass@postgres:5432/appdb
AWS_ENDPOINT=http://localstack:4566
JWT_SECRET=local-dev-secret
```

## CI/CD Variables

### GitHub Secrets

Required secrets for CI/CD pipelines:

#### Development Environment

```
AWS_ACCESS_KEY_ID_DEV
AWS_SECRET_ACCESS_KEY_DEV
AWS_ACCOUNT_ID_DEV
API_URL_DEV
COGNITO_USER_POOL_ID_DEV
COGNITO_CLIENT_ID_DEV
COGNITO_DOMAIN_DEV
WEB_BUCKET_NAME_DEV
```

#### Staging Environment

```
AWS_ACCESS_KEY_ID_STAGING
AWS_SECRET_ACCESS_KEY_STAGING
AWS_ACCOUNT_ID_STAGING
API_URL_STAGING
COGNITO_USER_POOL_ID_STAGING
COGNITO_CLIENT_ID_STAGING
COGNITO_DOMAIN_STAGING
WEB_BUCKET_NAME_STAGING
```

#### Production Environment

```
AWS_ACCESS_KEY_ID_PROD
AWS_SECRET_ACCESS_KEY_PROD
AWS_ACCOUNT_ID_PROD
API_URL_PROD
COGNITO_USER_POOL_ID_PROD
COGNITO_CLIENT_ID_PROD
COGNITO_DOMAIN_PROD
WEB_BUCKET_NAME_PROD
```

#### Optional

```
SLACK_WEBHOOK  # For deployment notifications
```

### Setting GitHub Secrets

```bash
# Using GitHub CLI
gh secret set AWS_ACCESS_KEY_ID_DEV --body "YOUR_ACCESS_KEY"
gh secret set AWS_SECRET_ACCESS_KEY_DEV --body "YOUR_SECRET_KEY"

# Or use the GitHub web interface:
# Repository → Settings → Secrets and variables → Actions → New repository secret
```

## Security Best Practices

### DO NOT

❌ **Commit `.env` files to Git**

```bash
# Add to .gitignore
.env
.env.local
.env.*.local
```

❌ **Hardcode secrets in source code**

```typescript
// BAD
const apiKey = 'abc123xyz';

// GOOD
const apiKey = process.env.API_KEY;
```

❌ **Use production credentials locally**

❌ **Share credentials via email or chat**

❌ **Use the same credentials across environments**

### DO

✅ **Use AWS Secrets Manager for sensitive data**

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager({ region: 'us-east-1' });
const secret = await client.getSecretValue({ SecretId: 'db-credentials' });
```

✅ **Use IAM roles instead of access keys when possible**

✅ **Rotate credentials regularly**

✅ **Use different credentials for each environment**

✅ **Validate environment variables at startup**

```typescript
const requiredEnvVars = ['DATABASE_URL', 'AWS_REGION', 'S3_BUCKET_NAME', 'COGNITO_USER_POOL_ID'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

✅ **Use `.env.example` files as templates**

```bash
# .env.example (committed to Git)
DATABASE_URL=postgresql://user:password@localhost:5432/appdb
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

## Retrieving Values from AWS

### Get CDK Outputs

```bash
# Get all outputs from a stack
aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-cognito \
  --query 'Stacks[0].Outputs' \
  --profile dev

# Get specific output
aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --profile dev
```

### Get Secrets from Secrets Manager

```bash
# Get secret value
aws secretsmanager get-secret-value \
  --secret-id typescript-demo-dev-db-credentials \
  --query 'SecretString' \
  --output text \
  --profile dev

# Parse JSON secret
aws secretsmanager get-secret-value \
  --secret-id typescript-demo-dev-db-credentials \
  --query 'SecretString' \
  --output text \
  --profile dev | jq -r '.connectionString'
```

### Get Parameters from Parameter Store

```bash
# Get parameter
aws ssm get-parameter \
  --name /typescript-demo/dev/api-url \
  --query 'Parameter.Value' \
  --output text \
  --profile dev

# Get multiple parameters
aws ssm get-parameters \
  --names /typescript-demo/dev/api-url /typescript-demo/dev/cognito-pool-id \
  --query 'Parameters[*].[Name,Value]' \
  --output table \
  --profile dev
```

## Validation Script

Create a script to validate environment variables:

```bash
#!/bin/bash
# validate-env.sh

set -e

echo "Validating environment variables..."

# Check required variables
required_vars=(
  "AWS_ACCOUNT"
  "AWS_REGION"
  "ENVIRONMENT"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

echo "✅ All required environment variables are set"
```

## Troubleshooting

### Variable Not Found

**Problem**: Application can't find environment variable

**Solution**:

1. Check variable name (case-sensitive)
2. Verify `.env` file exists and is loaded
3. Check variable is exported in shell
4. Restart application after changing `.env`

### Variable Not Updated

**Problem**: Changes to `.env` not reflected

**Solution**:

```bash
# Restart development server
npm run dev

# Or restart Docker
npm run docker:restart

# Clear cache
rm -rf node_modules/.cache
```

### AWS Credentials Not Working

**Problem**: AWS SDK can't find credentials

**Solution**:

```bash
# Check AWS CLI configuration
aws configure list

# Verify credentials
aws sts get-caller-identity

# Set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_DEFAULT_REGION=us-east-1
```

## Additional Resources

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Create React App Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [Node.js Environment Variables](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)
