# WAF Stack Documentation

## Overview

The WAF Stack creates an AWS WAF WebACL with comprehensive security rules to protect the CloudFront distribution from common web exploits and attacks.

## Security Rules Implemented

### 1. AWS Managed Rules - Core Rule Set

- **Priority**: 0
- **Description**: Provides protection against common web vulnerabilities including OWASP Top 10
- **Action**: Block malicious requests based on AWS-managed rule set
- **Rule Set**: `AWS-AWSManagedRulesCommonRuleSet`

### 2. AWS Managed Rules - Known Bad Inputs

- **Priority**: 1
- **Description**: Blocks requests with patterns known to be malicious
- **Action**: Block requests matching known bad input patterns
- **Rule Set**: `AWS-AWSManagedRulesKnownBadInputsRuleSet`

### 3. AWS Managed Rules - SQL Injection Protection

- **Priority**: 2
- **Description**: Protects against SQL injection attacks
- **Action**: Block requests with SQL injection patterns
- **Rule Set**: `AWS-AWSManagedRulesSQLiRuleSet`

### 4. Rate-Based Rule

- **Priority**: 3
- **Description**: Prevents abuse by limiting requests per IP address
- **Limit**: 2000 requests per 5 minutes per IP
- **Action**: Block IPs exceeding the rate limit
- **Aggregate Key**: IP address

### 5. Custom XSS Protection Rule

- **Priority**: 4
- **Description**: Additional XSS protection beyond the Core Rule Set
- **Inspects**:
  - Query strings
  - Request body
  - URI path
- **Text Transformations**:
  - URL decode
  - HTML entity decode
- **Action**: Block requests with XSS patterns

## CloudFront Association

The WebACL is configured with `scope: CLOUDFRONT` and must be deployed in the `us-east-1` region (AWS requirement for CloudFront WAF).

The WebACL ARN is exported and will be associated with the CloudFront distribution in the CDN Stack (Task 11).

## Monitoring and Metrics

All rules have CloudWatch metrics enabled:

- `typescript-demo-{env}-waf-webacl-metric` - Overall WebACL metrics
- `typescript-demo-{env}-waf-AWSManagedRulesCoreRuleSet-metric`
- `typescript-demo-{env}-waf-AWSManagedRulesKnownBadInputsRuleSet-metric`
- `typescript-demo-{env}-waf-AWSManagedRulesSQLiRuleSet-metric`
- `typescript-demo-{env}-waf-rate-limit-metric`
- `typescript-demo-{env}-waf-xss-protection-metric`

Sampled requests are enabled for all rules to allow inspection of blocked requests in the AWS WAF console.

## Stack Outputs

- **WebAclArn**: ARN of the WebACL for CloudFront association
- **WebAclId**: ID of the WebACL
- **WebAclName**: Name of the WebACL

## Requirements Satisfied

- **Requirement 3.1**: AWS WAF with SQL injection and XSS protection
- **Requirement 8.4**: Comprehensive security controls at the edge

## Deployment

The WAF stack is automatically deployed when running:

```bash
cdk deploy WafStack --context environment=dev
```

Note: The stack will be deployed to `us-east-1` regardless of the configured region, as this is required for CloudFront WAF.

## Testing

To validate the CloudFormation template:

```bash
AWS_ACCOUNT=123456789012 AWS_REGION=us-east-1 cdk synth WafStack --context environment=dev
```

## Future Enhancements

- Add custom rules for specific application patterns
- Implement IP reputation lists
- Add geo-blocking rules if needed
- Configure AWS WAF logging to S3 or CloudWatch Logs
