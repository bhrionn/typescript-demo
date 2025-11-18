# Security Validation Usage Guide

## Quick Start

To run the complete security validation:

```bash
cd infrastructure
npm run validate:security
```

## Prerequisites

1. **Node.js and npm** - Required for building and running scripts
2. **Docker** - Required for CDK synthesis (Lambda bundling)
3. **AWS Credentials** - Required for CDK operations
4. **Environment Variables** - Set before running:

```bash
export AWS_ACCOUNT=123456789012
export AWS_REGION=us-east-1
export ENVIRONMENT=dev
```

## Step-by-Step Validation

### 1. Build Infrastructure Code

```bash
cd infrastructure
npm install
npm run build
```

### 2. Synthesize CloudFormation Templates

```bash
npx cdk synth
```

This creates CloudFormation templates in the `cdk.out/` directory.

### 3. Run Security Validator

```bash
npx ts-node scripts/validate-security.ts
```

Or use the npm script:

```bash
npm run validate:security
```

## What Gets Validated

### Storage Security (Requirements: 8.6, 8.7, 8.8)

- ✓ S3 buckets block all public access
- ✓ S3 buckets have encryption at rest (AES-256)
- ✓ S3 buckets enforce SSL/TLS
- ✓ S3 bucket policies prevent direct public access

### Database Security (Requirements: 8.9, 8.10)

- ✓ RDS is not publicly accessible
- ✓ RDS is in private subnets only
- ✓ RDS has encryption at rest enabled
- ✓ RDS has automated backups configured
- ✓ RDS Multi-AZ deployment (production)
- ✓ RDS deletion protection (production)

### Network Security (Requirements: 8.1, 8.2, 8.3)

- ✓ VPC with private subnets for Lambda and RDS
- ✓ NACLs configured for each subnet tier
- ✓ Security Groups with least privilege rules
- ✓ RDS security group only allows Lambda access
- ✓ NAT Gateways for controlled internet access
- ✓ VPC Flow Logs enabled

### IAM Security (Requirements: 8.12)

- ✓ IAM roles follow least privilege principle
- ✓ No wildcard actions and resources together
- ✓ Managed policies used appropriately
- ✓ Lambda execution roles have minimal permissions

### Application Security (Requirements: 8.4)

- ✓ AWS WAF WebACL configured
- ✓ WAF Core Rule Set enabled
- ✓ SQL injection protection enabled
- ✓ XSS protection enabled
- ✓ Rate limiting configured (2000 req/5min)
- ✓ CloudWatch metrics enabled for WAF

### Authentication Security (Requirements: 8.11)

- ✓ Cognito User Pool configured
- ✓ Strong password policy enforced (min 8 chars, uppercase, lowercase, numbers, symbols)
- ✓ MFA configuration

### Compute Security (Requirements: 8.12)

- ✓ Lambda functions deployed in VPC private subnets
- ✓ X-Ray tracing enabled
- ✓ No secrets in environment variables
- ✓ Secrets retrieved from AWS Secrets Manager

## Understanding Results

### PASS (Green ✓)

The security requirement is properly implemented. No action needed.

### FAIL (Red ✗)

The security requirement is not met. This will block deployment and must be fixed.

**Common failures:**

- S3 bucket allows public access
- RDS is publicly accessible
- No encryption enabled
- Missing security controls

**How to fix:**

1. Review the failed check message
2. Update the relevant CDK stack
3. Rebuild and re-validate

### WARNING (Yellow ⚠)

Potential security concern that doesn't block deployment but should be reviewed.

**Common warnings:**

- Multi-AZ not enabled (acceptable for dev/test)
- MFA not configured (may be optional)
- Some wildcard permissions (may be necessary)

**How to address:**

1. Review if the warning is acceptable for your environment
2. If not acceptable, update the configuration
3. Document why warnings are acceptable if they remain

## Example Output

