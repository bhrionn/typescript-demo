# End-to-End Integration Testing Guide

This guide provides comprehensive instructions for performing end-to-end integration testing of the federated authentication TypeScript application.

## Overview

This document covers testing all aspects of the deployed application including:

- Federated authentication (Google, Microsoft)
- File upload and storage
- API functionality
- Security controls
- Database operations

## Prerequisites

### Required Tools

- AWS CLI configured with appropriate credentials
- Node.js 20+ and npm
- Docker and Docker Compose (for local testing)
- Web browser (Chrome, Firefox, or Safari)
- PostgreSQL client (psql)

### Environment Setup

1. **AWS Credentials**

   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and Region
   ```

2. **Environment Variables**

   ```bash
   export AWS_REGION=us-east-1
   export ENVIRONMENT=dev  # or staging, prod
   ```

3. **Install Dependencies**
   ```bash
   npm install
   cd web-app && npm install && cd ..
   cd api && npm install && cd ..
   cd infrastructure && npm install && cd ..
   ```

## Testing Phases

### Phase 1: Infrastructure Deployment Verification

#### 1.1 Deploy Infrastructure

```bash
cd infrastructure

# Synthesize CloudFormation templates
npm run build
cdk synth

# Deploy to development environment
cdk deploy --all --require-approval never

# Save stack outputs
cdk deploy --all --outputs-file outputs.json
```

#### 1.2 Verify Stack Deployment

```bash
# Check all stacks are deployed
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `typescript-demo`)].StackName'

# Verify resources
aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-network \
  --query 'Stacks[0].StackStatus'
```

#### 1.3 Run Security Validation

```bash
# Validate security checklist
npm run validate:security

# Expected output: All security checks should pass
```

### Phase 2: Authentication Testing

#### 2.1 Verify Cognito Configuration

```bash
# Get User Pool ID from stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

echo "User Pool ID: $USER_POOL_ID"

# Verify identity providers
aws cognito-idp list-identity-providers \
  --user-pool-id $USER_POOL_ID

# Expected: Google and Microsoft providers should be listed
```

#### 2.2 Test Google Authentication

**Manual Test Steps:**

1. Navigate to the application URL (from CloudFront distribution)
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Verify redirect to dashboard
5. Check browser console for JWT token
6. Verify user session is active

**Verification:**

```bash
# Check Cognito user was created
aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --filter "email = \"your-google-email@gmail.com\""
```

#### 2.3 Test Microsoft Authentication

**Manual Test Steps:**

1. Log out from the application
2. Click "Sign in with Microsoft"
3. Complete Microsoft OAuth flow
4. Verify redirect to dashboard
5. Check browser console for JWT token
6. Verify user session is active

**Verification:**

```bash
# Check Cognito user was created
aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --filter "email = \"your-microsoft-email@outlook.com\""
```

#### 2.4 Test Session Management

**Manual Test Steps:**

1. Log in successfully
2. Wait for token expiration (or manually expire token)
3. Attempt to access protected route
4. Verify redirect to login page
5. Log in again
6. Verify session restored

### Phase 3: File Upload Testing

#### 3.1 Prepare Test Files

```bash
# Create test files of various types and sizes
mkdir -p test-files

# Small text file
echo "Test content" > test-files/test.txt

# Image file (create or download)
curl -o test-files/test-image.jpg https://via.placeholder.com/150

# PDF file (create or download)
# Add your own PDF file

# Large file (near 50MB limit)
dd if=/dev/zero of=test-files/large-file.bin bs=1M count=45
```

#### 3.2 Test File Upload via UI

**Manual Test Steps:**

1. Log in to the application
2. Navigate to file upload section
3. Select a test file (test.txt)
4. Click upload
5. Verify progress bar displays
6. Verify success message
7. Verify file appears in file list

**Verification:**

```bash
# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`FilesBucketName`].OutputValue' \
  --output text)

# List uploaded files
aws s3 ls s3://$BUCKET_NAME/ --recursive

# Verify encryption
aws s3api head-object \
  --bucket $BUCKET_NAME \
  --key <file-key-from-list> \
  --query 'ServerSideEncryption'

# Expected: AES256
```

#### 3.3 Test File Type Validation

**Manual Test Steps:**

1. Attempt to upload an executable file (.exe)
2. Verify error message about invalid file type
3. Attempt to upload a valid file type
4. Verify upload succeeds

#### 3.4 Test File Size Validation

**Manual Test Steps:**

1. Attempt to upload a file > 50MB
2. Verify error message about file size
3. Upload a file < 50MB
4. Verify upload succeeds

#### 3.5 Verify File Metadata in Database

```bash
# Get RDS endpoint
RDS_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
  --output text)

# Get database credentials from Secrets Manager
SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' \
  --output text)

