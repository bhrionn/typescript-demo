# StorageStack Documentation

## Overview

The StorageStack creates and configures S3 buckets for web application hosting and file uploads, as well as an RDS PostgreSQL database for persistent data storage. All resources are configured with enterprise-grade security controls including encryption, access restrictions, and automated backups.

## Resources Created

### S3 Buckets

#### 1. Web Application Bucket

- **Purpose**: Hosts static web application assets (HTML, CSS, JavaScript)
- **Naming**: `{project}-{environment}-s3-web-app`
- **Encryption**: S3-managed encryption (AES-256)
- **Access**:
  - Block all direct public access
  - Accessible only via CloudFront distribution
  - SSL/TLS enforced for all connections
- **Versioning**: Enabled in production
- **CORS**: Configured for GET and HEAD methods

#### 2. File Upload Bucket

- **Purpose**: Stores user-uploaded files
- **Naming**: `{project}-{environment}-s3-file-uploads`
- **Encryption**: S3-managed encryption (AES-256)
- **Access**:
  - Block all public access
  - Accessible only by Lambda functions via IAM roles
  - SSL/TLS enforced for all connections
  - Explicit bucket policy denies non-SSL requests
- **Versioning**: Enabled in production
- **Lifecycle**: Old versions deleted after 30 days
- **CORS**: Configured for PUT and POST methods

### RDS PostgreSQL Database

#### Configuration

- **Engine**: PostgreSQL 15.4
- **Instance Identifier**: `{project}-{environment}-rds-postgres`
- **Database Name**: `appdb`
- **Instance Class**:
  - Development: `db.t3.micro`
  - Production: `db.t3.medium`
- **Storage**:
  - Development: 20GB allocated, 100GB max
  - Production: 100GB allocated, 500GB max
  - Type: GP3 (General Purpose SSD)
  - Encryption: Enabled at rest

#### High Availability & Backup

- **Multi-AZ**:
  - Development: Disabled
  - Production: Enabled
- **Backup Retention**:
  - Development: 1 day
  - Production: 30 days
- **Backup Window**: 3:00-4:00 AM UTC
- **Maintenance Window**: Sunday 4:00-5:00 AM UTC
- **Deletion Protection**: Enabled in production

#### Security

- **Network**: Deployed in private database subnets (10.0.20.0/24, 10.0.21.0/24)
- **Security Group**: Accepts connections only from Lambda security group on port 5432
- **SSL/TLS**: Enforced via parameter group (`rds.force_ssl = 1`)
- **Credentials**: Stored in AWS Secrets Manager
- **Public Access**: Disabled (never publicly accessible)

#### Monitoring & Logging

- **CloudWatch Logs**: PostgreSQL and upgrade logs exported
- **Performance Insights**: Enabled in production
- **Connection Logging**: Enabled
- **Query Duration Logging**: Enabled

### AWS Secrets Manager

#### Database Credentials Secret

- **Name**: `{project}-{environment}-secret-rds-credentials`
- **Contents**:
  - Username: `dbadmin`
  - Password: Auto-generated 32-character string (no punctuation)
- **Rotation**: Manual (can be configured for automatic rotation)
- **Access**: Granted to Lambda functions via IAM policies

## Environment-Specific Configuration

### Development

```typescript
{
  enableMultiAz: false,
  rdsBackupRetentionDays: 1,
  instanceType: 'db.t3.micro',
  allocatedStorage: 20,
  deletionProtection: false,
  performanceInsights: false,
  versioning: false
}
```

### Production

```typescript
{
  enableMultiAz: true,
  rdsBackupRetentionDays: 30,
  instanceType: 'db.t3.medium',
  allocatedStorage: 100,
  deletionProtection: true,
  performanceInsights: true,
  versioning: true
}
```

## Stack Dependencies

The StorageStack depends on:

1. **NetworkStack**: Provides VPC and private database subnets
2. **SecurityStack**: Provides RDS security group

## Stack Outputs

The following values are exported for use by other stacks:

### S3 Outputs

