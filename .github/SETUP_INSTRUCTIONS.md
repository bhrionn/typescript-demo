# CI/CD Setup Instructions

Follow these steps to configure the CI/CD pipeline for this project.

## Prerequisites

- GitHub repository with admin access
- AWS accounts for dev, staging, and production
- GitHub CLI installed (optional, for automated setup)
- Slack workspace (optional, for notifications)

## Step 1: Configure GitHub Secrets

### Option A: Automated Setup (Recommended)

Use the provided script to configure all secrets:

```bash
# Make sure GitHub CLI is installed and authenticated
gh auth login

# Run the setup script
.github/scripts/setup-secrets.sh
```

### Option B: Manual Setup

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each of the following secrets:

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

## Step 2: Configure GitHub Environments

1. Go to Settings → Environments
2. Create three environments:

### Development Environment

- Name: `development`
- Protection rules: None required
- Secrets: Can override repository secrets if needed

### Staging Environment

- Name: `staging`
- Protection rules:
  - Optional: Required reviewers (1-2 team members)
  - Deployment branches: `main` only
- Secrets: Can override repository secrets if needed

### Production Environment

- Name: `production`
- Protection rules:
  - **Required reviewers**: Add 2+ team members
  - **Deployment branches**: Limit to `main` branch
  - **Wait timer**: Optional 5-minute delay
- Secrets: Can override repository secrets if needed

### Production Approval Environment

- Name: `production-approval`
- Protection rules:
  - **Required reviewers**: Add senior team members
  - This is the approval gate before production deployment

## Step 3: Configure Branch Protection Rules

### Main Branch

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (at least 1)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Status checks required:
     - `Lint and Type Check`
     - `Test Web Application`
     - `Test API`
     - `Test Infrastructure`
     - `Security Scanning`
     - `CDK Synth and Diff`
   - ✅ Require conversation resolution before merging
   - ✅ Require linear history
   - ✅ Include administrators

### Develop Branch

1. Add rule for `develop` branch:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - Status checks required:
     - `Lint and Type Check`
     - `Test Web Application`
     - `Test API`
     - `Test Infrastructure`

## Step 4: Enable GitHub Security Features

1. Go to Settings → Code security and analysis
2. Enable the following:
   - ✅ Dependency graph
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Dependabot version updates
   - ✅ Code scanning (CodeQL)
   - ✅ Secret scanning
   - ✅ Secret scanning push protection

## Step 5: Configure Dependabot

The `.github/dependabot.yml` file is already configured. Verify settings:

1. Go to Settings → Code security and analysis
2. Click "Configure" next to Dependabot version updates
3. Verify the configuration matches your needs
4. Update team names in `.github/dependabot.yml` if needed

## Step 6: Configure CODEOWNERS

1. Edit `.github/CODEOWNERS`
2. Replace placeholder team names with your actual GitHub teams:
   - `@YOUR_TEAM` → Your main team
   - `@frontend-team` → Frontend team
   - `@backend-team` → Backend team
   - `@devops-team` → DevOps team
   - `@infrastructure-team` → Infrastructure team
   - `@security-team` → Security team
   - `@documentation-team` → Documentation team

## Step 7: Configure Slack Notifications (Optional)

1. Create a Slack webhook:
   - Go to your Slack workspace
   - Navigate to Apps → Incoming Webhooks
   - Create a new webhook
   - Copy the webhook URL

2. Add to GitHub secrets:
   ```
   SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

## Step 8: Update README Badges

1. Edit `README.md`
2. Replace `YOUR_USERNAME/YOUR_REPO` with your actual repository:
   ```markdown
   [![CI Pipeline](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml)
   ```

## Step 9: Test the Pipeline

### Test CI Pipeline

1. Create a feature branch:

   ```bash
   git checkout -b test/ci-pipeline
   ```

2. Make a small change (e.g., update README)

3. Commit and push:

   ```bash
   git add .
   git commit -m "test: verify CI pipeline"
   git push origin test/ci-pipeline
   ```

4. Create a pull request to `develop`

5. Verify all CI checks pass

### Test Development Deployment

1. Merge the PR to `develop`

2. Go to Actions → Deploy to Development

3. Verify the workflow runs automatically

4. Check deployment status

### Test Staging Deployment

1. Create a PR from `develop` to `main`

2. After approval, merge to `main`

3. Go to Actions → Deploy to Staging

4. Verify the workflow runs automatically

5. Check E2E test results

### Test Production Deployment

1. Go to Actions → Deploy to Production

2. Click "Run workflow"

3. Enter a version (e.g., `v1.0.0`)

4. Approve the deployment when prompted

5. Verify deployment completes successfully

## Step 10: Configure AWS Resources

Before deployments can succeed, ensure AWS resources are ready:

1. **CDK Bootstrap** (one-time per account/region):

   ```bash
   cd infrastructure
   npx cdk bootstrap aws://ACCOUNT_ID/REGION
   ```

2. **Initial Infrastructure Deployment**:

   ```bash
   cd infrastructure
   npm run build
   npx cdk deploy --all
   ```

3. **Update GitHub Secrets** with deployed resource values:
   - API URLs
   - Cognito User Pool IDs
   - Cognito Client IDs
   - S3 Bucket Names

## Troubleshooting

### Secrets Not Found

**Problem**: Workflow fails with "secret not found"

**Solution**:

- Verify secret names match exactly (case-sensitive)
- Check secret is set at repository level, not environment level
- Ensure environment name matches workflow configuration

### Status Checks Not Required

**Problem**: Can merge PR without status checks

**Solution**:

- Go to branch protection rules
- Ensure status check names match workflow job names exactly
- Wait for status checks to appear (run workflow once first)

### Deployment Fails

**Problem**: Deployment workflow fails

**Solution**:

- Check CloudWatch logs for detailed errors
- Verify AWS credentials have correct permissions
- Ensure CDK bootstrap completed successfully
- Check CloudFormation console for stack status

### E2E Tests Fail

**Problem**: Playwright tests fail in staging

**Solution**:

- Check test configuration in `web-app/playwright.config.ts`
- Verify base URL is correct
- Check application logs for errors
- Run tests locally first

## Next Steps

After setup is complete:

1. ✅ Review [CI/CD Summary](.github/CI_CD_SUMMARY.md)
2. ✅ Read [Deployment Guide](.github/DEPLOYMENT_GUIDE.md)
3. ✅ Review [Workflow Documentation](.github/workflows/README.md)
4. ✅ Train team on deployment procedures
5. ✅ Schedule regular security scan reviews
6. ✅ Set up monitoring dashboards
7. ✅ Document team-specific procedures

## Support

For issues or questions:

- Check workflow logs in GitHub Actions
- Review documentation in `.github/` directory
- Contact DevOps team
- Create an issue using the bug report template

## Maintenance

### Weekly

- Review Dependabot PRs
- Check security scan results
- Monitor deployment success rates

### Monthly

- Rotate AWS credentials
- Review and update documentation
- Audit GitHub secrets

### Quarterly

- Update GitHub Actions versions
- Review and optimize pipeline performance
- Conduct disaster recovery drill
