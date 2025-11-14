# MonitoringStack Implementation Guide

## Overview

This document provides implementation details for the MonitoringStack, which adds comprehensive monitoring, audit logging, and compliance tracking to the application infrastructure.

## Implementation Summary

The MonitoringStack implements:

1. **AWS CloudTrail** - Audit logging for all API calls
2. **CloudWatch Alarms** - Real-time alerting for Lambda, API Gateway, and RDS
3. **SNS Topic** - Central notification channel for alarms
4. **AWS Config** - Compliance monitoring with managed rules

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MonitoringStack                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  CloudTrail  │──────▶│  S3 Bucket   │                   │
│  │              │      │  (Logs)      │                   │
│  └──────┬───────┘      └──────────────┘                   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                          │
│  │ CloudWatch   │                                          │
│  │ Logs         │                                          │
│  └──────────────┘                                          │
│                                                             │
│  ┌──────────────────────────────────────────────┐         │
│  │         CloudWatch Alarms                    │         │
│  ├──────────────────────────────────────────────┤         │
│  │  • Lambda Error Rate (>5%)                   │         │
│  │  • Lambda Throttles                          │         │
│  │  • Lambda Duration                           │         │
│  │  • API Gateway 5xx (>1%)                     │         │
│  │  • API Gateway 4xx (>10%)                    │         │
│  │  • API Gateway Latency                       │         │
│  │  • RDS CPU (>80%)                            │         │
│  │  • RDS Storage (<20%)                        │         │
│  │  • RDS Connections                           │         │
│  │  • RDS Read/Write Latency                    │         │
│  └──────────────┬───────────────────────────────┘         │
│                 │                                           │
│                 ▼                                           │
│  ┌──────────────────────────────────────────────┐         │
│  │         SNS Topic (Alarms)                   │         │
│  │  • Email Subscriptions                       │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  AWS Config  │──────▶│  S3 Bucket   │                   │
│  │  Recorder    │      │  (Config)    │                   │
│  └──────┬───────┘      └──────────────┘                   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────┐         │
│  │         Config Rules                         │         │
│  ├──────────────────────────────────────────────┤         │
│  │  • S3 Encryption Enabled                     │         │
│  │  • S3 Public Access Prohibited               │         │
│  │  • RDS Encryption Enabled                    │         │
│  │  • RDS Not Publicly Accessible               │         │
│  │  • IAM Password Policy                       │         │
│  │  • CloudTrail Enabled                        │         │
│  │  • VPC Flow Logs Enabled                     │         │
│  └──────────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. CloudTrail Configuration

**Purpose**: Audit logging for security and compliance

**Implementation Details**:

- Trail logs all management events (read and write)
- Includes global service events (IAM, STS, CloudFront, etc.)
- Multi-region trail in production environments
- Log file integrity validation enabled
- Logs sent to both S3 and CloudWatch Logs

**S3 Bucket Configuration**:

- Encryption: S3-managed (AES-256)
- Versioning: Enabled
- Lifecycle policies:
  - Transition to Infrequent Access after 30 days
  - Transition to Glacier after 90 days
  - Delete after 365 days (prod) or 90 days (non-prod)
- Block all public access
- SSL enforcement

**CloudWatch Logs Integration**:

- Logs sent to dedicated log group
- Retention based on environment configuration
- Enables real-time log analysis and alerting

### 2. CloudWatch Alarms

#### Lambda Function Alarms

For each Lambda function, three alarms are created:

**Error Rate Alarm**:

- Metric: `(Errors / Invocations) * 100`
- Threshold: 5%
- Evaluation: 2 consecutive periods of 5 minutes
- Purpose: Detect when Lambda functions are failing frequently

**Throttle Alarm**:

- Metric: `Throttles`
- Threshold: 10 throttles
- Evaluation: 1 period of 5 minutes
- Purpose: Detect when Lambda functions hit concurrency limits

**Duration Alarm**:

- Metric: `Duration`
- Threshold: 24 seconds (80% of 30-second timeout)
- Evaluation: 2 consecutive periods of 5 minutes
- Purpose: Detect when Lambda functions are approaching timeout

#### API Gateway Alarms

**5xx Error Rate Alarm**:

- Metric: `(5XXError / Count) * 100`
- Threshold: 1%
- Evaluation: 2 consecutive periods of 5 minutes
- Purpose: Detect server-side errors in API Gateway

**4xx Error Rate Alarm** (Informational):

- Metric: `(4XXError / Count) * 100`
- Threshold: 10%
- Evaluation: 3 consecutive periods of 5 minutes
- Purpose: Detect high rate of client errors (may indicate API misuse)

