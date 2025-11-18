# Security Validation - Quick Reference

## One-Line Command

```bash
cd infrastructure && npm run validate:security
```

## What It Checks

| Category     | Checks                                                         |
| ------------ | -------------------------------------------------------------- |
| **Storage**  | S3 public access blocked, encryption enabled, SSL enforced     |
| **Database** | RDS not public, encrypted, backups enabled, in private subnets |
| **Network**  | VPC, private subnets, NACLs, security groups, flow logs        |
| **IAM**      | Least privilege, no wildcard permissions                       |
| **WAF**      | Core rules, SQLi protection, XSS protection, rate limiting     |
| **Auth**     | Cognito configured, strong password policy                     |
| **Compute**  | Lambda in VPC, tracing enabled, no secrets in env vars         |

## Result Codes

- 🟢 **PASS** - Security requirement met ✅
- 🔴 **FAIL** - Security issue found ❌ (blocks deployment)
- 🟡 **WARNING** - Review recommended ⚠️ (doesn't block)

## Common Commands

```bash
# Full validation
npm run validate:security

# Just build and synth
npm run build && npx cdk synth

# Run TypeScript validator only
npx ts-node scripts/validate-security.ts

# Run security tests only
npm run test:security
```

## Prerequisites

```bash
export AWS_ACCOUNT=123456789012
export AWS_REGION=us-east-1
export ENVIRONMENT=dev
```

## Quick Fixes

### S3 Public Access

```typescript
blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL;
```

### RDS Not Public

```typescript
publiclyAccessible: false;
```

### Enable Encryption

```typescript
// S3
encryption: s3.BucketEncryption.S3_MANAGED;

// RDS
storageEncrypted: true;
```

### Security Group Least Privilege

```typescript
// Only allow specific sources
securityGroup.addIngressRule(
  ec2.Peer.securityGroupId(lambdaSG.securityGroupId),
  ec2.Port.tcp(5432)
);
```

## Troubleshooting

| Error                | Solution                                    |
| -------------------- | ------------------------------------------- |
| CDK output not found | Run `npx cdk synth`                         |
| AWS account not set  | Set `AWS_ACCOUNT` env var                   |
| Docker not running   | Start Docker Desktop                        |
| Permission denied    | Run `chmod +x scripts/validate-security.sh` |

## CI/CD Snippet

```yaml
- name: Security Validation
  run: cd infrastructure && npm run validate:security
```

## Documentation

- Full docs: [README.md](README.md)
- Usage guide: [USAGE.md](USAGE.md)
- Implementation: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## Requirements Covered

✅ 8.1 - Security checklist verification  
✅ 8.2 - Security group validation  
✅ 8.3 - Network security validation  
✅ 8.6 - S3 encryption validation  
✅ 8.7 - S3 public access validation  
✅ 8.8 - RDS encryption validation  
✅ 8.9 - RDS private subnet validation  
✅ 8.12 - IAM least privilege validation
