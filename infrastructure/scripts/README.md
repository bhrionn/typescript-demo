# Security Validation Scripts

This directory contains scripts for validating the security configuration of the AWS infrastructure.

## Overview

The security validation process ensures that all security checklist items from the design document are properly implemented in the CDK infrastructure code.

**Requirements Covered:** 8.1, 8.2, 8.3, 8.6, 8.7, 8.8, 8.9, 8.12

## Scripts

### validate-security.sh

Main security validation script that orchestrates the entire validation process.

**Usage:**

```bash
cd infrastructure
npm run validate:security
```

Or directly:

```bash
cd infrastructure
./scripts/validate-security.sh
```

**What it does:**

1. Builds the CDK infrastructure code
2. Synthesizes CloudFormation templates
3. Runs the TypeScript security validator
4. Runs Jest security checklist tests
5. Optionally runs cfn-nag (if installed)

### validate-security.ts

TypeScript-based security validator that analyzes synthesized CloudFormation templates.

**Usage:**

```bash
cd infrastructure
npm run build
npx cdk synth
npx ts-node scripts/validate-security.ts
```

**What it validates:**

#### Storage Security

- ✓ S3 buckets have public access blocked
- ✓ S3 buckets have encryption at rest enabled
- ✓ S3 buckets enforce SSL/TLS for all requests

#### Database Security

- ✓ RDS instances are not publicly accessible
- ✓ RDS has encryption at rest enabled
- ✓ RDS has automated backups configured
- ✓ RDS Multi-AZ deployment (production)
- ✓ RDS deletion protection (production)

#### Network Security

- ✓ VPC with private subnets configured
- ✓ NAT Gateways for controlled internet access
- ✓ VPC Flow Logs enabled
- ✓ NACLs configured for subnet-level filtering
- ✓ Security Groups follow least privilege
- ✓ RDS security group restricts access to Lambda only

#### IAM Security

- ✓ IAM roles follow least privilege principle
- ✓ No wildcard actions and resources together
- ✓ Managed policies used appropriately

#### Application Security

- ✓ AWS WAF WebACL configured
- ✓ WAF Core Rule Set enabled
- ✓ SQL injection protection enabled
- ✓ XSS protection enabled
- ✓ Rate limiting configured
- ✓ CloudWatch metrics enabled for WAF

#### Authentication Security

- ✓ Cognito User Pool configured
- ✓ Strong password policy enforced
- ✓ MFA configuration

#### Compute Security

- ✓ Lambda functions deployed in VPC
- ✓ X-Ray tracing enabled
- ✓ No secrets in environment variables

## Output

The validation script provides color-coded output:

- 🟢 **PASS** - Security requirement is properly implemented
- 🔴 **FAIL** - Security requirement is not met (blocks deployment)
- 🟡 **WARNING** - Potential security concern (doesn't block deployment)

### Example Output

```
=== Security Validation Results ===

Network:
  ✓ VPC: 1 VPC(s) configured
  ✓ Private Subnets: 6 private subnet(s) configured
  ✓ NAT Gateways: 2 NAT Gateway(s) configured
  ✓ VPC Flow Logs: VPC Flow Logs enabled
  ✓ NACLs: 3 NACL(s) configured with 24 rule(s)

Storage:
  ✓ S3 Bucket WebAppBucket - Public Access: All public access blocked
  ✓ S3 Bucket WebAppBucket - Encryption: Encryption at rest enabled
  ✓ S3 Bucket FileUploadBucket - Public Access: All public access blocked
  ✓ S3 Bucket FileUploadBucket - Encryption: Encryption at rest enabled

Database:
  ✓ RDS Database - Public Access: Not publicly accessible
  ✓ RDS Database - Encryption at Rest: Storage encryption enabled
  ✓ RDS Database - Automated Backups: Backup retention: 7 days

=== Summary ===
Total Checks: 45
Passed: 42
Failed: 0
Warnings: 3

✅ All security checks passed!
```

## Integration with CI/CD

Add the security validation to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Validate Security
  run: |
    cd infrastructure
    npm install
    npm run validate:security
```

## Optional: cfn-nag

For additional security validation, install cfn-nag:

```bash
gem install cfn-nag
```

cfn-nag provides additional CloudFormation-specific security checks and will run automatically if installed.

## Troubleshooting

### "CDK output directory not found"

Make sure to synthesize templates first:

```bash
cd infrastructure
npm run build
npx cdk synth
```

### "No templates found"

Ensure the CDK app is properly configured and can synthesize:

```bash
cd infrastructure
npx cdk list
```

### Script permission denied

Make the script executable:

```bash
chmod +x infrastructure/scripts/validate-security.sh
```

## Security Checklist Reference

The validation script checks all items from the security checklist in the design document:

### Infrastructure Security

- [ ] VPC with private subnets for Lambda and RDS
- [ ] NACLs configured for each subnet tier
- [ ] Security Groups with least privilege rules
- [ ] AWS WAF with managed rule sets enabled
- [ ] CloudFront with HTTPS enforcement
- [ ] S3 buckets with encryption at rest (AES-256)
- [ ] S3 bucket policies preventing public access
- [ ] RDS encryption at rest enabled
- [ ] RDS in private subnets only
- [ ] RDS automated backups enabled
- [ ] Secrets Manager for database credentials
- [ ] IAM roles with least privilege policies
- [ ] CloudTrail enabled for audit logging
- [ ] VPC Flow Logs enabled
- [ ] AWS Config for compliance monitoring

### Application Security

- [ ] Cognito User Pool with federated identity providers
- [ ] JWT token validation in all Lambda functions
- [ ] API Gateway request validation
- [ ] Input sanitization for all user inputs
- [ ] Prepared statements for database queries
- [ ] TLS 1.2+ for all API communications
- [ ] CORS properly configured
- [ ] Rate limiting on API endpoints
- [ ] File type and size validation
- [ ] No direct S3 access from web application

## Related Files

- `infrastructure/tests/security-checklist.test.ts` - Jest tests for security checklist
- `infrastructure/lib/stacks/security-stack.ts` - Security Groups and NACLs
- `infrastructure/lib/stacks/waf-stack.ts` - WAF configuration
- `infrastructure/lib/stacks/storage-stack.ts` - S3 and RDS security
- `infrastructure/lib/stacks/compute-stack.ts` - Lambda IAM roles