**Latency Alarm**:

- Metric: `Latency`
- Threshold: 5000ms (5 seconds)
- Evaluation: 3 consecutive periods of 5 minutes
- Purpose: Detect when API response times are degraded

#### RDS Database Alarms

**CPU Utilization Alarm**:

- Metric: `CPUUtilization`
- Threshold: 80%
- Evaluation: 2 consecutive periods of 5 minutes
- Purpose: Detect when database is under heavy load

**Free Storage Alarm**:

- Metric: `FreeStorageSpace`
- Threshold: 20% of allocated storage
- Evaluation: 1 period of 5 minutes
- Purpose: Detect when database is running out of storage

**Database Connections Alarm**:

- Metric: `DatabaseConnections`
- Threshold: 80 connections
- Evaluation: 2 consecutive periods of 5 minutes
- Purpose: Detect connection pool exhaustion

**Read Latency Alarm**:

- Metric: `ReadLatency`
- Threshold: 100ms
- Evaluation: 3 consecutive periods of 5 minutes
- Purpose: Detect slow read operations

**Write Latency Alarm**:

- Metric: `WriteLatency`
- Threshold: 100ms
- Evaluation: 3 consecutive periods of 5 minutes
- Purpose: Detect slow write operations

### 3. SNS Topic for Notifications

**Configuration**:

- Topic name follows naming convention
- Email subscriptions (optional, configured via context or environment)
- All alarms send notifications to this topic

**Email Subscription**:

- Requires confirmation after deployment
- Check email inbox for AWS SNS subscription confirmation
- Click confirmation link to start receiving notifications

### 4. AWS Config

**Configuration Recorder**:

- Records all supported resource types
- Includes global resources (IAM, etc.)
- Delivery frequency:
  - Production: Every 24 hours
  - Non-production: Every 6 hours

**S3 Bucket for Config Data**:

- Encryption: S3-managed (AES-256)
- Versioning: Enabled
- Lifecycle: Delete after 365 days (prod) or 90 days (non-prod)
- Block all public access
- SSL enforcement

**Managed Config Rules**:

1. **s3-bucket-server-side-encryption-enabled**
   - Ensures S3 buckets have encryption enabled
2. **s3-bucket-public-read-prohibited**
   - Ensures S3 buckets don't allow public read
3. **s3-bucket-public-write-prohibited**
   - Ensures S3 buckets don't allow public write
4. **rds-storage-encrypted**
   - Ensures RDS instances have encryption at rest
5. **rds-instance-public-access-check**
   - Ensures RDS instances are not publicly accessible
6. **iam-password-policy**
   - Validates IAM password policy
7. **cloud-trail-enabled**
   - Ensures CloudTrail is enabled
8. **vpc-flow-logs-enabled**
   - Ensures VPC Flow Logs are enabled

## Deployment

### Prerequisites

Before deploying MonitoringStack, ensure these stacks are deployed:

- ComputeStack (for Lambda functions)
- ApiStack (for API Gateway)
- StorageStack (for RDS database)

### Deploy Command

```bash
# Without email notifications
cdk deploy MonitoringStack --context environment=dev

# With email notifications
cdk deploy MonitoringStack \
  --context environment=dev \
  --context alarmEmail=ops@example.com
```

Or set environment variable:

```bash
export ALARM_EMAIL=ops@example.com
cdk deploy MonitoringStack --context environment=dev
```

### Post-Deployment Steps

1. **Confirm SNS Email Subscription**
   - Check email inbox for AWS SNS subscription confirmation
   - Click the confirmation link
   - You will start receiving alarm notifications

2. **Verify CloudTrail**

   ```bash
   aws cloudtrail get-trail-status --name <trail-name>
   ```

3. **Verify AWS Config**

   ```bash
   aws configservice describe-configuration-recorders
   aws configservice describe-delivery-channels
   ```

4. **Test Alarms** (Optional)
   - Trigger a test alarm to verify notifications work
   - Example: Manually set an alarm to ALARM state in CloudWatch console

## Monitoring Dashboard

### CloudWatch Console

Access monitoring data in AWS CloudWatch Console:

1. **Alarms**: View all alarm states
2. **Logs**: Query CloudTrail logs
3. **Metrics**: View Lambda, API Gateway, and RDS metrics
4. **Dashboards**: Create custom dashboards (optional)

### AWS Config Console

Access compliance data in AWS Config Console:

1. **Dashboard**: View compliance summary
2. **Resources**: View resource inventory
3. **Rules**: View compliance rules and their status
4. **Timeline**: View configuration changes over time

