# Deployment Guide

This guide provides comprehensive instructions for deploying the Federated Auth TypeScript Application to AWS across different environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Environments](#deployment-environments)
- [Deployment Process](#deployment-process)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js 20+** - Runtime for all applications
- **npm** - Package manager
- **AWS CLI 2.x** - AWS command-line interface
- **AWS CDK CLI 2.x** - Infrastructure deployment tool
- **Docker** - For local testing and Lambda bundling
- **Git** - Version control

### Installation

```bash
# Install Node.js (using nvm)
nvm install 20
nvm use 20

# Install AWS CLI
# macOS
brew install awscli

# Verify installations
node --version  # Should be 20.x
npm --version
aws --version
cdk --version   # Install with: npm install -g aws-cdk
```

### AWS Account Setup

1. **AWS Accounts Required**:
   - Development account
   - Staging account (optional but recommended)
   - Production account

2. **IAM Permissions Required**:
   - CloudFormation full access
   - IAM role creation
   - VPC and networking
   - Lambda, API Gateway, S3, RDS
   - Cognito, Secrets Manager
   - CloudFront, WAF
   - CloudWatch, CloudTrail

3. **Configure AWS Credentials**:

```bash
# Configure AWS CLI
aws configure --profile dev
aws configure --profile staging
aws configure --profile prod

# Or use environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

### CDK Bootstrap

Bootstrap CDK in each account/region (one-time setup):

```bash
# Development
cdk bootstrap aws://ACCOUNT_ID/us-east-1 --profile dev

# Staging
cdk bootstrap aws://ACCOUNT_ID/us-east-1 --profile staging

# Production
cdk bootstrap aws://ACCOUNT_ID/us-east-1 --profile prod
```

## Environment Setup

### Environment Variables

Create environment-specific configuration files:

#### Development (.env.dev)

```bash
# AWS Configuration
AWS_ACCOUNT=123456789012
AWS_REGION=us-east-1
ENVIRONMENT=dev

# Application Configuration
PROJECT_NAME=typescript-demo
DOMAIN_NAME=dev.example.com  # Optional

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

#### Staging (.env.staging)

```bash
# AWS Configuration
AWS_ACCOUNT=234567890123
AWS_REGION=us-east-1
ENVIRONMENT=staging

# Application Configuration
PROJECT_NAME=typescript-demo
DOMAIN_NAME=staging.example.com

# Database Configuration
DB_INSTANCE_CLASS=db.t3.small
DB_ALLOCATED_STORAGE=50
DB_BACKUP_RETENTION_DAYS=14
DB_MULTI_AZ=true

# Lambda Configuration
LAMBDA_MEMORY_SIZE=1024
LAMBDA_TIMEOUT=60

# Monitoring
LOG_RETENTION_DAYS=30
ENABLE_XRAY=true
```

#### Production (.env.prod)

```bash
# AWS Configuration
AWS_ACCOUNT=345678901234
AWS_REGION=us-east-1
ENVIRONMENT=prod

# Application Configuration
PROJECT_NAME=typescript-demo
DOMAIN_NAME=example.com

# Database Configuration
DB_INSTANCE_CLASS=db.r5.large
DB_ALLOCATED_STORAGE=100
DB_BACKUP_RETENTION_DAYS=30
DB_MULTI_AZ=true
DB_DELETION_PROTECTION=true

# Lambda Configuration
LAMBDA_MEMORY_SIZE=2048
LAMBDA_TIMEOUT=60

# Monitoring
LOG_RETENTION_DAYS=90
ENABLE_XRAY=true
ENABLE_ENHANCED_MONITORING=true
```

### Federated Identity Provider Setup

Before deployment, configure identity providers:

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://{cognito-domain}/oauth2/idpresponse`
5. Note the Client ID and Client Secret

#### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory → App registrations
3. Create new registration:
   - Name: TypeScript Demo App
   - Supported account types: Accounts in any organizational directory and personal Microsoft accounts
   - Redirect URI: `https://{cognito-domain}/oauth2/idpresponse`
4. Note the Application (client) ID
5. Create a client secret under Certificates & secrets
6. Note the client secret value

### Store Secrets in AWS Secrets Manager

```bash
# Google OAuth credentials
aws secretsmanager create-secret \
  --name typescript-demo-dev-google-oauth \
  --secret-string '{"clientId":"YOUR_GOOGLE_CLIENT_ID","clientSecret":"YOUR_GOOGLE_CLIENT_SECRET"}' \
  --profile dev

# Microsoft OAuth credentials
aws secretsmanager create-secret \
  --name typescript-demo-dev-microsoft-oauth \
  --secret-string '{"clientId":"YOUR_MICROSOFT_CLIENT_ID","clientSecret":"YOUR_MICROSOFT_CLIENT_SECRET"}' \
  --profile dev
```

## Deployment Environments

### Development Environment

**Purpose**: Active development and testing

**Characteristics**:

- Single AZ deployment
- Minimal backup retention
- Lower-cost instance types
- Relaxed security for testing
- Automatic deployment from `develop` branch

**Use Cases**:

- Feature development
- Integration testing
- Bug fixes
- Experimentation

### Staging Environment

**Purpose**: Pre-production validation

**Characteristics**:

- Multi-AZ deployment
- Production-like configuration
- Moderate backup retention
- Full security controls
- Automatic deployment from `main` branch

**Use Cases**:

- UAT (User Acceptance Testing)
- Performance testing
- Security testing
- Release candidate validation

### Production Environment

**Purpose**: Live user-facing application

**Characteristics**:

- Multi-AZ deployment
- Extended backup retention
- Deletion protection
- Full security controls
- Manual deployment with approval

**Use Cases**:

- Live application
- Real user traffic
- Business operations

## Deployment Process

### Step 1: Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] AWS credentials configured
- [ ] CDK bootstrapped in target account
- [ ] Identity providers configured
- [ ] Secrets stored in Secrets Manager
- [ ] Deployment window scheduled (production)
- [ ] Stakeholders notified (production)

### Step 2: Build and Test

```bash
# Install all dependencies
npm install

# Build all projects
npm run build

# Run all tests
npm run test

# Run linting
npm run lint

# Run security validation
cd infrastructure
npm run validate:security
```

### Step 3: Infrastructure Deployment

#### Development Deployment

```bash
# Set environment
export AWS_PROFILE=dev
export ENVIRONMENT=dev
export AWS_ACCOUNT=123456789012
export AWS_REGION=us-east-1

# Navigate to infrastructure
cd infrastructure

# Install dependencies
npm install

# Build CDK code
npm run build

# Review changes
npx cdk diff --all

# Deploy all stacks
npx cdk deploy --all --require-approval never

# Or deploy specific stacks in order
npx cdk deploy NetworkStack
npx cdk deploy SecurityStack
npx cdk deploy WafStack
npx cdk deploy CognitoStack
npx cdk deploy StorageStack
npx cdk deploy ComputeStack
npx cdk deploy ApiStack
npx cdk deploy CdnStack
npx cdk deploy MonitoringStack
```

#### Staging Deployment

```bash
# Set environment
export AWS_PROFILE=staging
export ENVIRONMENT=staging
export AWS_ACCOUNT=234567890123
export AWS_REGION=us-east-1

# Navigate to infrastructure
cd infrastructure

# Build and review
npm run build
npx cdk diff --all

# Deploy with approval
npx cdk deploy --all --require-approval broadening
```

#### Production Deployment

```bash
# Set environment
export AWS_PROFILE=prod
export ENVIRONMENT=prod
export AWS_ACCOUNT=345678901234
export AWS_REGION=us-east-1

# Navigate to infrastructure
cd infrastructure

# Build and review changes carefully
npm run build
npx cdk diff --all > deployment-changes.txt

# Review deployment-changes.txt with team

# Deploy with explicit approval
npx cdk deploy --all --require-approval broadening

# Monitor deployment
# Watch CloudFormation console for progress
```

### Step 4: Application Deployment

#### API Lambda Functions

Lambda functions are automatically deployed with the ComputeStack. To update just the Lambda code:

```bash
cd api

# Build TypeScript
npm run build

# Deploy updated Lambda functions
cd ../infrastructure
npx cdk deploy ComputeStack --hotswap  # Fast deployment for Lambda code only
```

#### Web Application

```bash
cd web-app

# Build production bundle
npm run build

# Get S3 bucket name from CDK outputs
export WEB_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-${ENVIRONMENT}-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`WebAppBucketName`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE})

# Upload to S3
aws s3 sync build/ s3://${WEB_BUCKET}/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --profile ${AWS_PROFILE}

# Upload index.html with no-cache
aws s3 cp build/index.html s3://${WEB_BUCKET}/index.html \
  --cache-control "no-cache" \
  --profile ${AWS_PROFILE}

# Invalidate CloudFront cache
export DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-${ENVIRONMENT}-cdn \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE})

aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --profile ${AWS_PROFILE}
```

### Step 5: Database Migration

```bash
cd api

# Set database connection string
export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id typescript-demo-${ENVIRONMENT}-db-credentials \
  --query 'SecretString' \
  --output text \
  --profile ${AWS_PROFILE} | jq -r '.connectionString')

# Run migrations
npm run migrate:up

# Verify migrations
npm run migrate:status
```

### Step 6: Post-Deployment Configuration

#### Update Cognito Identity Providers

```bash
# Get Cognito User Pool ID
export USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-${ENVIRONMENT}-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE})

# Get Cognito Domain
export COGNITO_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-${ENVIRONMENT}-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomain`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE})

