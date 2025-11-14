# API Gateway Stack

## Overview

The ApiStack creates an AWS API Gateway REST API that serves as the entry point for all backend API requests. It integrates with Lambda functions from the ComputeStack to handle authentication, file uploads, and file management operations.

## Features

- **REST API**: Regional API Gateway endpoint
- **Request Validation**: Validates query parameters, headers, and request bodies
- **Lambda Proxy Integration**: All endpoints use Lambda proxy integration for flexibility
- **CORS Configuration**: Configurable allowed origins for cross-origin requests
- **Usage Plan & Throttling**: Rate limiting and burst capacity controls
- **CloudWatch Logging**: Full request/response logging with structured JSON format
- **X-Ray Tracing**: Distributed tracing for performance monitoring

## API Endpoints

### Authentication

- **POST /auth/validate**
  - Validates JWT authentication tokens
  - Returns token validation result
  - Response codes: 200, 400, 401

### File Management

- **POST /files/upload**
  - Uploads a file to S3 with metadata
  - Requires authentication
  - Response codes: 200, 400, 401, 413

- **GET /files**
  - Lists all files for the authenticated user
  - Requires authentication
  - Response codes: 200, 401

- **GET /files/{id}**
  - Retrieves metadata for a specific file
  - Requires authentication
  - Response codes: 200, 401, 404

- **GET /files/{id}/download-url**
  - Generates a presigned S3 URL for file download
  - Requires authentication
  - Response codes: 200, 401, 404

## Configuration

### CORS

CORS is configured at the API level with the following defaults:

- **Allowed Headers**: Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token
- **Allow Credentials**: true
- **Max Age**: 1 hour

Allowed origins are environment-specific:

- **Development**: `http://localhost:3000`, `http://localhost:8080`
- **Production**: Configured via `allowedOrigins` context parameter

### Throttling

Usage plans enforce rate limits:

| Environment | Rate Limit | Burst Limit | Monthly Quota |
| ----------- | ---------- | ----------- | ------------- |
| Development | 100 req/s  | 200 req     | None          |
| Staging     | 100 req/s  | 200 req     | None          |
| Production  | 1000 req/s | 2000 req    | 1M requests   |

### Logging

API Gateway logs are sent to CloudWatch with the following configuration:

- **Log Level**: INFO
- **Data Trace**: Enabled in non-production (disabled in production for security)
- **Metrics**: Enabled
- **X-Ray Tracing**: Enabled
- **Access Logs**: JSON format with standard fields

Log retention:

- Development: 7 days
- Staging: 30 days
- Production: 90 days

## Request Validation

Two validators are configured:

1. **Request Validator**: Validates query strings and headers
2. **Body Validator**: Validates request body and parameters

Validation models ensure:

- Required parameters are present
- Data types are correct
- Request format matches expected schema

## Integration with Lambda

All endpoints use Lambda proxy integration:

- **Proxy Mode**: Lambda receives full request context
- **Response Format**: Lambda controls HTTP response format
- **Timeout**: 29 seconds (API Gateway maximum)
- **Test Invocation**: Enabled in non-production environments

## Security

### Authentication

All file management endpoints require authentication:

- JWT token must be included in Authorization header
- Token validation is performed by Lambda functions
- Invalid tokens return 401 Unauthorized

### CORS

CORS is enforced to prevent unauthorized cross-origin requests:

- Only configured origins can make requests
- Credentials are required for authenticated endpoints
- Preflight requests are handled automatically

### Rate Limiting

Usage plans prevent abuse:

- Per-second rate limits
- Burst capacity for traffic spikes
- Monthly quotas in production

## Deployment

### Prerequisites

- ComputeStack must be deployed first (provides Lambda functions)
- Environment variables must be configured

### Deploy Command

```bash
# Development
cdk deploy ApiStack --context environment=dev

# Staging
cdk deploy ApiStack --context environment=staging

# Production with custom origins
cdk deploy ApiStack --context environment=prod --context allowedOrigins='["https://example.com"]'
```

### Stack Outputs

The stack exports the following values:

- **ApiId**: REST API ID
- **ApiUrl**: Full API URL (e.g., https://abc123.execute-api.us-east-1.amazonaws.com/dev/)
- **ApiArn**: API ARN for IAM policies
- **ApiStageName**: Deployment stage name

## Monitoring

### CloudWatch Metrics

Monitor these key metrics:

- **4XXError**: Client errors (should be low)
- **5XXError**: Server errors (should be near zero)
- **Count**: Total request count
- **Latency**: Request latency (p50, p99)
- **IntegrationLatency**: Lambda execution time

### CloudWatch Logs

Access logs include:

- Request ID
- Caller IP
- HTTP method and path
- Response status
- Response length
- Request time

### X-Ray Tracing

X-Ray provides:

- End-to-end request tracing
- Service map visualization
- Performance bottleneck identification
- Error analysis

## Testing

### Local Testing

Use the AWS CLI to test endpoints:

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-ApiStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Test auth validation
curl -X POST "${API_URL}auth/validate" \
  -H "Content-Type: application/json" \
  -d '{"token": "your-jwt-token"}'

# Test file list
curl -X GET "${API_URL}files" \
  -H "Authorization: Bearer your-jwt-token"
```

### Integration Testing

Test Lambda integrations:

```bash
# Enable test invocation (non-production only)
aws apigateway test-invoke-method \
  --rest-api-id <api-id> \
  --resource-id <resource-id> \
  --http-method GET \
  --path-with-query-string "/files"
```

## Troubleshooting

### Common Issues

**Issue**: CORS errors in browser

- **Solution**: Verify allowed origins are configured correctly
- Check that credentials are included in requests

**Issue**: 403 Forbidden errors

- **Solution**: Check Lambda execution role permissions
- Verify API Gateway has permission to invoke Lambda

**Issue**: High latency

- **Solution**: Check Lambda cold start times
- Review X-Ray traces for bottlenecks
- Consider provisioned concurrency for Lambda

**Issue**: Rate limit errors (429)

- **Solution**: Increase usage plan limits
- Implement client-side retry with exponential backoff

## Requirements Mapping

This stack satisfies the following requirements:

- **2.2**: API Gateway receives upload requests with authentication tokens
- **3.7**: CORS configured with allowed origins, encryption in transit via HTTPS
- **8.17**: CloudWatch logging enabled for API Gateway

## Next Steps

After deploying the ApiStack:

1. Deploy CdnStack to add CloudFront distribution
2. Configure custom domain name (optional)
3. Set up API keys for third-party integrations (if needed)
4. Configure WAF rules for API Gateway (if needed)
5. Implement API documentation with OpenAPI/Swagger