```
=== Security Validation Results ===

Storage:
  ✓ S3 Bucket WebAppBucket - Public Access: All public access blocked
  ✓ S3 Bucket WebAppBucket - Encryption: Encryption at rest enabled
  ✓ S3 Bucket FileUploadBucket - Public Access: All public access blocked
  ✓ S3 Bucket FileUploadBucket - Encryption: Encryption at rest enabled
  ✓ S3 Bucket FileUploadBucket - SSL Enforcement: SSL/TLS required

Database:
  ✓ RDS Database - Public Access: Not publicly accessible
  ✓ RDS Database - Encryption at Rest: Storage encryption enabled
  ✓ RDS Database - Automated Backups: Backup retention: 7 days
  ⚠ RDS Database - Multi-AZ: Multi-AZ not enabled (acceptable for dev)

Network:
  ✓ VPC: 1 VPC(s) configured
  ✓ Private Subnets: 6 private subnet(s) configured
  ✓ NAT Gateways: 2 NAT Gateway(s) configured
  ✓ VPC Flow Logs: VPC Flow Logs enabled
  ✓ NACLs: 3 NACL(s) configured with 24 rule(s)
  ✓ Security Group LambdaSG - Ingress Rules: Ingress rules are restricted
  ✓ Security Group RDSSG - RDS Access: PostgreSQL port (5432) ingress configured

IAM:
  ✓ IAM Role LambdaExecutionRole - Least Privilege: No wildcard actions or resources
  ✓ IAM Role LambdaExecutionRole - Managed Policies: 3 managed policy(ies) attached

Security:
  ✓ WAF WebACL - Core Rule Set: AWS Managed Core Rule Set enabled
  ✓ WAF WebACL - SQLi Protection: SQL injection protection enabled
  ✓ WAF WebACL - XSS Protection: XSS protection enabled
  ✓ WAF WebACL - Rate Limiting: Rate limiting configured
  ✓ WAF WebACL - Monitoring: CloudWatch metrics enabled

Authentication:
  ✓ Cognito UserPool - Password Policy: Strong password policy configured
  ⚠ Cognito UserPool - MFA: MFA not configured

Compute:
  ✓ Lambda AuthValidation - VPC: Function deployed in VPC
  ✓ Lambda AuthValidation - Tracing: X-Ray tracing enabled
  ✓ Lambda AuthValidation - Secrets: No obvious secrets in environment

=== Summary ===
Total Checks: 35
Passed: 33
Failed: 0
Warnings: 2

⚠️  Security validation passed with warnings
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Validation

on:
  pull_request:
    paths:
      - 'infrastructure/**'
  push:
    branches:
      - main

jobs:
  validate-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd infrastructure
          npm ci

      - name: Run security validation
        run: |
          cd infrastructure
          npm run validate:security
        env:
          AWS_ACCOUNT: ${{ secrets.AWS_ACCOUNT }}
          AWS_REGION: us-east-1
          ENVIRONMENT: dev
```

### GitLab CI

```yaml
security-validation:
  stage: test
  image: node:20
  before_script:
    - cd infrastructure
    - npm ci
  script:
    - npm run validate:security
  variables:
    AWS_ACCOUNT: $AWS_ACCOUNT
    AWS_REGION: us-east-1
    ENVIRONMENT: dev
  only:
    changes:
      - infrastructure/**
```

## Troubleshooting

### Error: "CDK output directory not found"

**Solution:** Run CDK synth first:

```bash
cd infrastructure
npm run build
npx cdk synth
```

### Error: "AWS account not specified"

**Solution:** Set environment variables:

```bash
export AWS_ACCOUNT=123456789012
export AWS_REGION=us-east-1
export ENVIRONMENT=dev
```

### Error: "Docker daemon not running"

**Solution:** Start Docker Desktop or Docker daemon:

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### Error: "Permission denied: validate-security.sh"

**Solution:** Make script executable:

```bash
chmod +x infrastructure/scripts/validate-security.sh
```

### Warning: "cfn-nag not installed"

This is optional. To install:

```bash
gem install cfn-nag
```

## Manual Validation

If automated validation fails, you can manually verify security settings:

### Check S3 Bucket Policies

```bash
aws s3api get-bucket-policy --bucket <bucket-name>
aws s3api get-public-access-block --bucket <bucket-name>
```

### Check RDS Configuration

```bash
aws rds describe-db-instances --db-instance-identifier <instance-id>
```

### Check Security Groups

```bash
aws ec2 describe-security-groups --group-ids <sg-id>
```

### Check IAM Role Policies

```bash
aws iam get-role --role-name <role-name>
aws iam list-attached-role-policies --role-name <role-name>
```

## Best Practices

1. **Run validation before every deployment**

   ```bash
   npm run validate:security && npm run cdk deploy
   ```

2. **Include in pre-commit hooks**

   ```bash
   # .husky/pre-commit
   cd infrastructure && npm run validate:security
   ```

3. **Review warnings regularly**
   - Document acceptable warnings
   - Create tickets for warnings that should be fixed

4. **Keep validation scripts updated**
   - Update when adding new security requirements
   - Review after AWS service updates

5. **Test in development first**
   - Validate dev environment before production
   - Use warnings to identify environment-specific differences

## Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [CDK Security Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html#best-practices-security)
- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [VPC Security Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)