DB_CREDS=$(aws secretsmanager get-secret-value \
  --secret-id $SECRET_ARN \
  --query 'SecretString' \
  --output text)

# Extract credentials
DB_USER=$(echo $DB_CREDS | jq -r '.username')
DB_PASS=$(echo $DB_CREDS | jq -r '.password')
DB_NAME=$(echo $DB_CREDS | jq -r '.dbname')

# Connect to database and verify file records
PGPASSWORD=$DB_PASS psql -h $RDS_ENDPOINT -U $DB_USER -d $DB_NAME -c "
SELECT id, file_name, file_size, mime_type, uploaded_at
FROM files
ORDER BY uploaded_at DESC
LIMIT 10;
"
```

### Phase 4: File Retrieval and Download Testing

#### 4.1 Test File List Retrieval

**Manual Test Steps:**

1. Log in to the application
2. Navigate to dashboard
3. Verify list of uploaded files displays
4. Verify file metadata (name, size, date) is correct

**API Test:**

```bash
# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Get JWT token (from browser console after login)
JWT_TOKEN="<your-jwt-token>"

# Test file list endpoint
curl -X GET \
  -H "Authorization: Bearer $JWT_TOKEN" \
  $API_ENDPOINT/api/files
```

#### 4.2 Test File Download

**Manual Test Steps:**

1. Click download button on a file
2. Verify presigned URL is generated
3. Verify file downloads successfully
4. Verify downloaded file matches uploaded file

**API Test:**

```bash
# Get presigned URL for a file
FILE_ID="<file-id-from-list>"

curl -X GET \
  -H "Authorization: Bearer $JWT_TOKEN" \
  $API_ENDPOINT/api/files/$FILE_ID/download

# Use the returned presigned URL to download
curl -o downloaded-file "<presigned-url>"

# Verify file integrity
md5sum test-files/test.txt downloaded-file
```

### Phase 5: Security Controls Verification

#### 5.1 Verify WAF Protection

```bash
# Get WAF WebACL ID
WAF_ACL_ID=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-waf \
  --query 'Stacks[0].Outputs[?OutputKey==`WebAclId`].OutputValue' \
  --output text)

# Check WAF rules
aws wafv2 get-web-acl \
  --scope CLOUDFRONT \
  --id $WAF_ACL_ID \
  --name typescript-demo-dev-waf

# Test rate limiting (send many requests)
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" $API_ENDPOINT/api/health
done

# Expected: Some requests should return 429 (rate limited)
```

#### 5.2 Verify Network Isolation

```bash
# Verify RDS is not publicly accessible
aws rds describe-db-instances \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `typescript-demo`)].PubliclyAccessible'

# Expected: false

# Verify Lambda functions are in VPC
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `typescript-demo`)].VpcConfig'

# Expected: VPC configuration should be present
```

#### 5.3 Verify S3 Bucket Security

```bash
# Check public access block
aws s3api get-public-access-block \
  --bucket $BUCKET_NAME

# Expected: All blocks should be true

# Check bucket encryption
aws s3api get-bucket-encryption \
  --bucket $BUCKET_NAME

# Expected: AES256 encryption

# Attempt direct access (should fail)
curl -I https://$BUCKET_NAME.s3.amazonaws.com/

# Expected: 403 Forbidden
```

#### 5.4 Verify CloudFront HTTPS Enforcement

```bash
# Get CloudFront distribution
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-cdn \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

# Check viewer protocol policy
aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query 'Distribution.DistributionConfig.DefaultCacheBehavior.ViewerProtocolPolicy'

# Expected: redirect-to-https or https-only

# Test HTTP redirect
CLOUDFRONT_URL=$(aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query 'Distribution.DomainName' \
  --output text)

curl -I http://$CLOUDFRONT_URL

# Expected: 301 redirect to HTTPS
```

#### 5.5 Verify Security Groups

```bash
# Get Lambda security group
LAMBDA_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*lambda*" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

# Check Lambda SG rules
aws ec2 describe-security-groups \
  --group-ids $LAMBDA_SG

# Get RDS security group
RDS_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*rds*" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

# Check RDS SG rules (should only allow from Lambda SG)
aws ec2 describe-security-groups \
  --group-ids $RDS_SG
```

#### 5.6 Verify CloudTrail Logging

```bash
# Check CloudTrail is enabled
aws cloudtrail describe-trails \
  --query 'trailList[?contains(Name, `typescript-demo`)]'

# Get recent events
aws cloudtrail lookup-events \
  --max-results 10 \
  --query 'Events[*].[EventTime,EventName,Username]' \
  --output table
```

### Phase 6: Error Handling and Edge Cases

#### 6.1 Test Unauthorized Access

```bash
# Attempt API call without token
curl -X GET $API_ENDPOINT/api/files