- `WebAppBucketName`: Name of the web application bucket
- `WebAppBucketArn`: ARN of the web application bucket
- `FileUploadBucketName`: Name of the file upload bucket
- `FileUploadBucketArn`: ARN of the file upload bucket

### RDS Outputs

- `DatabaseEndpoint`: RDS instance endpoint address
- `DatabasePort`: RDS instance port (5432)
- `DatabaseName`: Database name (appdb)
- `DatabaseSecretArn`: ARN of the credentials secret
- `DatabaseSecretName`: Name of the credentials secret

## Usage in Other Stacks

### Accessing S3 Buckets

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

// Reference the file upload bucket
const fileUploadBucket = s3.Bucket.fromBucketName(
  this,
  'FileUploadBucket',
  cdk.Fn.importValue(`${stackName}-FileUploadBucketName`)
);

// Grant Lambda function write access
fileUploadBucket.grantWrite(lambdaFunction);
```

### Accessing RDS Credentials

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// Reference the database secret
const databaseSecret = secretsmanager.Secret.fromSecretNameV2(
  this,
  'DatabaseSecret',
  cdk.Fn.importValue(`${stackName}-DatabaseSecretName`)
);

// Grant Lambda function read access
databaseSecret.grantRead(lambdaFunction);

// Use in Lambda environment variables
lambdaFunction.addEnvironment('DB_SECRET_ARN', databaseSecret.secretArn);
```

### Connecting to RDS from Lambda

```typescript
// Lambda function environment variables
{
  DB_HOST: cdk.Fn.importValue(`${stackName}-DatabaseEndpoint`),
  DB_PORT: cdk.Fn.importValue(`${stackName}-DatabasePort`),
  DB_NAME: cdk.Fn.importValue(`${stackName}-DatabaseName`),
  DB_SECRET_ARN: cdk.Fn.importValue(`${stackName}-DatabaseSecretArn`)
}
```

## Security Checklist

- [x] S3 buckets encrypted at rest (AES-256)
- [x] S3 bucket policies prevent direct public access
- [x] SSL/TLS enforced for all S3 connections
- [x] RDS encryption at rest enabled
- [x] RDS in private subnets only
- [x] RDS security group restricts access to Lambda only
- [x] SSL/TLS enforced for RDS connections
- [x] RDS credentials stored in Secrets Manager
- [x] RDS automated backups enabled
- [x] Multi-AZ deployment for production
- [x] CloudWatch logging enabled
- [x] Deletion protection enabled for production

## Cost Optimization

### Development Environment

- Single-AZ deployment reduces costs by ~50%
- Smaller instance type (t3.micro)
- Minimal storage allocation
- Short backup retention (1 day)
- Auto-delete objects on stack deletion

### Production Environment

- Multi-AZ for high availability
- Appropriate instance sizing (t3.medium)
- Storage auto-scaling (100GB → 500GB)
- Extended backup retention (30 days)
- Performance Insights for monitoring

## Deployment

```bash
# Deploy to development
AWS_ACCOUNT=123456789012 AWS_REGION=us-east-1 \
  cdk deploy StorageStack --context environment=dev

# Deploy to production
AWS_ACCOUNT=123456789012 AWS_REGION=us-east-1 \
  cdk deploy StorageStack --context environment=prod
```

## Troubleshooting

### RDS Connection Issues

1. Verify Lambda is in the correct VPC and subnets
2. Check security group rules allow traffic from Lambda SG
3. Verify SSL/TLS is enabled in connection string
4. Check Secrets Manager permissions for Lambda role

### S3 Access Issues

1. Verify IAM role has appropriate S3 permissions
2. Check bucket policies don't conflict with IAM policies
3. Ensure SSL/TLS is used in all requests
4. Verify CORS configuration for web uploads

### Secret Rotation

To enable automatic secret rotation:

```typescript
databaseCredentials.addRotationSchedule('RotationSchedule', {
  automaticallyAfter: cdk.Duration.days(30),
});
```

## Related Documentation

- [Network Stack](./README-NETWORK.md)
- [Security Stack](./README-SECURITY.md)
- [AWS RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [AWS S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