# Update Google OAuth redirect URI in Google Cloud Console
# Redirect URI: https://${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com/oauth2/idpresponse

# Update Microsoft OAuth redirect URI in Azure Portal
# Redirect URI: https://${COGNITO_DOMAIN}.auth.${AWS_REGION}.amazoncognito.com/oauth2/idpresponse
```

## Post-Deployment Verification

### Automated Verification

Run the integration test suite:

```bash
# Set environment
export ENVIRONMENT=dev  # or staging, prod

# Run integration tests
./run-integration-tests.sh ${ENVIRONMENT}
```

### Manual Verification

#### 1. Infrastructure Verification

```bash
# Check all stacks deployed successfully
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `typescript-demo-${ENVIRONMENT}`)].StackName' \
  --profile ${AWS_PROFILE}

# Verify security validation
cd infrastructure
npm run validate:security
```

#### 2. Web Application Verification

1. Open CloudFront URL in browser
2. Verify page loads correctly
3. Check browser console for errors
4. Test responsive design (mobile/desktop)

#### 3. Authentication Verification

1. Click "Sign in with Google"
2. Complete OAuth flow
3. Verify redirect back to application
4. Check JWT token in browser storage
5. Repeat for Microsoft authentication

#### 4. File Upload Verification

1. Log in to application
2. Navigate to file upload page
3. Select a test file
4. Upload file
5. Verify upload progress
6. Verify file appears in file list
7. Download file and verify content

#### 5. API Verification

```bash
# Get API endpoint
export API_URL=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-${ENVIRONMENT}-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text \
  --profile ${AWS_PROFILE})