# Expected: 401 Unauthorized

# Attempt with invalid token
curl -X GET \
  -H "Authorization: Bearer invalid-token" \
  $API_ENDPOINT/api/files

# Expected: 401 Unauthorized
```

#### 6.2 Test Invalid File Upload

**Manual Test Steps:**

1. Attempt to upload empty file
2. Verify error message
3. Attempt to upload file with no extension
4. Verify error message
5. Attempt to upload file with special characters in name
6. Verify handling

#### 6.3 Test Network Errors

**Manual Test Steps:**

1. Start file upload
2. Disable network mid-upload
3. Verify error message
4. Re-enable network
5. Retry upload
6. Verify success

### Phase 7: Performance and Monitoring

#### 7.1 Check CloudWatch Metrics

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=typescript-demo-dev-file-upload \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=typescript-demo-dev-file-upload \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# API Gateway requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

#### 7.2 Check CloudWatch Logs

```bash
# Get Lambda log groups
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/typescript-demo

# Get recent logs
LOG_GROUP="/aws/lambda/typescript-demo-dev-file-upload"
aws logs tail $LOG_GROUP --follow
```

#### 7.3 Check RDS Performance

```bash
# Get RDS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=typescript-demo-dev-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Database connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=typescript-demo-dev-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

## Test Checklist

Use this checklist to track testing progress:

### Infrastructure

- [ ] All CDK stacks deployed successfully
- [ ] Security validation script passes
- [ ] VPC and subnets configured correctly
- [ ] NACLs configured for each tier
- [ ] Security groups follow least privilege

### Authentication

- [ ] Google login works end-to-end
- [ ] Microsoft login works end-to-end
- [ ] JWT tokens issued correctly
- [ ] Session expiration handled properly
- [ ] Logout functionality works
- [ ] Unauthorized access blocked

### File Upload

- [ ] File upload via UI succeeds
- [ ] Progress bar displays correctly
- [ ] File stored in S3 with encryption
- [ ] File metadata stored in RDS
- [ ] File type validation works
- [ ] File size validation works
- [ ] Invalid files rejected

### File Retrieval

- [ ] File list displays correctly
- [ ] File metadata accurate
- [ ] Presigned URLs generated
- [ ] File download works
- [ ] Downloaded file matches uploaded

### Security Controls

- [ ] WAF rules active and blocking threats
- [ ] Rate limiting enforced
- [ ] RDS not publicly accessible
- [ ] S3 buckets not publicly accessible
- [ ] CloudFront enforces HTTPS
- [ ] Lambda functions in VPC
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enabled
- [ ] CloudTrail logging active
- [ ] VPC Flow Logs enabled

### Error Handling

- [ ] Authentication errors handled gracefully
- [ ] Upload errors displayed to user
- [ ] Network errors handled
- [ ] Invalid input rejected
- [ ] API errors logged

### Performance

- [ ] CloudWatch metrics available
- [ ] Logs accessible
- [ ] No excessive errors
- [ ] Response times acceptable

## Automated Testing Script

A helper script is provided to automate some of the testing:

```bash
./run-integration-tests.sh dev
```

This script will:

1. Verify infrastructure deployment
2. Run security validation
3. Test API endpoints
4. Check CloudWatch metrics
5. Generate test report

## Troubleshooting

### Authentication Issues

**Problem**: OAuth redirect fails
**Solution**:

- Verify callback URLs in Cognito
- Check CloudFront distribution URL
- Verify identity provider configuration

### File Upload Issues

**Problem**: Upload fails with 403
**Solution**:

- Verify JWT token is valid
- Check Lambda IAM role has S3 permissions
- Verify S3 bucket policy

### Database Connection Issues

**Problem**: Lambda can't connect to RDS
**Solution**:

- Verify Lambda is in correct VPC subnets
- Check security group rules
- Verify database credentials in Secrets Manager

### Performance Issues

**Problem**: Slow response times
**Solution**:

- Check Lambda memory allocation
- Verify RDS instance size
- Check CloudWatch metrics for bottlenecks

## Cleanup

After testing, clean up resources:

```bash
cd infrastructure

# Destroy all stacks
cdk destroy --all

# Verify all resources deleted
aws cloudformation list-stacks \
  --stack-status-filter DELETE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `typescript-demo`)].StackName'
```

## Requirements Coverage

This integration testing guide covers the following requirements:

- **Requirement 1.1, 1.2, 1.3**: Federated authentication testing
- **Requirement 2.1, 2.2, 2.3, 2.4, 2.5**: File upload and API testing
- **Requirement 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**: Security controls verification

## Conclusion

Following this guide ensures comprehensive end-to-end testing of all application features and security controls. All tests should pass before promoting to production.
