# Security Checklist Verification

This document provides a comprehensive security checklist for the Federated Auth TypeScript Application and instructions for verifying each security requirement.

## Table of Contents

- [Overview](#overview)
- [Automated Verification](#automated-verification)
- [Infrastructure Security](#infrastructure-security)
- [Application Security](#application-security)
- [Data Security](#data-security)
- [Network Security](#network-security)
- [Authentication and Authorization](#authentication-and-authorization)
- [Monitoring and Logging](#monitoring-and-logging)
- [Compliance](#compliance)

## Overview

This checklist covers all security requirements from the design specification (Requirements 8.1-8.17). Each item includes:

- ✅ Requirement description
- 🔍 Verification method
- 📋 Acceptance criteria
- 🛠️ Remediation steps if failing

## Automated Verification

### Run Security Validation Script

The automated security validation script checks most items in this checklist.

```bash
cd infrastructure
npm run validate:security
```

This script validates:

- S3 bucket configurations
- RDS security settings
- VPC and network configuration
- IAM roles and policies
- WAF rules
- Security group rules
- Encryption settings

See [infrastructure/scripts/USAGE.md](infrastructure/scripts/USAGE.md) for detailed usage.

## Infrastructure Security

### 8.1 VPC with Private Subnets

**Requirement**: THE AWS CDK SHALL deploy the Web Application, API Gateway, Lambda Functions, and RDS Database in separate VPC subnets

**Verification**:

```bash
# List VPCs
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=typescript-demo" \
  --query 'Vpcs[*].[VpcId,CidrBlock,Tags[?Key==`Name`].Value|[0]]' \
  --output table

# List subnets
aws ec2 describe-subnets \
  --filters "Name=tag:Project,Values=typescript-demo" \
  --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

**Acceptance Criteria**:

- ✅ VPC exists with CIDR 10.0.0.0/16
- ✅ Public subnets: 10.0.1.0/24, 10.0.2.0/24
- ✅ Private app subnets: 10.0.10.0/24, 10.0.11.0/24
- ✅ Private DB subnets: 10.0.20.0/24, 10.0.21.0/24
- ✅ Subnets span 2 availability zones

**Remediation**:

```bash
cd infrastructure
# Review and update lib/stacks/network-stack.ts
npm run build
npx cdk deploy NetworkStack
```

### 8.2 NACLs Configured

**Requirement**: THE AWS CDK SHALL configure NACLs to control traffic at the subnet level

**Verification**:

```bash
# List NACLs
aws ec2 describe-network-acls \
  --filters "Name=tag:Project,Values=typescript-demo" \
  --query 'NetworkAcls[*].[NetworkAclId,Tags[?Key==`Name`].Value|[0]]' \
  --output table

# Check NACL rules
aws ec2 describe-network-acls \
  --network-acl-ids nacl-xxxxx \
  --query 'NetworkAcls[0].Entries' \
  --output table
```

**Acceptance Criteria**:

- ✅ Public subnet NACL allows HTTP/HTTPS inbound
- ✅ Public subnet NACL allows all outbound
- ✅ App subnet NACL allows from public subnet
- ✅ App subnet NACL denies direct internet access
- ✅ DB subnet NACL allows from app subnet only
- ✅ DB subnet NACL denies all other traffic

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/network-stack.ts
npx cdk deploy NetworkStack
```

### 8.3 Security Groups Configured

**Requirement**: THE AWS CDK SHALL configure Security Groups to restrict traffic between components

**Verification**:

```bash
# List security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:Project,Values=typescript-demo" \
  --query 'SecurityGroups[*].[GroupId,GroupName,Description]' \
  --output table

# Check Lambda security group
aws ec2 describe-security-groups \
  --group-ids sg-lambda \
  --query 'SecurityGroups[0].{Ingress:IpPermissions,Egress:IpPermissionsEgress}'

# Check RDS security group
aws ec2 describe-security-groups \
  --group-ids sg-rds \
  --query 'SecurityGroups[0].{Ingress:IpPermissions,Egress:IpPermissionsEgress}'
```

**Acceptance Criteria**:

- ✅ Lambda SG allows egress to RDS, S3, Secrets Manager
- ✅ Lambda SG has no ingress rules (not needed)
- ✅ RDS SG allows ingress from Lambda SG on port 5432 only
- ✅ RDS SG has no other ingress rules
- ✅ No security groups allow 0.0.0.0/0 ingress

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/security-stack.ts
npx cdk deploy SecurityStack
```

### 8.4 AWS WAF Configured

**Requirement**: THE AWS CDK SHALL provision AWS WAF rules to protect against SQL injection and XSS attacks

**Verification**:

```bash
# List WAF WebACLs
aws wafv2 list-web-acls \
  --scope CLOUDFRONT \
  --region us-east-1

# Get WebACL details
aws wafv2 get-web-acl \
  --scope CLOUDFRONT \
  --id webacl-id \
  --name webacl-name \
  --region us-east-1

# Check rules
aws wafv2 get-web-acl \
  --scope CLOUDFRONT \
  --id webacl-id \
  --name webacl-name \
  --region us-east-1 \
  --query 'WebACL.Rules[*].[Name,Priority]' \
  --output table
```

**Acceptance Criteria**:

- ✅ WAF WebACL exists and is associated with CloudFront
- ✅ AWS Managed Core Rule Set enabled
- ✅ AWS Managed Known Bad Inputs rule enabled
- ✅ SQL injection protection enabled
- ✅ XSS protection enabled
- ✅ Rate limiting configured (2000 req/5min)
- ✅ CloudWatch metrics enabled

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/waf-stack.ts
npx cdk deploy WafStack
```

### 8.5 CloudFront HTTPS Enforcement

**Requirement**: THE CloudFront SHALL enforce HTTPS for all connections

**Verification**:

```bash
# Get CloudFront distribution
aws cloudfront get-distribution \
  --id distribution-id \
  --query 'Distribution.DistributionConfig.{ViewerProtocolPolicy:DefaultCacheBehavior.ViewerProtocolPolicy,MinimumProtocolVersion:ViewerCertificate.MinimumProtocolVersion}'

# Check all cache behaviors
aws cloudfront get-distribution \
  --id distribution-id \
  --query 'Distribution.DistributionConfig.CacheBehaviors.Items[*].ViewerProtocolPolicy'
```

**Acceptance Criteria**:

- ✅ ViewerProtocolPolicy is "redirect-to-https" or "https-only"
- ✅ MinimumProtocolVersion is TLSv1.2_2021 or higher
- ✅ All cache behaviors enforce HTTPS

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/cdn-stack.ts
npx cdk deploy CdnStack
```

### 8.6 S3 Bucket Encryption

**Requirement**: THE AWS CDK SHALL enable encryption at rest for the S3 Bucket

**Verification**:

```bash
# Check bucket encryption
aws s3api get-bucket-encryption \
  --bucket bucket-name

# Check all project buckets
for bucket in $(aws s3 ls | grep typescript-demo | awk '{print $3}'); do
  echo "=== $bucket ==="
  aws s3api get-bucket-encryption --bucket $bucket 2>&1 || echo "No encryption"
done
```

**Acceptance Criteria**:

- ✅ All S3 buckets have encryption enabled
- ✅ Encryption algorithm is AES256 or aws:kms
- ✅ Web app bucket has encryption
- ✅ File upload bucket has encryption

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/storage-stack.ts
npx cdk deploy StorageStack
```

### 8.7 S3 Public Access Block

**Requirement**: S3 buckets SHALL block all public access

**Verification**:

```bash
# Check public access block
aws s3api get-public-access-block \
  --bucket bucket-name

# Check all project buckets
for bucket in $(aws s3 ls | grep typescript-demo | awk '{print $3}'); do
  echo "=== $bucket ==="
  aws s3api get-public-access-block --bucket $bucket
done
```

**Acceptance Criteria**:

- ✅ BlockPublicAcls: true
- ✅ IgnorePublicAcls: true
- ✅ BlockPublicPolicy: true
- ✅ RestrictPublicBuckets: true
- ✅ All four settings enabled for all buckets

**Remediation**:

```bash
# Fix via CLI
aws s3api put-public-access-block \
  --bucket bucket-name \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Or update CDK
cd infrastructure
npx cdk deploy StorageStack
```

### 8.8 S3 Bucket Policies

**Requirement**: THE AWS CDK SHALL configure S3 bucket policies to prevent direct public access

**Verification**:

```bash
# Check bucket policy
aws s3api get-bucket-policy \
  --bucket bucket-name \
  --query 'Policy' \
  --output text | jq

# Check for public access statements
aws s3api get-bucket-policy \
  --bucket bucket-name \
  --query 'Policy' \
  --output text | jq '.Statement[] | select(.Principal=="*" or .Principal.AWS=="*")'
```

**Acceptance Criteria**:

- ✅ No statements with Principal: "\*" allowing public access
- ✅ Web bucket allows CloudFront OAI only
- ✅ File upload bucket denies all public access
- ✅ Bucket policies enforce SSL/TLS

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/storage-stack.ts
npx cdk deploy StorageStack
```

### 8.9 RDS Encryption at Rest

**Requirement**: THE AWS CDK SHALL enable encryption at rest for RDS Database

**Verification**:

```bash
# Check RDS encryption
aws rds describe-db-instances \
  --db-instance-identifier db-identifier \
  --query 'DBInstances[0].{Encrypted:StorageEncrypted,KmsKeyId:KmsKeyId}'
```

**Acceptance Criteria**:

- ✅ StorageEncrypted: true
- ✅ KmsKeyId is set (or using default key)

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/storage-stack.ts
# Note: Cannot enable encryption on existing unencrypted DB
# Must create new encrypted DB and migrate data
npx cdk deploy StorageStack
```

### 8.10 RDS in Private Subnets

**Requirement**: THE AWS CDK SHALL configure the RDS Database to accept connections only from Lambda Functions

**Verification**:

```bash
# Check RDS public accessibility
aws rds describe-db-instances \
  --db-instance-identifier db-identifier \
  --query 'DBInstances[0].{PubliclyAccessible:PubliclyAccessible,SubnetGroup:DBSubnetGroup.DBSubnetGroupName,SecurityGroups:VpcSecurityGroups[*].VpcSecurityGroupId}'

# Check subnet group
aws rds describe-db-subnet-groups \
  --db-subnet-group-name subnet-group-name \
  --query 'DBSubnetGroups[0].Subnets[*].{SubnetId:SubnetIdentifier,AZ:SubnetAvailabilityZone.Name}'
```

**Acceptance Criteria**:

- ✅ PubliclyAccessible: false
- ✅ DB is in private database subnets
- ✅ Security group allows Lambda SG only
- ✅ No internet gateway route to DB subnets

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/storage-stack.ts
npx cdk deploy StorageStack
```

### 8.11 Cognito Configuration

**Requirement**: THE AWS CDK SHALL configure Cognito with strong password policy and federated identity providers

**Verification**:

```bash
# Check User Pool
aws cognito-idp describe-user-pool \
  --user-pool-id user-pool-id \
  --query 'UserPool.{PasswordPolicy:Policies.PasswordPolicy,MfaConfiguration:MfaConfiguration}'

# Check identity providers
aws cognito-idp list-identity-providers \
  --user-pool-id user-pool-id \
  --query 'Providers[*].{ProviderName:ProviderName,ProviderType:ProviderType}'
```

**Acceptance Criteria**:

- ✅ Minimum password length: 8
- ✅ Requires uppercase letters
- ✅ Requires lowercase letters
- ✅ Requires numbers
- ✅ Requires symbols
- ✅ Google identity provider configured
- ✅ Microsoft identity provider configured

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/cognito-stack.ts
npx cdk deploy CognitoStack
```

### 8.12 IAM Least Privilege

**Requirement**: THE AWS CDK SHALL implement least privilege IAM roles for all services

**Verification**:

```bash
# List IAM roles
aws iam list-roles \
  --query 'Roles[?contains(RoleName, `typescript-demo`)].RoleName'

# Check Lambda execution role
aws iam get-role \
  --role-name role-name \
  --query 'Role.AssumeRolePolicyDocument'

# List attached policies
aws iam list-attached-role-policies \
  --role-name role-name

# Check inline policies
aws iam list-role-policies \
  --role-name role-name

# Get policy details
aws iam get-policy-version \
  --policy-arn policy-arn \
  --version-id v1 \
  --query 'PolicyVersion.Document'
```

**Acceptance Criteria**:

- ✅ No wildcard (_) actions with wildcard (_) resources
- ✅ Lambda roles have specific resource ARNs
- ✅ Roles follow principle of least privilege
- ✅ No overly permissive policies

**Remediation**:

```bash
cd infrastructure
# Review IAM policies in all stacks
npx cdk deploy --all
```

### 8.13 CloudTrail Enabled

**Requirement**: THE AWS CDK SHALL enable AWS CloudTrail for audit logging

**Verification**:

```bash
# List trails
aws cloudtrail list-trails

# Get trail status
aws cloudtrail get-trail-status \
  --name trail-name

# Describe trail
aws cloudtrail describe-trails \
  --trail-name-list trail-name
```

**Acceptance Criteria**:

- ✅ CloudTrail is enabled
- ✅ Trail is logging
- ✅ Multi-region trail enabled
- ✅ Log file validation enabled
- ✅ Logs stored in S3 with encryption

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/monitoring-stack.ts
npx cdk deploy MonitoringStack
```

### 8.14 VPC Flow Logs

**Requirement**: THE AWS CDK SHALL configure VPC Flow Logs for network monitoring

**Verification**:

```bash
# List flow logs
aws ec2 describe-flow-logs \
  --filter "Name=resource-id,Values=vpc-id"

# Check flow log configuration
aws ec2 describe-flow-logs \
  --flow-log-ids fl-xxxxx
```

**Acceptance Criteria**:

- ✅ VPC Flow Logs enabled
- ✅ Traffic type: ALL
- ✅ Logs sent to CloudWatch Logs
- ✅ Log retention configured

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/network-stack.ts
npx cdk deploy NetworkStack
```

### 8.15 AWS Config Enabled

**Requirement**: THE AWS CDK SHALL enable AWS Config for compliance monitoring

**Verification**:

```bash
# Check Config status
aws configservice describe-configuration-recorders

# Check Config rules
aws configservice describe-config-rules \
  --query 'ConfigRules[*].{Name:ConfigRuleName,State:ConfigRuleState}'

# Check compliance
aws configservice describe-compliance-by-config-rule
```

**Acceptance Criteria**:

- ✅ AWS Config is enabled
- ✅ Configuration recorder is recording
- ✅ Config rules are active
- ✅ Compliance status is tracked

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/monitoring-stack.ts
npx cdk deploy MonitoringStack
```

### 8.16 Structured Logging

**Requirement**: Lambda functions SHALL implement structured logging with CloudWatch

**Verification**:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/function-name --follow

# Query structured logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/function-name \
  --filter-pattern '{ $.level = "ERROR" }'

# Check log retention
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/ \
  --query 'logGroups[*].{Name:logGroupName,Retention:retentionInDays}'
```

**Acceptance Criteria**:

- ✅ All Lambda functions log to CloudWatch
- ✅ Logs are structured (JSON format)
- ✅ Log retention is configured
- ✅ Logs include request ID, timestamp, level

**Remediation**:

```bash
# Update Lambda logging
cd api
# Review src/middleware/logging.ts
npm run build

cd ../infrastructure
npx cdk deploy ComputeStack
```

### 8.17 API Gateway Logging

**Requirement**: API Gateway SHALL enable CloudWatch logging

**Verification**:

```bash
# Check API Gateway stage settings
aws apigateway get-stage \
  --rest-api-id api-id \
  --stage-name stage-name \
  --query '{AccessLogSettings:accessLogSettings,MethodSettings:methodSettings}'

# Check logs
aws logs tail /aws/apigateway/api-name --follow
```

**Acceptance Criteria**:

- ✅ Access logging enabled
- ✅ Execution logging enabled
- ✅ Log format includes request details
- ✅ Logs sent to CloudWatch

**Remediation**:

```bash
cd infrastructure
# Review lib/stacks/api-stack.ts
npx cdk deploy ApiStack
```

## Application Security

### Input Validation

**Verification**:

```bash
# Review validation code
cat api/src/middleware/validation.ts
cat web-app/src/services/FileUploadService.ts

# Test with invalid input
curl -X POST https://api-url/api/files \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'
```

**Acceptance Criteria**:

- ✅ All API endpoints validate input
- ✅ File upload validates type and size
- ✅ SQL injection prevention (prepared statements)
- ✅ XSS prevention (input sanitization)

### CORS Configuration

**Verification**:

```bash
# Test CORS
curl -X OPTIONS https://api-url/api/files \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Check headers
curl -X GET https://api-url/api/files \
  -H "Origin: https://example.com" \
  -v
```

**Acceptance Criteria**:

- ✅ CORS headers present
- ✅ Allowed origins configured
- ✅ Allowed methods specified
- ✅ Credentials handling configured

### Authentication

**Verification**:

```bash
# Test without token
curl https://api-url/api/files

# Test with invalid token
curl -H "Authorization: Bearer invalid-token" \
  https://api-url/api/files

# Test with valid token
curl -H "Authorization: Bearer valid-token" \
  https://api-url/api/files
```

**Acceptance Criteria**:

- ✅ Endpoints require authentication
- ✅ Invalid tokens are rejected
- ✅ Token validation is performed
- ✅ Proper error messages returned

## Data Security

### Encryption in Transit

**Verification**:

```bash
# Test TLS version
openssl s_client -connect api-url:443 -tls1_2

# Check certificate
openssl s_client -connect api-url:443 -showcerts

# Test database connection
psql "postgresql://user@host:5432/db?sslmode=require"
```

**Acceptance Criteria**:

- ✅ TLS 1.2 or higher enforced
- ✅ Valid SSL certificates
- ✅ Database connections use SSL
- ✅ No unencrypted connections allowed

### Secrets Management

**Verification**:

```bash
# List secrets
aws secretsmanager list-secrets \
  --query 'SecretList[?contains(Name, `typescript-demo`)].Name'

# Check secret rotation
aws secretsmanager describe-secret \
  --secret-id secret-name \
  --query '{RotationEnabled:RotationEnabled,LastRotatedDate:LastRotatedDate}'

# Verify no secrets in code
grep -r "password\|secret\|key" api/src/ web-app/src/ --exclude-dir=node_modules
```

**Acceptance Criteria**:

- ✅ Secrets stored in Secrets Manager
- ✅ No hardcoded secrets in code
- ✅ Secrets rotation configured
- ✅ Lambda retrieves secrets at runtime

## Monitoring and Logging

### CloudWatch Alarms

**Verification**:

```bash
# List alarms
aws cloudwatch describe-alarms \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue,Metric:MetricName}'

# Check alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name alarm-name \
  --max-records 10
```

**Acceptance Criteria**:

- ✅ Lambda error rate alarm configured
- ✅ API Gateway 5xx alarm configured
- ✅ RDS CPU alarm configured
- ✅ RDS storage alarm configured
- ✅ Alarms have SNS notifications

### Log Aggregation

**Verification**:

```bash
# Check log groups
aws logs describe-log-groups \
  --query 'logGroups[*].{Name:logGroupName,Retention:retentionInDays,Size:storedBytes}'

# Query logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/function-name \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

**Acceptance Criteria**:

- ✅ All services log to CloudWatch
- ✅ Log retention configured
- ✅ Logs are searchable
- ✅ Log insights queries work

## Compliance

### Security Checklist Summary

Run the automated validation and generate a report:

```bash
cd infrastructure
npm run validate:security > security-report.txt

# Review report
cat security-report.txt

# Check for failures
grep "FAIL" security-report.txt
```

### Manual Review Checklist

- [ ] All automated checks pass
- [ ] No hardcoded secrets in code
- [ ] Dependencies are up to date
- [ ] Security patches applied
- [ ] Access logs reviewed
- [ ] Incident response plan documented
- [ ] Disaster recovery tested
- [ ] Team trained on security procedures

### Quarterly Security Audit

- [ ] Review IAM permissions
- [ ] Rotate credentials
- [ ] Update security documentation
- [ ] Conduct penetration testing
- [ ] Review CloudTrail logs
- [ ] Update security policies
- [ ] Train team on new threats

## Remediation Priority

### Critical (Fix Immediately)

- Public S3 buckets
- Unencrypted data at rest
- RDS publicly accessible
- Missing authentication
- Wildcard IAM permissions

### High (Fix Within 1 Week)

- Missing CloudTrail
- No VPC Flow Logs
- Weak password policies
- Missing WAF rules
- No rate limiting

### Medium (Fix Within 1 Month)

- Missing alarms
- Log retention not configured
- No MFA on Cognito
- Missing backup retention

### Low (Fix When Possible)

- Documentation updates
- Optimization opportunities
- Non-critical warnings

## Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services)
- [Security Validation Script](infrastructure/scripts/USAGE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
