# CI/CD Pipeline Documentation

This directory contains GitHub Actions workflows for continuous integration and deployment of the TypeScript federated authentication application.

## Workflows Overview

### 1. CI Pipeline (`ci.yml`)

**Trigger**: Pull requests and pushes to `main` and `develop` branches

**Jobs**:

- **Lint and Type Check**: Runs ESLint and TypeScript type checking for all projects (web-app, api, infrastructure)
- **Test Web App**: Executes unit tests with coverage reporting
- **Test API**: Runs API tests with PostgreSQL service container
- **Test Infrastructure**: Executes CDK infrastructure tests
- **Security Scan**: Performs npm audit and Trivy vulnerability scanning
- **CDK Synth and Diff**: Synthesizes CloudFormation templates
- **Build Artifacts**: Builds all projects and uploads artifacts

### 2. Deploy to Development (`deploy-dev.yml`)

**Trigger**: Pushes to `develop` branch or manual dispatch

**Environment**: Development

**Steps**:

1. Deploy infrastructure using CDK
2. Build and deploy web application to S3
3. Invalidate CloudFront cache
4. Update Lambda functions
5. Run smoke tests
6. Send Slack notification

**Required Secrets**:

- `AWS_ACCESS_KEY_ID_DEV`
- `AWS_SECRET_ACCESS_KEY_DEV`
- `AWS_ACCOUNT_ID_DEV`
- `API_URL_DEV`
- `COGNITO_USER_POOL_ID_DEV`
- `COGNITO_CLIENT_ID_DEV`
- `COGNITO_DOMAIN_DEV`
- `WEB_BUCKET_NAME_DEV`
- `SLACK_WEBHOOK` (optional)

### 3. Deploy to Staging (`deploy-staging.yml`)

**Trigger**: Pushes to `main` branch or manual dispatch

**Environment**: Staging

**Steps**:

1. Deploy infrastructure using CDK with diff preview
2. Build and deploy web application to S3
3. Invalidate CloudFront cache
4. Update Lambda functions
5. Run smoke tests
6. Run E2E tests with Playwright
7. Send Slack notification

**Required Secrets**:

- `AWS_ACCESS_KEY_ID_STAGING`
- `AWS_SECRET_ACCESS_KEY_STAGING`
- `AWS_ACCOUNT_ID_STAGING`
- `API_URL_STAGING`
- `COGNITO_USER_POOL_ID_STAGING`
- `COGNITO_CLIENT_ID_STAGING`
- `COGNITO_DOMAIN_STAGING`
- `WEB_BUCKET_NAME_STAGING`
- `SLACK_WEBHOOK` (optional)

### 4. Deploy to Production (`deploy-prod.yml`)

**Trigger**: Manual dispatch only (requires version input)

**Environment**: Production (requires manual approval)

**Steps**:

1. Manual approval checkpoint
2. Create backup of current deployment
3. Deploy infrastructure using CDK with diff preview
4. Build and deploy web application to S3
5. Invalidate CloudFront cache
6. Update Lambda functions with versioning and aliases
7. Run smoke tests and health checks
8. Create deployment tag
9. Automatic rollback on failure
10. Send Slack notification

**Required Secrets**:

- `AWS_ACCESS_KEY_ID_PROD`
- `AWS_SECRET_ACCESS_KEY_PROD`
- `AWS_ACCOUNT_ID_PROD`
- `API_URL_PROD`
- `COGNITO_USER_POOL_ID_PROD`
- `COGNITO_CLIENT_ID_PROD`
- `COGNITO_DOMAIN_PROD`
- `WEB_BUCKET_NAME_PROD`
- `SLACK_WEBHOOK` (optional)

### 5. Security Scanning (`security-scan.yml`)

**Trigger**: Daily at 2 AM UTC, pushes to `main`/`develop`, or manual dispatch

**Jobs**:

- **Dependency Scan**: npm audit for all projects with severity thresholds
- **Trivy Scan**: Container and filesystem vulnerability scanning
- **CodeQL Analysis**: Static code analysis for security issues
- **Secret Scan**: TruffleHog for exposed secrets
- **Infrastructure Security**: cfn-nag and Checkov for CloudFormation templates
- **Notify Results**: Slack notification of scan results

## Setup Instructions

### 1. Configure GitHub Secrets

Navigate to your repository settings → Secrets and variables → Actions, and add the following secrets:

#### Development Environment

```
AWS_ACCESS_KEY_ID_DEV
AWS_SECRET_ACCESS_KEY_DEV
AWS_ACCOUNT_ID_DEV
API_URL_DEV
COGNITO_USER_POOL_ID_DEV
COGNITO_CLIENT_ID_DEV
COGNITO_DOMAIN_DEV
WEB_BUCKET_NAME_DEV
```

#### Staging Environment

```
AWS_ACCESS_KEY_ID_STAGING
AWS_SECRET_ACCESS_KEY_STAGING
AWS_ACCOUNT_ID_STAGING
API_URL_STAGING
COGNITO_USER_POOL_ID_STAGING
COGNITO_CLIENT_ID_STAGING
COGNITO_DOMAIN_STAGING
WEB_BUCKET_NAME_STAGING
```

