# Troubleshooting Guide

This guide provides solutions to common issues encountered during development, deployment, and operation of the Federated Auth TypeScript Application.

## Table of Contents

- [Local Development Issues](#local-development-issues)
- [Build and Compilation Issues](#build-and-compilation-issues)
- [Docker Issues](#docker-issues)
- [Infrastructure Deployment Issues](#infrastructure-deployment-issues)
- [Application Runtime Issues](#application-runtime-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [File Upload Issues](#file-upload-issues)
- [Network and Connectivity Issues](#network-and-connectivity-issues)
- [Performance Issues](#performance-issues)
- [Security Issues](#security-issues)

## Local Development Issues

### Node Modules Installation Fails

**Symptoms**:

- `npm install` fails with errors
- Missing dependencies
- Version conflicts

**Solutions**:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json
rm -rf web-app/node_modules web-app/package-lock.json
rm -rf api/node_modules api/package-lock.json
rm -rf infrastructure/node_modules infrastructure/package-lock.json

# Reinstall
npm install

# If still failing, check Node.js version
node --version  # Should be 20.x
nvm use 20
```

### TypeScript Compilation Errors

**Symptoms**:

- `npm run build` fails
- Type errors in IDE
- "Cannot find module" errors

**Solutions**:

```bash
# Rebuild TypeScript
npm run build

# Check TypeScript version
npx tsc --version

# Regenerate type definitions
cd web-app
npm run type-check

# Clear TypeScript cache
rm -rf */dist */build */.tsbuildinfo
npm run build
```

### ESLint/Prettier Conflicts

**Symptoms**:

- Linting errors that auto-fix breaks
- Formatting conflicts
- Pre-commit hooks fail

**Solutions**:

```bash
# Run Prettier first, then ESLint
npm run format
npm run lint:fix

# If conflicts persist, check configuration
cat .eslintrc.json
cat .prettierrc.json

# Disable conflicting rules in .eslintrc.json
```

### Hot Reload Not Working

**Symptoms**:

- Changes not reflected in browser
- Need to manually refresh
- Development server not detecting changes

**Solutions**:

```bash
# Web Application
cd web-app
rm -rf node_modules/.cache
npm run dev

# API
cd api
# Check if ts-node-dev is running
ps aux | grep ts-node-dev
# Restart if needed
npm run dev

# Docker
npm run docker:restart
```

## Build and Compilation Issues

### Web Application Build Fails

**Symptoms**:

- `npm run build` fails in web-app
- Out of memory errors
- Bundle size errors

**Solutions**:

```bash
cd web-app

# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Check for circular dependencies
npm run analyze  # If script exists

# Clear build cache
rm -rf build node_modules/.cache
npm run build
```

### API Build Fails

**Symptoms**:

- TypeScript compilation errors
- Missing type definitions
- Import errors

**Solutions**:

```bash
cd api

# Check for syntax errors
npm run lint

# Rebuild
rm -rf dist
npm run build

# Check tsconfig.json
cat tsconfig.json

# Verify all imports
npm run type-check
```

### Infrastructure Build Fails

**Symptoms**:

- CDK synth fails
- CloudFormation template errors
- Asset bundling fails

**Solutions**:

```bash
cd infrastructure

# Check CDK version
cdk --version

# Clear CDK cache
rm -rf cdk.out
npm run build

# Verify Docker is running (required for Lambda bundling)
docker ps

# Check for CDK errors
npx cdk synth --verbose
```

## Docker Issues

### Docker Services Won't Start

**Symptoms**:

- `docker-compose up` fails
- Services exit immediately
- Port conflicts

**Solutions**:

```bash
# Check if ports are in use
lsof -i :3000  # Web
lsof -i :4000  # API
lsof -i :5432  # PostgreSQL
lsof -i :4566  # LocalStack

# Kill processes using ports
kill -9 $(lsof -t -i:3000)

# Check Docker daemon
docker ps

# Restart Docker Desktop (macOS)
killall Docker && open -a Docker

# View service logs
docker-compose logs web
docker-compose logs api
docker-compose logs postgres
docker-compose logs localstack

# Rebuild images
npm run docker:build
npm run docker:up
```

### PostgreSQL Container Issues

**Symptoms**:

- Database connection refused
- Init script not running
- Data not persisting

**Solutions**:

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify database is running
docker-compose ps postgres

# Connect to database
docker-compose exec postgres psql -U user -d appdb

# Reset database
npm run docker:down
docker volume rm typescript-demo_postgres-data
npm run docker:up

# Check init script
cat docker/init-db.sql
```

### LocalStack Issues

**Symptoms**:

- AWS services not available
- S3 bucket not created
- Secrets not found

**Solutions**:

```bash
# Check LocalStack logs
docker-compose logs localstack

# Verify LocalStack is ready
curl http://localhost:4566/_localstack/health

# Reinitialize LocalStack
docker-compose restart localstack

# Check init script
cat docker/init-localstack.sh

# Manually create resources
aws --endpoint-url=http://localhost:4566 s3 mb s3://test-bucket

# List resources
aws --endpoint-url=http://localhost:4566 s3 ls
aws --endpoint-url=http://localhost:4566 secretsmanager list-secrets
```

### Docker Network Issues

**Symptoms**:

- Services can't communicate
- DNS resolution fails
- Connection timeouts

**Solutions**:

```bash
# Check network
docker network ls
docker network inspect typescript-demo_app-network

# Recreate network
npm run docker:down
docker network prune
npm run docker:up

# Test connectivity
docker-compose exec web ping api
docker-compose exec api ping postgres
```

## Infrastructure Deployment Issues

### CDK Bootstrap Required

**Symptoms**:

- Error: "This stack uses assets, so the toolkit stack must be deployed"
- Deployment fails immediately

**Solutions**:

```bash
# Bootstrap CDK in target account/region
cdk bootstrap aws://ACCOUNT_ID/REGION --profile PROFILE_NAME

# Verify bootstrap stack exists
aws cloudformation describe-stacks \
  --stack-name CDKToolkit \
  --profile PROFILE_NAME
```

### Stack Deployment Fails

**Symptoms**:

- CloudFormation stack in ROLLBACK_COMPLETE state
- Resource creation fails
- Timeout errors

**Solutions**:

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name STACK_NAME \
  --profile PROFILE_NAME \
  --max-items 20

# Delete failed stack
aws cloudformation delete-stack \
  --stack-name STACK_NAME \
  --profile PROFILE_NAME

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name STACK_NAME \
  --profile PROFILE_NAME

# Redeploy
cd infrastructure
npx cdk deploy STACK_NAME --profile PROFILE_NAME

# If deletion fails (resources in use)
# Manually delete resources in AWS console
# Then delete stack
```

### Resource Limit Exceeded

**Symptoms**:

- Error: "LimitExceeded"
- "Maximum number of X exceeded"
- VPC limit, EIP limit, etc.

**Solutions**:

```bash
# Check service quotas
aws service-quotas list-service-quotas \
  --service-code vpc \
  --profile PROFILE_NAME

# Request quota increase
aws service-quotas request-service-quota-increase \
  --service-code vpc \
  --quota-code L-F678F1CE \
  --desired-value 10 \
  --profile PROFILE_NAME

# Or use AWS Console: Service Quotas → AWS services → Request quota increase
```

### IAM Permission Errors

**Symptoms**:

- "User is not authorized to perform"
- "Access Denied"
- Deployment fails with permission errors

**Solutions**:

```bash
# Check current IAM user/role
aws sts get-caller-identity --profile PROFILE_NAME

# Verify required permissions
# Required: CloudFormation, IAM, VPC, Lambda, RDS, S3, etc.

# Use administrator access for initial deployment
# Then create custom deployment role with required permissions

# Check CloudTrail for denied actions
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AccessDenied \
  --profile PROFILE_NAME
```

### Lambda Deployment Issues

**Symptoms**:

- Lambda function code not updated
- "Code storage limit exceeded"
- Lambda bundling fails

**Solutions**:

```bash
# Check Lambda code size
cd api
npm run build
du -sh dist/

# Optimize bundle size
# Remove unnecessary dependencies
# Use Lambda layers for shared code

# Clear old Lambda versions
aws lambda list-versions-by-function \
  --function-name FUNCTION_NAME \
  --profile PROFILE_NAME

# Delete old versions
aws lambda delete-function \
  --function-name FUNCTION_NAME \
  --qualifier VERSION \
  --profile PROFILE_NAME

# Use CDK hotswap for faster Lambda updates
cd infrastructure
npx cdk deploy --hotswap ComputeStack
```

### RDS Deployment Issues

**Symptoms**:

- RDS creation takes too long
- RDS in "backing-up" state
- Multi-AZ deployment fails

**Solutions**:

```bash
# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier DB_IDENTIFIER \
  --profile PROFILE_NAME

# RDS creation can take 10-20 minutes
# Monitor CloudFormation events

# If stuck, check:
# - Subnet group configuration
# - Security group rules
# - Parameter group settings

# For faster development, use single-AZ
# Set DB_MULTI_AZ=false in .env.dev
```

## Application Runtime Issues

### Web Application Not Loading

**Symptoms**:

- Blank page
- 404 errors
- CloudFront errors

**Solutions**:

```bash
# Check CloudFront distribution status
aws cloudfront get-distribution \
  --id DISTRIBUTION_ID \
  --profile PROFILE_NAME

# Check S3 bucket contents
aws s3 ls s3://WEB_BUCKET_NAME/ --profile PROFILE_NAME

# Verify index.html exists
aws s3 ls s3://WEB_BUCKET_NAME/index.html --profile PROFILE_NAME

# Check CloudFront origin configuration
# Ensure origin points to correct S3 bucket

# Create CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*" \
  --profile PROFILE_NAME

# Check browser console for errors
# Open DevTools → Console
```

### API Gateway Errors

**Symptoms**:

- 502 Bad Gateway
- 504 Gateway Timeout
- CORS errors

**Solutions**:

```bash
# Check API Gateway logs
aws logs tail /aws/apigateway/API_ID --follow --profile PROFILE_NAME

# Test API endpoint
curl -v https://API_URL/health

# Check Lambda function logs
aws logs tail /aws/lambda/FUNCTION_NAME --follow --profile PROFILE_NAME

# Verify Lambda integration
aws apigateway get-integration \
  --rest-api-id API_ID \
  --resource-id RESOURCE_ID \
  --http-method GET \
  --profile PROFILE_NAME

# CORS issues:
# - Check API Gateway CORS configuration
# - Verify OPTIONS method exists
# - Check response headers
```

### Lambda Function Errors

**Symptoms**:

- Function timeouts
- Out of memory errors
- Cold start issues

**Solutions**:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/FUNCTION_NAME --follow --profile PROFILE_NAME

# Increase timeout
# Update CDK stack: timeout: Duration.seconds(60)

# Increase memory
# Update CDK stack: memorySize: 1024

# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=FUNCTION_NAME \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average \
  --profile PROFILE_NAME

# Optimize cold starts:
# - Use provisioned concurrency
# - Reduce bundle size
# - Optimize initialization code
```

## Database Issues

### Cannot Connect to Database

**Symptoms**:

- "Connection refused"
- "Timeout"
- "Authentication failed"

**Solutions**:

```bash
# Verify RDS is running
aws rds describe-db-instances \
  --db-instance-identifier DB_IDENTIFIER \
  --profile PROFILE_NAME

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids SG_ID \
  --profile PROFILE_NAME

# Verify Lambda is in correct VPC subnets
aws lambda get-function-configuration \
  --function-name FUNCTION_NAME \
  --profile PROFILE_NAME

# Test connection from bastion host
psql -h RDS_ENDPOINT -U DB_USER -d appdb

# Check Secrets Manager credentials
aws secretsmanager get-secret-value \
  --secret-id SECRET_NAME \
  --profile PROFILE_NAME

# Verify connection string format
# postgresql://user:password@host:5432/database?ssl=true
```

### Database Migration Fails

**Symptoms**:

- Migration script errors
- Schema conflicts
- Data corruption

**Solutions**:

```bash
cd api

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:down

# Fix migration script
# Edit migrations/*.sql

# Rerun migration
npm run migrate:up

# If corrupted, restore from backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier NEW_IDENTIFIER \
  --db-snapshot-identifier SNAPSHOT_ID \
  --profile PROFILE_NAME
```

### Database Performance Issues

**Symptoms**:

- Slow queries
- High CPU usage
- Connection pool exhausted

**Solutions**:

```bash
# Check RDS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=DB_IDENTIFIER \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average \
  --profile PROFILE_NAME

# Enable Performance Insights
aws rds modify-db-instance \
  --db-instance-identifier DB_IDENTIFIER \
  --enable-performance-insights \
  --profile PROFILE_NAME

# Check slow queries
# Connect to database
psql -h RDS_ENDPOINT -U DB_USER -d appdb

# Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s

# Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';

# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM files WHERE user_id = 'xxx';

# Increase connection pool size in Lambda
# Update database connection configuration
```

## Authentication Issues

### Cognito Login Fails

**Symptoms**:

- Redirect loop
- "Invalid redirect URI"
- OAuth errors

**Solutions**:

```bash
# Check Cognito User Pool configuration
aws cognito-idp describe-user-pool \
  --user-pool-id USER_POOL_ID \
  --profile PROFILE_NAME

# Verify callback URLs
aws cognito-idp describe-user-pool-client \
  --user-pool-id USER_POOL_ID \
  --client-id CLIENT_ID \
  --profile PROFILE_NAME

# Update callback URLs if needed
aws cognito-idp update-user-pool-client \
  --user-pool-id USER_POOL_ID \
  --client-id CLIENT_ID \
  --callback-urls "https://example.com/callback" \
  --profile PROFILE_NAME

# Check identity provider configuration
aws cognito-idp describe-identity-provider \
  --user-pool-id USER_POOL_ID \
  --provider-name Google \
  --profile PROFILE_NAME

# Verify OAuth credentials in Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id google-oauth-credentials \
  --profile PROFILE_NAME
```

### JWT Token Validation Fails

**Symptoms**:

- "Invalid token"
- "Token expired"
- Authentication errors in API

**Solutions**:

```bash
# Check token expiration
# Decode JWT at jwt.io

# Verify Cognito User Pool ID in Lambda environment
aws lambda get-function-configuration \
  --function-name FUNCTION_NAME \
  --profile PROFILE_NAME

# Check token validation logic
# Review api/src/services/auth-service.ts

# Test token validation
curl -H "Authorization: Bearer TOKEN" https://API_URL/api/files

# Check Lambda logs for validation errors
aws logs tail /aws/lambda/auth-validation --follow --profile PROFILE_NAME
```

### Federated Login Not Working

**Symptoms**:

- Google/Microsoft login button doesn't work
- OAuth redirect fails
- Provider errors

**Solutions**:

```bash
# Verify identity provider is configured
aws cognito-idp list-identity-providers \
  --user-pool-id USER_POOL_ID \
  --profile PROFILE_NAME

# Check provider credentials
# Google: Verify Client ID and Secret in Google Cloud Console
# Microsoft: Verify Application ID and Secret in Azure Portal

# Update redirect URIs in provider console
# Google: https://COGNITO_DOMAIN.auth.REGION.amazoncognito.com/oauth2/idpresponse
# Microsoft: Same URL

# Test OAuth flow manually
# Open: https://COGNITO_DOMAIN.auth.REGION.amazoncognito.com/oauth2/authorize?...

# Check Cognito hosted UI
# Open: https://COGNITO_DOMAIN.auth.REGION.amazoncognito.com/login
```

## File Upload Issues

### File Upload Fails

**Symptoms**:

- Upload progress stops
- "Upload failed" error
- 413 Payload Too Large

**Solutions**:

```bash
# Check file size limit
# Default: 50MB
# Update in web-app/src/services/FileUploadService.ts

# Check API Gateway payload limit
# Maximum: 10MB for API Gateway
# Use presigned URLs for larger files

# Check Lambda timeout
aws lambda get-function-configuration \
  --function-name file-upload-function \
  --profile PROFILE_NAME

# Increase timeout if needed
# Update CDK stack

# Check S3 bucket permissions
aws s3api get-bucket-policy \
  --bucket BUCKET_NAME \
  --profile PROFILE_NAME

# Test S3 upload directly
aws s3 cp test-file.txt s3://BUCKET_NAME/ --profile PROFILE_NAME

# Check Lambda logs
aws logs tail /aws/lambda/file-upload --follow --profile PROFILE_NAME
```

### File Download Fails

**Symptoms**:

- Presigned URL expired
- Access denied
- File not found

**Solutions**:

```bash
# Check S3 object exists
aws s3 ls s3://BUCKET_NAME/path/to/file --profile PROFILE_NAME

# Verify S3 bucket policy
aws s3api get-bucket-policy \
  --bucket BUCKET_NAME \
  --profile PROFILE_NAME

# Check presigned URL expiration
# Default: 1 hour
# Update in api/src/handlers/api/generate-presigned-url.ts

# Test presigned URL
curl -I "PRESIGNED_URL"

# Check Lambda logs
aws logs tail /aws/lambda/generate-presigned-url --follow --profile PROFILE_NAME
```

## Network and Connectivity Issues

### VPC Configuration Issues

**Symptoms**:

- Lambda can't access internet
- Lambda can't access RDS
- NAT Gateway issues

**Solutions**:

```bash
# Check VPC configuration
aws ec2 describe-vpcs --profile PROFILE_NAME

# Check subnets
aws ec2 describe-subnets --profile PROFILE_NAME

# Verify route tables
aws ec2 describe-route-tables --profile PROFILE_NAME

# Check NAT Gateway
aws ec2 describe-nat-gateways --profile PROFILE_NAME

# Verify Lambda VPC configuration
aws lambda get-function-configuration \
  --function-name FUNCTION_NAME \
  --profile PROFILE_NAME

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids SG_ID \
  --profile PROFILE_NAME

# Enable VPC Flow Logs for debugging
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids VPC_ID \
  --traffic-type ALL \
  --log-destination-type cloud-watch-logs \
  --log-group-name /aws/vpc/flowlogs \
  --profile PROFILE_NAME
```

### CORS Issues

**Symptoms**:

- "CORS policy blocked"
- Preflight request fails
- Missing headers

**Solutions**:

```bash
# Check API Gateway CORS configuration
aws apigateway get-method \
  --rest-api-id API_ID \
  --resource-id RESOURCE_ID \
  --http-method OPTIONS \
  --profile PROFILE_NAME

# Verify CORS headers in Lambda response
# Check api/src/middleware/cors.ts

# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  https://API_URL/api/files

# Update CORS configuration in CDK
# infrastructure/lib/stacks/api-stack.ts
```

## Performance Issues

### Slow Page Load

**Symptoms**:

- Long time to first byte
- Slow asset loading
- Poor Lighthouse scores

**Solutions**:

```bash
# Check CloudFront cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=DISTRIBUTION_ID \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average \
  --profile PROFILE_NAME

# Optimize web bundle
cd web-app
npm run build -- --analyze

# Enable compression
# Check CloudFront compression settings

# Optimize images
# Use WebP format
# Implement lazy loading

# Use CDN for static assets
# Configure proper cache headers
```

### High API Latency

**Symptoms**:

- Slow API responses
- Timeouts
- Poor user experience

**Solutions**:

```bash
# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=API_NAME \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum \
  --profile PROFILE_NAME

# Check Lambda duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=FUNCTION_NAME \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum \
  --profile PROFILE_NAME

# Enable X-Ray tracing
# Check service map for bottlenecks

# Optimize database queries
# Add indexes
# Use connection pooling

# Implement caching
# Use ElastiCache for frequently accessed data
```

## Security Issues

### Security Validation Fails

**Symptoms**:

- Security checklist items fail
- Compliance violations
- Audit findings

**Solutions**:

```bash
# Run security validation
cd infrastructure
npm run validate:security

# Fix specific issues:

# S3 public access
aws s3api put-public-access-block \
  --bucket BUCKET_NAME \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile PROFILE_NAME

# RDS public access
aws rds modify-db-instance \
  --db-instance-identifier DB_IDENTIFIER \
  --no-publicly-accessible \
  --profile PROFILE_NAME

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket BUCKET_NAME \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' \
  --profile PROFILE_NAME

# Review and update CDK stacks
# Redeploy with security fixes
```

### WAF Blocking Legitimate Traffic

**Symptoms**:

- Users getting 403 errors
- Rate limiting too aggressive
- False positives

**Solutions**:

```bash
# Check WAF logs
aws wafv2 get-sampled-requests \
  --web-acl-arn WAF_ARN \
  --rule-metric-name RULE_NAME \
  --scope CLOUDFRONT \
  --time-window StartTime=1234567890,EndTime=1234567900 \
  --max-items 100 \
  --profile PROFILE_NAME

# Adjust rate limit
# Update infrastructure/lib/stacks/waf-stack.ts
# Increase from 2000 to 5000 requests per 5 minutes

# Add IP whitelist
# Create IP set in WAF
# Add rule to allow whitelisted IPs

# Review blocked requests
# Check CloudWatch Logs Insights
# Query: fields @timestamp, httpRequest.clientIp, action
```

## Getting Help

If you can't resolve an issue:

1. **Check Documentation**:
   - [README.md](README.md)
   - [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
   - [Integration Testing Guide](INTEGRATION_TESTING_GUIDE.md)

2. **Check Logs**:
   - CloudWatch Logs
   - CloudFormation Events
   - Application logs

3. **Search Issues**:
   - GitHub Issues
   - AWS Forums
   - Stack Overflow

4. **Contact Support**:
   - Create incident ticket
   - Contact DevOps team
   - AWS Support (if applicable)

5. **Escalation Path**:
   - Level 1: Team lead
   - Level 2: DevOps team
   - Level 3: AWS Support

## Useful Commands Reference

```bash
# Check all service status
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --profile PROFILE_NAME

# Tail all Lambda logs
for func in $(aws lambda list-functions --query 'Functions[].FunctionName' --output text --profile PROFILE_NAME); do
  echo "=== $func ==="
  aws logs tail /aws/lambda/$func --since 1h --profile PROFILE_NAME
done

# Check all CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM --profile PROFILE_NAME

# List all S3 buckets
aws s3 ls --profile PROFILE_NAME

# Check RDS instances
aws rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceStatus]' --output table --profile PROFILE_NAME

# Check API Gateway endpoints
aws apigateway get-rest-apis --profile PROFILE_NAME

# Check CloudFront distributions
aws cloudfront list-distributions --query 'DistributionList.Items[].[Id,DomainName,Status]' --output table --profile PROFILE_NAME
```
