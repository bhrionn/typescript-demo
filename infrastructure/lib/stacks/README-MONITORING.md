# MonitoringStack

## Overview

The MonitoringStack implements comprehensive monitoring, audit logging, and compliance tracking for the application infrastructure. It provides real-time alerting, audit trails, and compliance validation to ensure the system operates securely and reliably.

## Features

### 1. AWS CloudTrail (Audit Logging)

- **Purpose**: Records all API calls for security auditing and compliance
- **Configuration**:
  - Logs all management events (read and write)
  - Includes global service events (IAM, STS, etc.)
  - Multi-region trail in production
  - Log file integrity validation enabled
  - Logs sent to both S3 and CloudWatch Logs
- **Retention**:
  - Production: 365 days
  - Non-production: 90 days
- **Storage**: Logs stored in encrypted S3 bucket with lifecycle policies

### 2. CloudWatch Alarms

#### Lambda Function Alarms

For each Lambda function, the following alarms are created:

- **Error Rate Alarm**
  - Threshold: >5% error rate
  - Evaluation: 2 consecutive periods of 5 minutes
  - Action: SNS notification
- **Throttle Alarm**
  - Threshold: >10 throttles in 5 minutes
  - Evaluation: 1 period
  - Action: SNS notification
- **Duration Alarm**
  - Threshold: >80% of function timeout
  - Evaluation: 2 consecutive periods of 5 minutes
  - Action: SNS notification

#### API Gateway Alarms

- **5xx Error Rate Alarm**
  - Threshold: >1% error rate
  - Evaluation: 2 consecutive periods of 5 minutes
  - Action: SNS notification
- **4xx Error Rate Alarm** (Informational)
  - Threshold: >10% error rate
  - Evaluation: 3 consecutive periods of 5 minutes
  - Action: SNS notification
- **Latency Alarm**
  - Threshold: >5 seconds average latency
  - Evaluation: 3 consecutive periods of 5 minutes
  - Action: SNS notification

#### RDS Database Alarms

- **CPU Utilization Alarm**
  - Threshold: >80% CPU usage
  - Evaluation: 2 consecutive periods of 5 minutes
  - Action: SNS notification
- **Free Storage Alarm**
  - Threshold: <20% free storage
  - Evaluation: 1 period
  - Action: SNS notification
- **Database Connections Alarm**
  - Threshold: >80 connections
  - Evaluation: 2 consecutive periods of 5 minutes
  - Action: SNS notification
- **Read Latency Alarm**
  - Threshold: >100ms average
  - Evaluation: 3 consecutive periods of 5 minutes
  - Action: SNS notification
- **Write Latency Alarm**
  - Threshold: >100ms average
  - Evaluation: 3 consecutive periods of 5 minutes
  - Action: SNS notification

### 3. SNS Alarm Topic

- **Purpose**: Central notification channel for all alarms
- **Subscriptions**: Email notifications (configurable)
- **Integration**: All CloudWatch alarms send notifications to this topic

### 4. AWS Config (Compliance Monitoring)

#### Configuration Recorder

- Records configuration changes for all supported AWS resources
- Includes global resources (IAM, etc.)
- Delivery frequency:
  - Production: Every 24 hours
  - Non-production: Every 6 hours

#### Managed Config Rules

The following AWS Config managed rules are enabled:

1. **S3 Bucket Encryption**
   - Ensures all S3 buckets have encryption enabled
2. **S3 Bucket Public Read Prohibited**
   - Ensures S3 buckets don't allow public read access
3. **S3 Bucket Public Write Prohibited**
   - Ensures S3 buckets don't allow public write access
4. **RDS Storage Encrypted**
   - Ensures RDS instances have encryption at rest enabled
5. **RDS Public Access Check**
   - Ensures RDS instances are not publicly accessible
6. **IAM Password Policy**
   - Validates IAM password policy meets security requirements
7. **CloudTrail Enabled**
   - Ensures CloudTrail is enabled in the account
8. **VPC Flow Logs Enabled**
   - Ensures VPC Flow Logs are enabled for network monitoring

## Stack Dependencies

The MonitoringStack depends on:

- **ComputeStack**: Lambda functions to monitor
- **ApiStack**: API Gateway to monitor
- **StorageStack**: RDS database to monitor