#### Production Environment

```
AWS_ACCESS_KEY_ID_PROD
AWS_SECRET_ACCESS_KEY_PROD
AWS_ACCOUNT_ID_PROD
API_URL_PROD
COGNITO_USER_POOL_ID_PROD
COGNITO_CLIENT_ID_PROD
COGNITO_DOMAIN_PROD
WEB_BUCKET_NAME_PROD
```

#### Optional

```
SLACK_WEBHOOK  # For deployment notifications
```

### 2. Configure GitHub Environments

Create the following environments in your repository settings:

1. **development**
   - No protection rules required
   - Add environment-specific secrets if needed

2. **staging**
   - Optional: Add required reviewers
   - Add environment-specific secrets if needed

3. **production**
   - Required reviewers: Add team members who must approve
   - Deployment branches: Limit to `main` branch only
   - Add environment-specific secrets if needed

4. **production-approval**
   - Required reviewers: Add team members for production approval gate

### 3. Enable GitHub Security Features

1. Navigate to Settings → Code security and analysis
2. Enable:
   - Dependency graph
   - Dependabot alerts
   - Dependabot security updates
   - Code scanning (CodeQL)
   - Secret scanning

### 4. Configure Branch Protection Rules

#### Main Branch

- Require pull request reviews (at least 1 approval)
- Require status checks to pass:
  - Lint and Type Check
  - Test Web Application
  - Test API
  - Test Infrastructure
  - Security Scanning
  - CDK Synth and Diff
- Require branches to be up to date
- Require conversation resolution before merging

#### Develop Branch

- Require status checks to pass:
  - Lint and Type Check
  - Test Web Application
  - Test API
  - Test Infrastructure

## Deployment Workflow

### Development Deployment

1. Create feature branch from `develop`
2. Make changes and commit
3. Push to feature branch
4. CI pipeline runs automatically
5. Create pull request to `develop`
6. After approval and merge, automatic deployment to dev environment

### Staging Deployment

1. Create pull request from `develop` to `main`
2. CI pipeline runs automatically
3. After approval and merge, automatic deployment to staging environment
4. E2E tests run automatically
5. Verify staging deployment

### Production Deployment

1. Navigate to Actions → Deploy to Production
2. Click "Run workflow"
3. Enter version/tag to deploy
4. Manual approval required
5. Deployment executes with automatic rollback on failure
6. Verify production deployment

## Rollback Procedures

### Automatic Rollback (Production)

- Production deployment includes automatic rollback on failure
- Lambda functions revert to previous version
- Notification sent to Slack

### Manual Rollback

1. Navigate to Actions → Deploy to Production
2. Run workflow with previous stable version
3. Manual approval required
4. Deployment executes

### Emergency Rollback

```bash
# Rollback Lambda functions
aws lambda update-alias \
  --function-name <function-name> \
  --name live \
  --function-version <previous-version>

# Rollback web app from backup
aws s3 sync s3://<backup-bucket>/ s3://<web-bucket>/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

## Monitoring and Notifications

### Slack Notifications

Configure `SLACK_WEBHOOK` secret to receive notifications for:

- Deployment status (success/failure)
- Security scan results
- Rollback events

### GitHub Actions Notifications

- Email notifications for workflow failures
- Status badges in README
- Deployment status in pull requests

## Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Required

**Error**: "Stack is not bootstrapped"
**Solution**: Run CDK bootstrap manually or ensure bootstrap step completes

#### 2. Lambda Update Fails

**Error**: "ResourceConflictException"
**Solution**: Wait for previous update to complete, then retry

#### 3. CloudFront Invalidation Timeout

**Error**: Invalidation takes too long
**Solution**: This is normal; invalidation continues in background

#### 4. Security Scan Failures

**Error**: Critical vulnerabilities found
**Solution**: Update dependencies and re-run pipeline

### Debug Mode

Enable debug logging by adding repository secret:

```
ACTIONS_STEP_DEBUG = true
ACTIONS_RUNNER_DEBUG = true
```

## Best Practices

1. **Always test in dev/staging before production**
2. **Use semantic versioning for production deployments**
3. **Review CDK diff output before approving deployments**
4. **Monitor CloudWatch logs after deployments**
5. **Keep dependencies up to date**
6. **Rotate AWS credentials regularly**
7. **Review security scan results promptly**
8. **Document any manual interventions**

## Maintenance

### Weekly Tasks

- Review security scan results
- Update dependencies with vulnerabilities
- Check deployment success rates

### Monthly Tasks

- Review and update workflow configurations
- Audit AWS credentials and rotate if needed
- Review CloudWatch logs for errors
- Update documentation

### Quarterly Tasks

- Review and optimize CI/CD pipeline performance
- Update GitHub Actions versions
- Review and update branch protection rules
- Conduct disaster recovery drill

## Support

For issues or questions:

1. Check workflow logs in GitHub Actions
2. Review CloudWatch logs in AWS
3. Consult team documentation
4. Contact DevOps team

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Deployment Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [CloudFront Invalidation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