# Test health endpoint (if available)
curl ${API_URL}/health

# Test authenticated endpoint (requires token)
export TOKEN="your-jwt-token"
curl -H "Authorization: Bearer ${TOKEN}" ${API_URL}/api/files
```

#### 6. Database Verification

```bash
# Connect to RDS via bastion or VPN
psql -h ${RDS_ENDPOINT} -U ${DB_USER} -d appdb

# Check tables exist
\dt

# Verify data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM files;
```

#### 7. Monitoring Verification

1. Open CloudWatch console
2. Check Lambda function logs
3. Verify API Gateway logs
4. Check CloudTrail for audit logs
5. Verify alarms are configured
6. Test alarm notifications

### Security Verification

Run the security checklist verification:

```bash
cd infrastructure
npm run validate:security
```

Verify all checks pass:

- ✓ S3 buckets block public access
- ✓ S3 buckets have encryption
- ✓ RDS is not publicly accessible
- ✓ RDS has encryption enabled
- ✓ Security groups are properly configured
- ✓ WAF rules are active
- ✓ VPC Flow Logs enabled
- ✓ CloudTrail enabled

## Rollback Procedures

### Infrastructure Rollback

#### Option 1: CloudFormation Rollback

```bash
# Rollback specific stack
aws cloudformation rollback-stack \
  --stack-name typescript-demo-${ENVIRONMENT}-compute \
  --profile ${AWS_PROFILE}

# Monitor rollback
aws cloudformation describe-stack-events \
  --stack-name typescript-demo-${ENVIRONMENT}-compute \
  --profile ${AWS_PROFILE}
