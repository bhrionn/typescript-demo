# ComputeStack - Lambda Functions

## Overview

The ComputeStack creates AWS Lambda functions for serverless API processing and business logic. All Lambda functions run in VPC private subnets with least privilege IAM roles and share common dependencies via a Lambda Layer.

## Lambda Functions

### 1. Authentication Validation Function

- **Purpose**: Validates JWT tokens from AWS Cognito
- **Handler**: `handlers/auth/validate.handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB (dev) / 512 MB (prod)

### 2. File Upload Function

- **Purpose**: Processes file uploads to S3 and stores metadata in RDS
- **Handler**: `handlers/files/upload.handler`
- **Timeout**: 60 seconds (longer for file processing)
- **Memory**: 512 MB (dev) / 1024 MB (prod)

### 3. File List Function

- **Purpose**: Retrieves list of user's uploaded files from RDS
- **Handler**: `handlers/files/list.handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB (dev) / 512 MB (prod)

### 4. File Metadata Function

- **Purpose**: Retrieves file metadata by ID from RDS
- **Handler**: `handlers/files/metadata.handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB (dev) / 512 MB (prod)

### 5. File Download URL Function

- **Purpose**: Generates presigned S3 URLs for secure file downloads
- **Handler**: `handlers/files/download-url.handler`
- **Timeout**: 30 seconds
- **Memory**: 256 MB (dev) / 512 MB (prod)

## Lambda Layer

### Shared Dependencies Layer

- **Name**: `{project}-{env}-lambda-layer-shared`
- **Runtime**: Node.js 20.x
- **Dependencies**:
  - `@aws-sdk/client-s3` - S3 operations
  - `@aws-sdk/client-secrets-manager` - Secrets retrieval
  - `@aws-sdk/client-cognito-identity-provider` - Cognito operations
  - `pg` - PostgreSQL database client

The Lambda Layer reduces deployment package size and allows sharing common dependencies across all functions.

## IAM Role and Permissions

### Lambda Execution Role

The Lambda execution role follows the principle of least privilege with the following permissions:

#### Managed Policies

- `AWSLambdaBasicExecutionRole` - CloudWatch Logs access
- `AWSLambdaVPCAccessExecutionRole` - VPC network interface management
- `AWSXRayDaemonWriteAccess` - X-Ray tracing

#### Custom Permissions

- **Secrets Manager**: Read access to RDS credentials secret
- **S3**: Read/Write access to file upload bucket
- **Cognito**: GetUser, AdminGetUser, ListUsers for token validation

## Network Configuration

### VPC Integration

- **Subnets**: Private application subnets (10.0.10.0/24, 10.0.11.0/24)
- **Security Group**: Lambda security group with:
  - Egress to RDS on port 5432
  - Egress to AWS services (S3, Secrets Manager) on port 443
- **Internet Access**: Via NAT Gateway in public subnets

### Security Features

- No direct internet access (uses NAT Gateway)
- Isolated from public subnets
- Can only access RDS in database subnets
- All traffic encrypted in transit (TLS)

## Environment Variables

All Lambda functions receive the following environment variables:

- `NODE_ENV` - Environment name (dev/staging/prod)
- `DATABASE_SECRET_ARN` - ARN of RDS credentials in Secrets Manager
- `FILE_UPLOAD_BUCKET` - Name of S3 bucket for file uploads
- `USER_POOL_ID` - Cognito User Pool ID for token validation
- `AWS_NODEJS_CONNECTION_REUSE_ENABLED` - Enable HTTP connection reuse (set to '1')

## Monitoring and Observability

### CloudWatch Logs

- Log retention: 7 days
- Automatic log group creation
- Structured JSON logging recommended

### X-Ray Tracing

- Active tracing enabled on all functions
- Traces requests through Lambda, S3, RDS, and Secrets Manager
- Helps identify performance bottlenecks

### CloudWatch Metrics

Standard Lambda metrics available:

- Invocations
- Duration
- Errors
- Throttles
- Concurrent executions

## Dependencies

The ComputeStack depends on:

- **NetworkStack**: VPC and private application subnets
- **SecurityStack**: Lambda security group
- **StorageStack**: RDS database secret and S3 file upload bucket
- **CognitoStack**: User Pool ID and ARN for authentication

## Deployment

### Prerequisites

1. Build the API code: `cd api && npm run build`
2. Ensure all dependent stacks are deployed

### Deploy Command

```bash
cd infrastructure
cdk deploy ComputeStack --context environment=dev
```

### Stack Outputs

The stack exports the following values for use by other stacks:

- Lambda Layer ARN
- Function ARNs and names for all Lambda functions

## Local Development

For local development and testing:

1. Use LocalStack to simulate Lambda functions
2. Set environment variables in `.env` file
3. Use SAM CLI for local Lambda invocation:
   ```bash
   sam local invoke FileUploadFunction -e events/upload.json
   ```

## Cost Optimization

### Development Environment

- Smaller memory allocation (256-512 MB)
- Shorter log retention (7 days)
- Single NAT Gateway option available

### Production Environment

- Optimized memory allocation (512-1024 MB)
- Longer log retention (configurable)
- Multi-AZ NAT Gateways for high availability

### Best Practices

- Use Lambda Layer to reduce deployment package size
- Enable connection reuse for better performance
- Set appropriate timeout values to avoid unnecessary charges
- Monitor and adjust memory allocation based on actual usage

## Security Considerations

### Least Privilege

- IAM role grants only necessary permissions
- No wildcard permissions except where required by AWS
- Secrets retrieved from Secrets Manager, not environment variables

### Network Isolation

- Functions run in private subnets only
- No direct internet access
- Security groups restrict traffic to necessary services

### Data Protection

- All data in transit encrypted (TLS)
- Database credentials stored in Secrets Manager
- S3 bucket encryption enabled
- X-Ray data encrypted

## Troubleshooting

### Common Issues

#### Lambda Timeout

- Check CloudWatch Logs for slow queries or S3 operations
- Increase timeout or memory allocation
- Verify database connection pooling

#### VPC Connectivity

- Ensure NAT Gateway is running
- Verify security group rules
- Check NACL configurations

#### Permission Errors

- Verify IAM role has necessary permissions
- Check resource policies (S3 bucket policy, etc.)
- Ensure Secrets Manager secret is accessible

#### Cold Start Performance

- Consider provisioned concurrency for critical functions
- Optimize Lambda package size
- Use Lambda Layer for shared dependencies

## Requirements Mapping

This stack implements the following requirements:

- **2.3**: Lambda functions validate authentication tokens
- **2.4**: Lambda functions store files in S3
- **2.5**: Lambda functions record metadata in RDS
- **8.12**: IAM roles follow least privilege principle
