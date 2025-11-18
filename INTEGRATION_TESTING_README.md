# Integration Testing Documentation

This directory contains comprehensive documentation and tools for end-to-end integration testing of the federated authentication TypeScript application.

## Quick Start

### Automated Testing

Run the automated integration test script:

```bash
./run-integration-tests.sh dev
```

This will verify:

- Infrastructure deployment
- Security configuration
- Network setup
- All AWS services

### Manual Testing

Follow the manual testing checklist:

```bash
cat MANUAL_TESTING_CHECKLIST.md
```

## Documentation Files

### 1. INTEGRATION_TESTING_GUIDE.md

Comprehensive guide covering:

- All testing phases
- Detailed test procedures
- AWS CLI commands
- Verification steps
- Troubleshooting

**Use this for**: Complete end-to-end testing

### 2. run-integration-tests.sh

Automated testing script that:

- Verifies infrastructure deployment
- Checks security configuration
- Tests AWS services
- Generates test report

**Use this for**: Quick automated verification

### 3. INTEGRATION_TEST_REPORT_TEMPLATE.md

Template for documenting test results:

- Test execution details
- Pass/fail status
- Issues and observations
- Requirements coverage

**Use this for**: Formal test reporting

### 4. MANUAL_TESTING_CHECKLIST.md

Quick reference checklist for:

- Authentication testing
- File upload testing
- Error handling
- Browser compatibility

**Use this for**: Manual UI testing

## Testing Workflow

1. **Deploy Infrastructure**

   ```bash
   cd infrastructure
   cdk deploy --all
   ```

2. **Run Automated Tests**

   ```bash
   ./run-integration-tests.sh dev
   ```

3. **Perform Manual Tests**
   - Follow MANUAL_TESTING_CHECKLIST.md
   - Test authentication flows
   - Test file upload/download
   - Test error scenarios

4. **Document Results**
   - Use INTEGRATION_TEST_REPORT_TEMPLATE.md
   - Record all findings
   - Attach screenshots and logs

5. **Review and Approve**
   - Review test report
   - Address any issues
   - Approve for production

## Requirements Coverage

These tests verify requirements:

- 1.1, 1.2, 1.3: Federated authentication
- 2.1, 2.2, 2.3, 2.4, 2.5: File upload and API
- 3.1-3.7: Security controls

## Support

For issues or questions:

- Review INTEGRATION_TESTING_GUIDE.md troubleshooting section
- Check CloudWatch logs
- Review test report for specific failures

## CI/CD Integration

The automated test script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: ./run-integration-tests.sh ${{ env.ENVIRONMENT }}
```
