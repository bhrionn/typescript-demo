# Deployment Guide

Quick reference for deploying the TypeScript Federated Auth Application.

## Prerequisites

- AWS account with appropriate permissions
- GitHub repository with configured secrets
- Node.js 20+ installed locally
- AWS CLI configured

## Quick Start

### 1. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd typescript-demo

# Install dependencies
npm install
cd web-app && npm install && cd ..
cd api && npm install && cd ..
cd infrastructure && npm install && cd ..
```

### 2. Configure GitHub Secrets

Add the following secrets in GitHub repository settings:

**Development:**

- `AWS_ACCESS_KEY_ID_DEV`
- `AWS_SECRET_ACCESS_KEY_DEV`
- `AWS_ACCOUNT_ID_DEV`
- Environment-specific configuration secrets

**Staging:**

- `AWS_ACCESS_KEY_ID_STAGING`
- `AWS_SECRET_ACCESS_KEY_STAGING`
- `AWS_ACCOUNT_ID_STAGING`
- Environment-specific configuration secrets

**Production:**

- `AWS_ACCESS_KEY_ID_PROD`
- `AWS_SECRET_ACCESS_KEY_PROD`
- `AWS_ACCOUNT_ID_PROD`
- Environment-specific configuration secrets

### 3. Deploy to Development

```bash
# Push to develop branch
git checkout develop
git push origin develop

# Or manually trigger
# Go to Actions → Deploy to Development → Run workflow
```

### 4. Deploy to Staging

```bash
# Merge develop to main
git checkout main
git merge develop
git push origin main

# Deployment triggers automatically
```

### 5. Deploy to Production

```bash
# Manual deployment only
# Go to Actions → Deploy to Production
# Click "Run workflow"
# Enter version/tag
# Approve deployment
```

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing in CI
- [ ] Security scans completed
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Database migrations prepared
- [ ] Rollback plan documented

### During Deployment

- [ ] Monitor GitHub Actions workflow
- [ ] Check CloudWatch logs
- [ ] Verify CloudFormation stack status
- [ ] Monitor Lambda function metrics

### Post-Deployment

- [ ] Run smoke tests
- [ ] Verify application functionality
- [ ] Check error rates in CloudWatch
- [ ] Validate security controls
- [ ] Update deployment documentation

## Environment URLs

- **Development**: https://dev.example.com
- **Staging**: https://staging.example.com
- **Production**: https://example.com

## Rollback Procedures

### Automatic Rollback (Production Only)

Production deployments include automatic rollback on failure.

### Manual Rollback

1. Go to Actions → Deploy to Production
2. Run workflow with previous stable version
3. Approve deployment

### Emergency Rollback

```bash
# Set AWS credentials
export AWS_PROFILE=production

# Rollback Lambda functions
for function in $(aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'typescript-demo-prod')].FunctionName" --output text); do
  PREVIOUS_VERSION=$(aws lambda list-versions-by-function --function-name $function --query 'Versions[-2].Version' --output text)
  aws lambda update-alias --function-name $function --name live --function-version $PREVIOUS_VERSION
done

# Rollback web app from backup
BACKUP_BUCKET=$(aws s3 ls | grep backup | tail -1 | awk '{print $3}')
aws s3 sync s3://$BACKUP_BUCKET/ s3://typescript-demo-prod-web-bucket/ --delete

# Invalidate CloudFront
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name typescript-demo-prod-cdn-stack --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

## Monitoring

### CloudWatch Dashboards

- Lambda function metrics
- API Gateway metrics
- RDS database metrics
- CloudFront metrics

### Alarms

- Lambda error rate > 5%
- API Gateway 5xx rate > 1%
- RDS CPU > 80%
- RDS storage < 20% free

### Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/typescript-demo-prod-function-name --follow

# View API Gateway logs
aws logs tail /aws/apigateway/typescript-demo-prod --follow

# View VPC Flow Logs
aws logs tail /aws/vpc/flowlogs --follow
```

## Troubleshooting

### Common Issues

#### Deployment Fails at CDK Deploy

**Symptoms**: CloudFormation stack update fails

**Solutions**:

1. Check CloudFormation console for detailed error
2. Verify IAM permissions
3. Check resource limits (VPC, EIP, etc.)
4. Review CDK diff output

#### Lambda Function Update Fails

**Symptoms**: ResourceConflictException

**Solutions**:

1. Wait for previous update to complete
2. Check Lambda function status in console
3. Verify function code package size < 50MB

#### CloudFront Invalidation Timeout

**Symptoms**: Invalidation takes longer than expected

**Solutions**:

1. This is normal behavior
2. Invalidation continues in background
3. Check invalidation status in CloudFront console

#### Database Connection Errors

**Symptoms**: Lambda functions cannot connect to RDS

**Solutions**:

1. Verify security group rules
2. Check RDS instance status
3. Verify Secrets Manager credentials
4. Check VPC configuration

### Debug Commands

```bash
# Check CDK diff
cd infrastructure
npx cdk diff --all

# Validate CloudFormation templates
aws cloudformation validate-template --template-body file://template.yaml

# Check Lambda function configuration
aws lambda get-function-configuration --function-name <function-name>

# Test Lambda function
aws lambda invoke --function-name <function-name> --payload '{}' response.json

# Check RDS connectivity
aws rds describe-db-instances --db-instance-identifier <instance-id>
```

## Security

### Security Checklist

Before each production deployment:

- [ ] All dependencies up to date
- [ ] No critical/high vulnerabilities
- [ ] Security scans passed
- [ ] IAM roles follow least privilege
- [ ] Encryption enabled (S3, RDS)
- [ ] WAF rules active
- [ ] CloudTrail enabled
- [ ] VPC Flow Logs enabled

### Security Scanning

```bash
# Run security scans locally
cd web-app && npm audit
cd api && npm audit
cd infrastructure && npm audit

# Run infrastructure security validation
cd infrastructure
npm run validate:security
```

## Performance Optimization

### Lambda Functions

- Monitor cold start times
- Optimize memory allocation
- Use Lambda layers for shared dependencies
- Enable X-Ray tracing

### CloudFront

- Configure appropriate cache behaviors
- Use origin shield for high-traffic origins
- Monitor cache hit ratio

### RDS

- Monitor connection pool usage
- Optimize query performance
- Consider read replicas for scaling

## Maintenance

### Weekly

- Review CloudWatch alarms
- Check error logs
- Update dependencies with vulnerabilities

### Monthly

- Review and optimize costs
- Update documentation
- Rotate AWS credentials
- Review security scan results

### Quarterly

- Disaster recovery drill
- Performance optimization review
- Security audit
- Update runbooks

## Support Contacts

- **DevOps Team**: devops@example.com
- **Security Team**: security@example.com
- **On-Call**: oncall@example.com

## Additional Resources

- [CI/CD Pipeline Documentation](.github/workflows/README.md)
- [Infrastructure Documentation](infrastructure/README.md)
- [API Documentation](api/README.md)
- [Web App Documentation](web-app/README.md)
- [Security Checklist](infrastructure/scripts/README.md)
