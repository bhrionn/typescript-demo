# Integration Testing Quick Start

Get started with integration testing in 5 minutes.

## Prerequisites

```bash
# Verify tools are installed
aws --version
jq --version
curl --version
```

## Step 1: Deploy Infrastructure

```bash
cd infrastructure
npm install
npm run build
cdk deploy --all
cd ..
```

## Step 2: Run Automated Tests

```bash
# Make script executable (first time only)
chmod +x run-integration-tests.sh

# Run tests
./run-integration-tests.sh dev
```

**Expected Output**: Test summary with pass/fail counts

## Step 3: Manual Testing

Open the application URL (from CloudFront):

1. **Test Google Login**
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify dashboard loads

2. **Test File Upload**
   - Select a file
   - Click upload
   - Verify success message

3. **Test File Download**
   - Click download on uploaded file
   - Verify file downloads

## Step 4: Review Results

Check the generated test results file:

```bash
cat integration-test-results-*.txt
```

## Common Issues

### AWS Credentials Not Configured

```bash
aws configure
```

### Stack Not Deployed

```bash
cd infrastructure
cdk deploy --all
```

### Tests Failing

Check specific component:

```bash
# Check CloudFormation stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Check specific service
aws cognito-idp list-user-pools --max-results 10
```

## Next Steps

- Review [INTEGRATION_TESTING_GUIDE.md](INTEGRATION_TESTING_GUIDE.md) for detailed procedures
- Use [INTEGRATION_TEST_REPORT_TEMPLATE.md](INTEGRATION_TEST_REPORT_TEMPLATE.md) to document results
- Follow [MANUAL_TESTING_CHECKLIST.md](MANUAL_TESTING_CHECKLIST.md) for complete manual testing

## Need Help?

See [INTEGRATION_TESTING_README.md](INTEGRATION_TESTING_README.md) for complete documentation.