```

#### Option 2: Redeploy Previous Version

```bash
# Checkout previous version
git checkout v1.0.0

# Rebuild
cd infrastructure
npm run build

# Deploy
npx cdk deploy --all --profile ${AWS_PROFILE}
```

### Application Rollback

#### Web Application

```bash
# Get previous version from S3 backup or Git
git checkout v1.0.0
cd web-app
npm run build

# Deploy previous version
aws s3 sync build/ s3://${WEB_BUCKET}/ --delete --profile ${AWS_PROFILE}

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --profile ${AWS_PROFILE}
```

#### Lambda Functions

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name typescript-demo-${ENVIRONMENT}-lambda-file-upload \
  --profile ${AWS_PROFILE}

# Update alias to previous version
aws lambda update-alias \
  --function-name typescript-demo-${ENVIRONMENT}-lambda-file-upload \
  --name live \
  --function-version 2 \
  --profile ${AWS_PROFILE}
```

### Database Rollback

```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier typescript-demo-${ENVIRONMENT}-db \
  --profile ${AWS_PROFILE}

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier typescript-demo-${ENVIRONMENT}-db-restored \
  --db-snapshot-identifier snapshot-id \
  --profile ${AWS_PROFILE}

# Update connection string in Secrets Manager
# Point application to restored database
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed troubleshooting guide.

### Common Issues

#### CDK Deployment Fails

**Error**: "Stack is in UPDATE_ROLLBACK_COMPLETE state"

**Solution**:

```bash
# Delete the failed stack
aws cloudformation delete-stack \
  --stack-name typescript-demo-${ENVIRONMENT}-compute \
  --profile ${AWS_PROFILE}

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name typescript-demo-${ENVIRONMENT}-compute \
  --profile ${AWS_PROFILE}

# Redeploy
npx cdk deploy ComputeStack --profile ${AWS_PROFILE}
```

#### Lambda Function Errors

**Error**: "Task timed out after 30.00 seconds"

**Solution**:

- Increase Lambda timeout in CDK stack
- Optimize Lambda code
- Check database connection pooling
- Review CloudWatch logs for bottlenecks

#### Database Connection Failures

**Error**: "Could not connect to database"

**Solution**:

- Verify Lambda is in correct VPC subnets
- Check security group rules
- Verify RDS is running
- Check Secrets Manager credentials
- Test connection from bastion host

#### CloudFront Not Serving Updated Content

**Solution**:

```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --profile ${AWS_PROFILE}

# Wait for invalidation to complete (5-10 minutes)
```

## Best Practices

### Deployment Best Practices

1. **Always deploy to development first**
2. **Run full test suite before deployment**
3. **Review CDK diff output carefully**
4. **Deploy during low-traffic windows (production)**
5. **Have rollback plan ready**
6. **Monitor deployment in real-time**
7. **Verify deployment with automated tests**
8. **Document any manual steps**

### Security Best Practices

1. **Rotate AWS credentials regularly**
2. **Use IAM roles instead of access keys when possible**
3. **Enable MFA for production deployments**
4. **Review security validation before each deployment**
5. **Keep secrets in Secrets Manager, never in code**
6. **Enable CloudTrail in all environments**
7. **Review security group rules regularly**

### Monitoring Best Practices

1. **Set up CloudWatch alarms before deployment**
2. **Monitor Lambda error rates**
3. **Track API Gateway latency**
4. **Monitor RDS performance metrics**
5. **Set up log aggregation**
6. **Configure SNS notifications for critical alarms**
7. **Review logs regularly**

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
- [Integration Testing Guide](INTEGRATION_TESTING_GUIDE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Security Validation Guide](infrastructure/scripts/USAGE.md)
- [CI/CD Setup](. github/SETUP_INSTRUCTIONS.md)

## Support

For deployment issues:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review CloudWatch logs
3. Check CloudFormation events
4. Contact DevOps team
5. Create incident ticket

## Maintenance

### Weekly

- Review deployment logs
- Check for failed deployments
- Monitor resource utilization
- Review security scan results

### Monthly

- Update dependencies
- Review and optimize costs
- Audit IAM permissions
- Test disaster recovery procedures

### Quarterly

- Review and update documentation
- Conduct security audit
- Performance testing
- Disaster recovery drill