## Deployment

### Prerequisites

- ComputeStack, ApiStack, and StorageStack must be deployed first
- (Optional) Email address for alarm notifications

### Deploy Command

```bash
cd infrastructure
cdk deploy MonitoringStack --context environment=dev
```

### With Email Notifications

Set the alarm email via context or environment variable:

```bash
cdk deploy MonitoringStack \
  --context environment=dev \
  --context alarmEmail=ops@example.com
```

Or set in `cdk.json`:

```json
{
  "context": {
    "alarmEmail": "ops@example.com"
  }
}
```

## Outputs

The stack exports the following values:

- **CloudTrailArn**: ARN of the CloudTrail trail
- **AlarmTopicArn**: ARN of the SNS topic for alarm notifications
- **ConfigRecorderName**: Name of the AWS Config recorder

## Monitoring Best Practices

### 1. Alarm Response

- Subscribe appropriate team members to the SNS alarm topic
- Establish runbooks for common alarm scenarios
- Set up escalation procedures for critical alarms

### 2. CloudTrail Analysis

- Regularly review CloudTrail logs for suspicious activity
- Use CloudWatch Insights to query and analyze logs
- Set up additional alarms for specific security events

### 3. AWS Config Compliance

- Review Config compliance dashboard regularly
- Investigate and remediate non-compliant resources
- Add custom Config rules for organization-specific requirements

### 4. Cost Optimization

- CloudTrail logs are stored in S3 with lifecycle policies
- Consider adjusting retention periods based on compliance requirements
- Use S3 Intelligent-Tiering for cost optimization

## Alarm Tuning

### Adjusting Thresholds

Alarm thresholds can be adjusted based on your application's behavior:

```typescript
// Example: Adjust Lambda error rate threshold
const errorAlarm = new cloudwatch.Alarm(this, 'ErrorAlarm', {
  // ... other properties
  threshold: 10, // Change from 5% to 10%
});
```

### Adding Custom Alarms

Add application-specific alarms by extending the MonitoringStack:

```typescript
// Example: Custom business metric alarm
const customMetric = new cloudwatch.Metric({
  namespace: 'CustomApp',
  metricName: 'BusinessMetric',
  statistic: 'Sum',
  period: cdk.Duration.minutes(5),
});

new cloudwatch.Alarm(this, 'CustomAlarm', {
  metric: customMetric,
  threshold: 100,
  evaluationPeriods: 2,
});
```

## Troubleshooting

### CloudTrail Not Logging

1. Verify the trail is enabled: `aws cloudtrail get-trail-status --name <trail-name>`
2. Check S3 bucket permissions
3. Verify CloudWatch Logs role has correct permissions

### Alarms Not Triggering

1. Check alarm state in CloudWatch console
2. Verify SNS topic subscription is confirmed
3. Check alarm evaluation periods and datapoints
4. Review metric data to ensure it's being collected

### AWS Config Not Recording

1. Verify configuration recorder is started
2. Check delivery channel configuration
3. Verify IAM role permissions
4. Check S3 bucket permissions

## Security Considerations

1. **CloudTrail Logs**
   - Stored in encrypted S3 bucket
   - Access restricted via IAM policies
   - Log file integrity validation enabled

2. **Config Data**
   - Stored in encrypted S3 bucket
   - Access restricted to authorized personnel
   - Regular compliance reviews

3. **SNS Topic**
   - Use HTTPS endpoints for subscriptions
   - Implement access policies to restrict publishers
   - Consider encrypting messages with KMS

## Requirements Mapping

This stack implements the following requirements:

- **8.2**: CloudTrail for audit logging
- **8.13**: CloudWatch alarms for Lambda errors (>5%)
- **8.14**: CloudWatch alarms for API Gateway 5xx errors (>1%)
- **8.15**: CloudWatch alarms for RDS CPU (>80%) and storage (<20% free)
- **8.2**: AWS Config for compliance monitoring

## Related Documentation

- [AWS CloudTrail Documentation](https://docs.aws.amazon.com/cloudtrail/)
- [CloudWatch Alarms Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [AWS Config Documentation](https://docs.aws.amazon.com/config/)
- [SNS Documentation](https://docs.aws.amazon.com/sns/)