## Cost Considerations

### CloudTrail

- **S3 Storage**: ~$0.023/GB/month
- **CloudWatch Logs**: ~$0.50/GB ingested
- **Typical Cost**: $10-50/month depending on API activity

### CloudWatch Alarms

- **Standard Alarms**: $0.10/alarm/month
- **High-Resolution Alarms**: $0.30/alarm/month
- **Typical Cost**: $5-20/month (50-200 alarms)

### AWS Config

- **Configuration Items**: $0.003/item recorded
- **Rule Evaluations**: $0.001/evaluation
- **Typical Cost**: $20-100/month depending on resource count

### Total Estimated Cost

- **Development**: $35-170/month
- **Production**: $50-250/month

## Troubleshooting

### CloudTrail Not Logging

**Symptoms**: No logs appearing in S3 or CloudWatch

**Solutions**:

1. Verify trail is enabled:
   ```bash
   aws cloudtrail get-trail-status --name <trail-name>
   ```
2. Check S3 bucket permissions
3. Verify CloudWatch Logs role has correct permissions
4. Check trail configuration in CloudTrail console

### Alarms Not Triggering

**Symptoms**: Expected alarms not firing

**Solutions**:

1. Check alarm state in CloudWatch console
2. Verify metric data is being collected
3. Review alarm threshold and evaluation periods
4. Check SNS topic subscription is confirmed
5. Verify alarm actions are configured

### AWS Config Not Recording

**Symptoms**: No configuration items in Config

**Solutions**:

1. Verify configuration recorder is started:
   ```bash
   aws configservice describe-configuration-recorder-status
   ```
2. Start recorder if stopped:
   ```bash
   aws configservice start-configuration-recorder \
     --configuration-recorder-name <recorder-name>
   ```
3. Check delivery channel configuration
4. Verify IAM role permissions
5. Check S3 bucket permissions

### High Costs

**Symptoms**: Monitoring costs higher than expected

**Solutions**:

1. Review CloudTrail data events (most expensive)
2. Adjust log retention periods
3. Reduce alarm evaluation frequency
4. Filter CloudTrail events to specific resources
5. Use S3 lifecycle policies to transition old logs to Glacier

## Best Practices

### 1. Alarm Response Procedures

- Document runbooks for each alarm type
- Establish escalation procedures
- Set up on-call rotations
- Use PagerDuty or similar for critical alarms

### 2. Log Analysis

- Use CloudWatch Insights for log queries
- Set up additional metric filters for custom metrics
- Create dashboards for common queries
- Archive logs to S3 for long-term retention

### 3. Compliance Monitoring

- Review Config compliance dashboard weekly
- Investigate and remediate non-compliant resources
- Add custom Config rules for organization-specific requirements
- Use Config aggregators for multi-account setups

### 4. Cost Optimization

- Adjust retention periods based on compliance requirements
- Use S3 lifecycle policies for log archival
- Filter CloudTrail events to reduce volume
- Review and remove unused alarms

## Security Considerations

### CloudTrail Logs

- Stored in encrypted S3 bucket
- Access restricted via IAM policies
- Log file integrity validation enabled
- Consider enabling MFA delete for production

### Config Data

- Stored in encrypted S3 bucket
- Access restricted to authorized personnel
- Regular compliance reviews
- Consider cross-region replication for disaster recovery

### SNS Topic

- Use HTTPS endpoints for subscriptions
- Implement access policies to restrict publishers
- Consider encrypting messages with KMS
- Audit subscription changes

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 8.2**: CloudTrail for audit logging
- **Requirement 8.13**: CloudWatch alarms for Lambda errors (>5%)
- **Requirement 8.14**: CloudWatch alarms for API Gateway 5xx errors (>1%)
- **Requirement 8.15**: CloudWatch alarms for RDS CPU (>80%) and storage (<20% free)
- **Requirement 8.2**: AWS Config for compliance monitoring

## Next Steps

After deploying MonitoringStack:

1. Confirm SNS email subscription
2. Review alarm thresholds and adjust if needed
3. Create CloudWatch dashboards for visualization
4. Set up additional custom alarms for business metrics
5. Integrate with incident management tools (PagerDuty, Opsgenie, etc.)
6. Document alarm response procedures
7. Schedule regular compliance reviews

## Related Documentation

- [README-MONITORING.md](README-MONITORING.md) - User-facing documentation
- [AWS CloudTrail Best Practices](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/best-practices-security.html)
- [CloudWatch Alarms Best Practices](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html)
- [AWS Config Best Practices](https://docs.aws.amazon.com/config/latest/developerguide/best-practices.html)
