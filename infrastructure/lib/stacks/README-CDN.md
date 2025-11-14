# CdnStack - CloudFront Distribution

## Overview

The CdnStack creates an AWS CloudFront distribution for global content delivery with comprehensive security and caching configurations. It serves both static web application assets from S3 and dynamic API requests from API Gateway.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront Distribution                   │
│                  (Global Edge Locations)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Default Behavior (/)                              │    │
│  │  - Origin: S3 Web App Bucket                       │    │
│  │  - Cache: Max TTL (365 days)                       │    │
│  │  - HTTPS Only (Redirect HTTP)                      │    │
│  │  - Compression: Enabled                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  API Behavior (/api/*)                             │    │
│  │  - Origin: API Gateway                             │    │
│  │  - Cache: No caching (TTL = 0)                     │    │
│  │  - HTTPS Only (Strict)                             │    │
│  │  - Compression: Disabled                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Security:                                                   │
│  - TLS 1.2+ minimum                                         │
│  - WAF WebACL attached                                      │
│  - Security headers (HSTS, X-Frame-Options, etc.)          │
│  - Origin Access Identity for S3                            │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Origins

1. **S3 Origin (Primary)**
   - Serves static web application assets (HTML, CSS, JS, images)
   - Uses Origin Access Identity (OAI) for secure access
   - No direct public access to S3 bucket

2. **API Gateway Origin**
   - Serves dynamic API requests
   - Path pattern: `/api/*`
   - HTTPS only with TLS 1.2+
   - Custom origin verification header

### Cache Behaviors

1. **Static Assets (Default Behavior)**
   - **Path Pattern**: `/*` (all paths except `/api/*`)
   - **Cache Policy**:
     - Default TTL: 7 days
     - Max TTL: 365 days
     - Min TTL: 0 seconds
   - **Compression**: Gzip and Brotli enabled
   - **Allowed Methods**: GET, HEAD, OPTIONS
   - **Cached Methods**: GET, HEAD, OPTIONS

2. **API Requests**
   - **Path Pattern**: `/api/*`
   - **Cache Policy**:
     - Default TTL: 0 seconds (no caching)
     - Max TTL: 0 seconds
     - Min TTL: 0 seconds
   - **Compression**: Disabled (preserve API responses)
   - **Allowed Methods**: All (GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE)
   - **Cached Methods**: GET, HEAD, OPTIONS only
   - **Headers Forwarded**: Authorization, Content-Type, Accept, Origin, Referer, User-Agent
   - **Query Strings**: All forwarded
   - **Cookies**: All forwarded

### Security Features

1. **TLS Configuration**
   - Minimum protocol version: TLS 1.2 (2021 policy)
   - HTTPS enforcement for all requests
   - HTTP requests redirected to HTTPS

2. **WAF Integration**
   - AWS WAF WebACL attached to distribution
   - Protection against SQL injection, XSS, and other attacks
   - Rate limiting (2000 requests per 5 minutes per IP)

3. **Security Headers**
   - `Strict-Transport-Security`: max-age=31536000; includeSubDomains; preload
   - `X-Frame-Options`: DENY
   - `X-Content-Type-Options`: nosniff
   - `X-XSS-Protection`: 1; mode=block
   - `Referrer-Policy`: strict-origin-when-cross-origin
   - `Permissions-Policy`: geolocation=(), microphone=(), camera=()

4. **Origin Access Identity**
   - CloudFront uses OAI to access S3 bucket
   - S3 bucket policy grants read access only to OAI
   - Prevents direct public access to S3

### Error Handling

- **403 Forbidden**: Redirects to `/index.html` (for SPA routing)
- **404 Not Found**: Redirects to `/index.html` (for SPA routing)
- TTL: 5 minutes for error responses

### Logging

- **Access Logs**: Enabled
- **Log Bucket**: Separate S3 bucket for CloudFront logs
- **Log Prefix**: `cloudfront-logs/`
- **Log Retention**: Based on environment configuration
- **Cookies in Logs**: Disabled

## Configuration

### Environment-Specific Settings

| Setting       | Development                 | Staging            | Production               |
| ------------- | --------------------------- | ------------------ | ------------------------ |
| Price Class   | 100 (North America, Europe) | 200 (Most regions) | ALL (All edge locations) |
| Log Retention | 7 days                      | 30 days            | 90 days                  |
| HTTP Version  | HTTP/2 and HTTP/3           | HTTP/2 and HTTP/3  | HTTP/2 and HTTP/3        |
| IPv6          | Enabled                     | Enabled            | Enabled                  |

### Dependencies

The CdnStack requires the following resources from other stacks:

1. **StorageStack**:
   - `webAppBucket`: S3 bucket for web application assets

2. **ApiStack**:
   - `api`: REST API Gateway instance

3. **WafStack** (deployed in us-east-1):
   - `webAclArn`: WAF WebACL ARN for CloudFront association

## Deployment

### Prerequisites

1. Deploy WafStack in us-east-1 region first:

   ```bash
   cd infrastructure
   cdk deploy WafStack --context environment=dev
   ```

2. Deploy other dependent stacks:

   ```bash
   cdk deploy NetworkStack SecurityStack StorageStack ComputeStack ApiStack
   ```

3. Deploy CdnStack:
   ```bash
   cdk deploy CdnStack --context environment=dev
   ```

### Post-Deployment

After deployment, the CloudFront distribution URL will be available in the stack outputs:

```bash
# Get distribution URL
aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-CdnStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionUrl`].OutputValue' \
  --output text
```

### Invalidating Cache

To invalidate the CloudFront cache after deploying new web application assets:

```bash
# Get distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name typescript-demo-dev-CdnStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## Outputs

The stack exports the following outputs:

| Output                   | Description                    | Export Name                          |
| ------------------------ | ------------------------------ | ------------------------------------ |
| `DistributionId`         | CloudFront distribution ID     | `{StackName}-DistributionId`         |
| `DistributionDomainName` | CloudFront domain name         | `{StackName}-DistributionDomainName` |
| `DistributionUrl`        | Full HTTPS URL to distribution | N/A                                  |
| `ApiUrl`                 | API URL via CloudFront         | N/A                                  |

## Usage

### Web Application

Update your web application configuration to use the CloudFront distribution URL:

```typescript
// web-app/src/config/api.ts
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'https://d1234567890abc.cloudfront.net/api';
```

### Uploading Web Assets

Upload your built web application to the S3 bucket:

```bash
# Build web application
cd web-app
npm run build

# Upload to S3
aws s3 sync build/ s3://typescript-demo-dev-s3-web-app/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## Security Considerations

1. **S3 Bucket Access**:
   - S3 bucket is private (no public access)
   - Only CloudFront can access via OAI
   - Bucket policy enforces SSL/TLS

2. **API Security**:
   - API requests go through CloudFront
   - WAF rules applied to all requests
   - Origin verification header can be validated in API Gateway

3. **TLS/SSL**:
   - Minimum TLS 1.2 enforced
   - Modern cipher suites only
   - HSTS header with preload

4. **Content Security**:
   - Security headers prevent XSS, clickjacking
   - Content-Type sniffing disabled
   - Permissions policy restricts browser features

## Monitoring

### CloudWatch Metrics

CloudFront automatically publishes metrics to CloudWatch:

- `Requests`: Total number of requests
- `BytesDownloaded`: Total bytes downloaded
- `BytesUploaded`: Total bytes uploaded
- `4xxErrorRate`: Percentage of 4xx errors
- `5xxErrorRate`: Percentage of 5xx errors
- `TotalErrorRate`: Percentage of all errors

### Access Logs

Access logs are stored in the CloudFront log bucket:

```
s3://typescript-demo-dev-s3-cloudfront-logs/cloudfront-logs/
```

Log format includes:

- Date and time
- Edge location
- Bytes sent
- Client IP
- HTTP method
- Host
- URI
- Status code
- Referer
- User-Agent

## Troubleshooting

### Issue: 403 Forbidden Errors

**Cause**: S3 bucket policy or OAI configuration issue

**Solution**:

1. Verify OAI has read access to S3 bucket
2. Check S3 bucket policy includes OAI principal
3. Ensure objects in S3 have correct permissions

### Issue: API Requests Not Working

**Cause**: Cache policy or origin configuration issue

**Solution**:

1. Verify API Gateway origin is configured correctly
2. Check cache policy has TTL = 0 for API requests
3. Ensure all required headers are forwarded
4. Verify API Gateway stage name matches origin path

### Issue: Slow Initial Load

**Cause**: Cold start or cache miss

**Solution**:

1. Implement cache warming strategy
2. Use CloudFront Functions for edge logic
3. Optimize asset sizes and compression
4. Consider using Lambda@Edge for dynamic content

### Issue: WAF Blocking Legitimate Requests

**Cause**: WAF rules too restrictive

**Solution**:

1. Review WAF logs in CloudWatch
2. Identify blocked request patterns
3. Adjust WAF rules or add exceptions
4. Test with WAF in count mode first

## Cost Optimization

1. **Price Class**: Use PRICE_CLASS_100 for dev/staging (North America and Europe only)
2. **Compression**: Enable compression for static assets to reduce data transfer
3. **Cache TTL**: Maximize cache TTL for static assets to reduce origin requests
4. **Log Retention**: Set appropriate log retention periods
5. **Invalidations**: Minimize cache invalidations (charged per path)

## Requirements Mapping

This stack implements the following requirements:

- **3.7**: Encryption in transit using TLS 1.2 or higher
- **6.1**: CloudFront distribution for web application
- **6.2**: Static assets cached at edge locations
- **6.3**: Dynamic requests routed to API Gateway
- **6.4**: HTTPS enforcement for all connections
- **6.5**: Content served from nearest edge location
- **8.5**: WAF WebACL associated with CloudFront

## Related Documentation

- [WafStack README](./README-WAF.md)
- [StorageStack README](./README-STORAGE.md)
- [ApiStack README](./README-API.md)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [CloudFront Security Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/security-best-practices.html)
