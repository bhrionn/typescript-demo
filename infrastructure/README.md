# Infrastructure

AWS CDK infrastructure code for the TypeScript Demo application.

## Overview

This directory contains AWS CDK code written in TypeScript that defines all cloud infrastructure for the application. The infrastructure is organized into multiple stacks for better modularity and follows SOLID design principles.

## Project Structure

```
infrastructure/
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   ├── config/
│   │   └── environment.ts  # Environment configuration loader
│   ├── stacks/
│   │   └── base-stack.ts   # Base stack class with common properties
│   └── constructs/         # Reusable CDK constructs
├── tests/                  # Infrastructure tests
├── cdk.json                # CDK configuration
└── package.json
```

## Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`

## Environment Configuration

The infrastructure supports three environments:

- **dev** - Development environment (single AZ, minimal backups)
- **staging** - Staging environment (multi-AZ, moderate backups)
- **prod** - Production environment (multi-AZ, extended backups, RETAIN policy)

### Environment Variables

Set these environment variables before deployment:

```bash
export AWS_ACCOUNT=123456789012      # Your AWS account ID
export AWS_REGION=us-east-1          # Target AWS region
export ENVIRONMENT=dev               # Target environment (dev/staging/prod)
```

Alternatively, use CDK context:

```bash
cdk deploy --context environment=dev
```

## Common Commands

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Synthesize CloudFormation

Generate CloudFormation templates:

```bash
npm run cdk synth
```

### Show Differences

Compare deployed stack with current state:

```bash
npm run cdk diff
```

### Deploy

Deploy to AWS:

```bash
# Deploy all stacks
npm run cdk deploy --all

# Deploy specific stack
npm run cdk deploy NetworkStack
```

### Destroy

Remove all resources (use with caution):

```bash
npm run cdk destroy --all
```

### List Stacks

List all stacks in the app:

```bash
npm run cdk list
```

## Deployment Examples

### Deploy to Development

```bash
export AWS_ACCOUNT=123456789012
export AWS_REGION=us-east-1
export ENVIRONMENT=dev

npm run build
npm run cdk deploy --all
```

### Deploy to Production

```bash
export AWS_ACCOUNT=123456789012
export AWS_REGION=us-east-1
export ENVIRONMENT=prod

npm run build
npm run cdk diff  # Review changes first
npm run cdk deploy --all --require-approval broadening
```

## Stack Organization

Stacks are organized with dependencies:

1. **NetworkStack** - VPC, subnets, NACLs
2. **SecurityStack** - WAF, Security Groups
3. **WafStack** - AWS WAF WebACL with security rules
4. **CognitoStack** - User Pool, Identity Providers
5. **StorageStack** - S3 buckets, RDS database
6. **ComputeStack** - Lambda functions
7. **ApiStack** - API Gateway
8. **CdnStack** - CloudFront distribution
9. **MonitoringStack** - CloudTrail, CloudWatch alarms, AWS Config

### Stack Details

- **NetworkStack**: See [README-NETWORK.md](lib/stacks/README-NETWORK.md)
- **SecurityStack**: See [README-SECURITY.md](lib/stacks/README-SECURITY.md)
- **WafStack**: See [README-WAF.md](lib/stacks/README-WAF.md)
- **CognitoStack**: See [README-COGNITO.md](lib/stacks/README-COGNITO.md)
- **StorageStack**: See [README-STORAGE.md](lib/stacks/README-STORAGE.md)
- **ComputeStack**: See [README-COMPUTE.md](lib/stacks/README-COMPUTE.md)
- **ApiStack**: See [README-API.md](lib/stacks/README-API.md)
- **CdnStack**: See [README-CDN.md](lib/stacks/README-CDN.md)
- **MonitoringStack**: See [README-MONITORING.md](lib/stacks/README-MONITORING.md)

## Configuration

### Environment-Specific Settings

Each environment has specific configuration in `lib/config/environment.ts`:

- VPC CIDR ranges
- Multi-AZ settings
- Backup retention periods
- Log retention periods
- Resource tags

### CDK Context

CDK context is configured in `cdk.json` with feature flags and default settings.

## Testing

Run infrastructure tests:

```bash
npm test
```

Tests include:

- Snapshot tests for stack outputs
- Fine-grained assertions for security configurations
- Resource property validation

### Security Validation

Run comprehensive security validation:

```bash
npm run validate:security
```

This validates all security checklist items including:

- S3 bucket policies prevent public access
- RDS is in private subnets only
- Encryption settings for S3 and RDS
- IAM roles follow least privilege
- Security group rules are properly configured
- WAF rules are enabled
- VPC and network configuration

See [scripts/README.md](scripts/README.md) for detailed documentation on security validation.

**Requirements:** 8.1, 8.2, 8.3, 8.6, 8.7, 8.8, 8.9, 8.12

## Naming Convention

Resources follow this naming pattern:

```
{project}-{environment}-{resourceType}-{name}
```

Example: `typescript-demo-prod-lambda-file-upload`

## Security

All stacks extend `BaseStack` which provides:

- Environment-aware removal policies
- Consistent tagging
- Resource naming conventions
- Common utility methods

Production resources use `RETAIN` removal policy to prevent accidental deletion.

## Troubleshooting

### Bootstrap Required

If you see "CDK bootstrap required" error:

```bash
cdk bootstrap aws://${AWS_ACCOUNT}/${AWS_REGION}
```

### Permission Errors

Ensure your AWS credentials have sufficient permissions to create resources.

### Stack Dependencies

Deploy stacks in order if you encounter dependency errors. The CDK will automatically handle dependencies when using `--all`.

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [CDK TypeScript Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
