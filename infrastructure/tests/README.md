# CDK Infrastructure Tests

This directory contains comprehensive tests for the AWS CDK infrastructure, including snapshot tests, fine-grained assertions, and security checklist validation.

## Test Files

### Stack Tests

- **network-stack.test.ts** - Tests for VPC, subnets, NAT gateways, and VPC Flow Logs
- **security-stack.test.ts** - Tests for Security Groups and Network ACLs
- **waf-stack.test.ts** - Tests for AWS WAF WebACL and security rules
- **cognito-stack.test.ts** - Tests for Cognito User Pool and authentication configuration

### Security Validation

- **security-checklist.test.ts** - Comprehensive security checklist validation covering all security requirements from the design document

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only security checklist tests
npm run test:security

# Run security validation (includes cfn-nag if installed)
npm run validate:security
```

## Test Coverage

### Network Stack Tests (24 tests)

- ✓ VPC configuration with correct CIDR
- ✓ Public, private application, and private database subnets
- ✓ NAT Gateways for high availability
- ✓ Internet Gateway configuration
- ✓ VPC Flow Logs to CloudWatch
- ✓ Route tables for each subnet type
- ✓ Stack outputs for cross-stack references
- ✓ Security checklist items (DNS, Flow Logs, subnet isolation)

### Security Stack Tests (30 tests)

- ✓ Lambda Security Group with specific egress rules
- ✓ RDS Security Group with restricted ingress
- ✓ Network ACLs for public, application, and database subnets
- ✓ NACL rules for HTTP/HTTPS, PostgreSQL, and ephemeral ports
- ✓ Security Group associations and rules
- ✓ Stack outputs for cross-stack references
- ✓ Security checklist items (least privilege, network isolation)

### WAF Stack Tests (26 tests)

- ✓ WebACL with CloudFront scope
- ✓ AWS Managed Rules (Core, Known Bad Inputs, SQL Injection)
- ✓ Rate-based rule (2000 requests per 5 minutes)
- ✓ Custom XSS protection rule
- ✓ Rule priorities and visibility configuration
- ✓ CloudWatch metrics enabled
- ✓ Stack outputs for cross-stack references
- ✓ Security checklist items (WAF rules, monitoring)

### Cognito Stack Tests (28 tests)

- ✓ User Pool with email as username
- ✓ Password policy (min 8 chars, uppercase, lowercase, numbers, symbols)
- ✓ MFA optional configuration
- ✓ Email recovery enabled
- ✓ User Pool Domain for hosted UI
- ✓ User Pool Client with OAuth configuration
- ✓ Token validity settings
- ✓ Federated identity provider support
- ✓ Stack outputs for cross-stack references
- ✓ Security checklist items (authentication, password policy)

### Security Checklist Tests (18 tests)

Validates all security requirements from the design document:

**Infrastructure Security:**

- ✓ VPC with private subnets for Lambda and RDS
- ✓ NACLs configured for each subnet tier
- ✓ Security Groups with least privilege rules
- ✓ AWS WAF with managed rule sets enabled
- ✓ VPC Flow Logs enabled
- ✓ IAM roles with least privilege policies

**Application Security:**

- ✓ Cognito User Pool with federated identity providers
- ✓ Strong password policy
- ✓ Rate limiting enabled
- ✓ SQL injection protection
- ✓ XSS protection

**Network Security:**

- ✓ Database subnets isolated (no internet access)
- ✓ NAT Gateways for controlled internet access
- ✓ Database NACL restricts access to application tier only
- ✓ RDS Security Group only allows Lambda access

**Monitoring and Compliance:**

- ✓ VPC Flow Logs capture all traffic
- ✓ WAF CloudWatch metrics enabled
- ✓ All rules have visibility configuration

## Test Patterns

### Snapshot Tests

Each stack includes a snapshot test that captures the entire CloudFormation template. This helps detect unintended changes.

```typescript
test('matches snapshot', () => {
  expect(template.toJSON()).toMatchSnapshot();
});
```

### Fine-Grained Assertions

Tests use CDK assertions to verify specific resource properties:

```typescript
template.hasResourceProperties('AWS::EC2::VPC', {
  CidrBlock: '10.0.0.0/16',
  EnableDnsHostnames: true,
  EnableDnsSupport: true,
});
```

### Security Validation

Security tests verify that resources meet security requirements:

```typescript
test('RDS security group only allows ingress from Lambda', () => {
  const ingressRules = template.findResources('AWS::EC2::SecurityGroupIngress', {
    Properties: {
      IpProtocol: 'tcp',
      FromPort: 5432,
      ToPort: 5432,
    },
  });
  expect(Object.keys(ingressRules).length).toBe(1);
});
```

## CloudFormation Security Validation (cfn-nag)

The `validate:security` script runs cfn-nag to scan CloudFormation templates for security issues.

### Installing cfn-nag

```bash
gem install cfn-nag
```

### Running cfn-nag

```bash
npm run validate:security
```

This will:

1. Build the CDK project
2. Synthesize CloudFormation templates
3. Run cfn-nag on all templates
4. Run Jest security checklist tests
5. Generate a security validation report

## Requirements Coverage

These tests validate the following requirements from the design document:

- **Requirement 7.4**: Infrastructure validation before deployment
- **Requirement 8.1**: Security checklist implementation
- **Requirement 8.2**: Network security controls (NACLs, Security Groups)
- **Requirement 8.3**: VPC isolation and subnet separation
- **Requirement 8.4**: AWS WAF configuration
- **Requirement 8.6**: S3 encryption (validated in storage stack tests)
- **Requirement 8.7**: RDS encryption (validated in storage stack tests)
- **Requirement 8.8**: RDS in private subnets
- **Requirement 8.9**: RDS automated backups (validated in storage stack tests)
- **Requirement 8.12**: IAM least privilege policies

## Continuous Integration

These tests should be run as part of the CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run CDK Tests
  run: |
    cd infrastructure
    npm install
    npm test
    npm run validate:security
```

## Troubleshooting

### Tests Failing After Stack Changes

If tests fail after modifying stacks:

1. Review the test output to understand what changed
2. Update snapshot tests if changes are intentional: `npm test -- -u`
3. Update fine-grained assertions to match new resource properties
4. Ensure security requirements are still met

### cfn-nag Warnings

If cfn-nag reports warnings:

1. Review the specific security issue
2. Update the stack to address the concern
3. If the warning is a false positive, document why it's acceptable
4. Consider adding cfn-nag suppression rules if necessary

## Best Practices

1. **Run tests before deploying** - Always run tests before deploying infrastructure changes
2. **Update snapshots carefully** - Review snapshot changes to ensure they're intentional
3. **Add tests for new resources** - When adding new stacks or resources, add corresponding tests
4. **Validate security** - Run security validation regularly to catch issues early
5. **Keep tests maintainable** - Use helper functions and clear test descriptions
