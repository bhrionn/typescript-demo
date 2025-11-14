import * as cdk from 'aws-cdk-lib';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as config from 'aws-cdk-lib/aws-config';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * MonitoringStack properties extending base stack props
 */
export interface IMonitoringStackProps extends IBaseStackProps {
  readonly lambdaFunctions: lambda.IFunction[];
  readonly api: apigateway.RestApi;
  readonly database: rds.DatabaseInstance;
  readonly alarmEmail?: string;
}

/**
 * MonitoringStack implements comprehensive monitoring and audit logging
 *
 * Features:
 * - AWS CloudTrail for all API calls
 * - CloudWatch alarms for Lambda errors (>5%)
 * - CloudWatch alarms for API Gateway 5xx errors (>1%)
 * - CloudWatch alarms for RDS CPU (>80%)
 * - CloudWatch alarms for RDS storage (<20% free)
 * - AWS Config for compliance monitoring
 * - SNS topic for alarm notifications
 *
 * Requirements: 8.2, 8.13, 8.14, 8.15
 */
export class MonitoringStack extends BaseStack {
  public readonly trail: cloudtrail.Trail;
  public readonly alarmTopic: sns.Topic;
  public readonly configRecorder: config.CfnConfigurationRecorder;

  constructor(scope: Construct, id: string, props: IMonitoringStackProps) {
    super(scope, id, props);

    // Create SNS topic for alarm notifications
    this.alarmTopic = this.createAlarmTopic(props.alarmEmail);

    // Enable AWS CloudTrail for audit logging
    this.trail = this.createCloudTrail();

    // Create CloudWatch alarms for Lambda functions
    this.createLambdaAlarms(props.lambdaFunctions);

    // Create CloudWatch alarms for API Gateway
    this.createApiGatewayAlarms(props.api);

    // Create CloudWatch alarms for RDS
    this.createRdsAlarms(props.database);

    // Enable AWS Config for compliance monitoring
    this.configRecorder = this.createAwsConfig();

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create SNS topic for alarm notifications
   */
  private createAlarmTopic(alarmEmail?: string): sns.Topic {
    const topic = new sns.Topic(this, 'AlarmTopic', {
      topicName: this.getResourceName('sns', 'alarms'),
      displayName: `${this.config.projectName} Monitoring Alarms (${this.config.environment})`,
    });

    // Add email subscription if provided
    if (alarmEmail) {
      topic.addSubscription(new sns_subscriptions.EmailSubscription(alarmEmail));
    }

    cdk.Tags.of(topic).add('Name', this.getResourceName('sns', 'alarms'));
    cdk.Tags.of(topic).add('Purpose', 'Alarm Notifications');

    return topic;
  }

  /**
   * Create AWS CloudTrail for audit logging
   * Logs all API calls for security and compliance
   */
  private createCloudTrail(): cloudtrail.Trail {
    // Create S3 bucket for CloudTrail logs
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      bucketName: this.getResourceName('s3', 'cloudtrail'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(this.isProduction() ? 365 : 90),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: !this.isProduction(),
      enforceSSL: true,
    });

    cdk.Tags.of(trailBucket).add('Name', this.getResourceName('s3', 'cloudtrail'));
    cdk.Tags.of(trailBucket).add('Purpose', 'CloudTrail Logs');

    // Create CloudTrail
    const trail = new cloudtrail.Trail(this, 'CloudTrail', {
      trailName: this.getResourceName('trail', 'audit'),
      bucket: trailBucket,
      enableFileValidation: true, // Enable log file integrity validation
      includeGlobalServiceEvents: true, // Include global services like IAM
      isMultiRegionTrail: this.isProduction(), // Multi-region in production
      managementEvents: cloudtrail.ReadWriteType.ALL, // Log all management events
      sendToCloudWatchLogs: true, // Send logs to CloudWatch
      cloudWatchLogGroup: new cdk.aws_logs.LogGroup(this, 'TrailLogGroup', {
        logGroupName: `/aws/cloudtrail/${this.getResourceName('trail', 'audit')}`,
        retention: this.config.logRetentionDays as cdk.aws_logs.RetentionDays,
        removalPolicy: this.getRemovalPolicy(),
      }),
    });

    // Add S3 data events for file upload bucket
    // This will be added when integrating with StorageStack
    // trail.addS3EventSelector([{
    //   bucket: fileUploadBucket,
    //   objectPrefix: '',
    // }], {
    //   readWriteType: cloudtrail.ReadWriteType.ALL,
    // });

    cdk.Tags.of(trail).add('Name', this.getResourceName('trail', 'audit'));
    cdk.Tags.of(trail).add('Purpose', 'Audit Logging');

    return trail;
  }

  /**
   * Create CloudWatch alarms for Lambda functions
   * Alert when error rate exceeds 5%
   */
  private createLambdaAlarms(lambdaFunctions: lambda.IFunction[]): void {
    lambdaFunctions.forEach((fn) => {
      // Error rate alarm (>5%)
      const errorMetric = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const invocationMetric = fn.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Calculate error rate as percentage
      const errorRateMetric = new cloudwatch.MathExpression({
        expression: '(errors / invocations) * 100',
        usingMetrics: {
          errors: errorMetric,
          invocations: invocationMetric,
        },
        period: cdk.Duration.minutes(5),
      });

      const errorAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ErrorAlarm`, {
        alarmName: `${fn.functionName}-error-rate`,
        alarmDescription: `Lambda function ${fn.functionName} error rate exceeds 5%`,
        metric: errorRateMetric,
        threshold: 5, // 5% error rate
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Throttle alarm
      const throttleMetric = fn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      const throttleAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ThrottleAlarm`, {
        alarmName: `${fn.functionName}-throttles`,
        alarmDescription: `Lambda function ${fn.functionName} is being throttled`,
        metric: throttleMetric,
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

      // Duration alarm (approaching timeout)
      const durationMetric = fn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      const durationAlarm = new cloudwatch.Alarm(this, `${fn.node.id}DurationAlarm`, {
        alarmName: `${fn.functionName}-duration`,
        alarmDescription: `Lambda function ${fn.functionName} duration approaching timeout`,
        metric: durationMetric,
        threshold: 24000, // 24 seconds (80% of 30 second default timeout)
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    });
  }

  /**
   * Create CloudWatch alarms for API Gateway
   * Alert when 5xx error rate exceeds 1%
   */
  private createApiGatewayAlarms(api: apigateway.RestApi): void {
    // 5xx error rate alarm (>1%)
    const error5xxMetric = api.metricServerError({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const requestCountMetric = api.metricCount({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Calculate 5xx error rate as percentage
    const error5xxRateMetric = new cloudwatch.MathExpression({
      expression: '(errors / requests) * 100',
      usingMetrics: {
        errors: error5xxMetric,
        requests: requestCountMetric,
      },
      period: cdk.Duration.minutes(5),
    });

    const error5xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: `${api.restApiName}-5xx-error-rate`,
      alarmDescription: `API Gateway ${api.restApiName} 5xx error rate exceeds 1%`,
      metric: error5xxRateMetric,
      threshold: 1, // 1% error rate
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    error5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // 4xx error rate alarm (informational)
    const error4xxMetric = api.metricClientError({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const error4xxRateMetric = new cloudwatch.MathExpression({
      expression: '(errors / requests) * 100',
      usingMetrics: {
        errors: error4xxMetric,
        requests: requestCountMetric,
      },
      period: cdk.Duration.minutes(5),
    });

    const error4xxAlarm = new cloudwatch.Alarm(this, 'ApiGateway4xxAlarm', {
      alarmName: `${api.restApiName}-4xx-error-rate`,
      alarmDescription: `API Gateway ${api.restApiName} 4xx error rate is high`,
      metric: error4xxRateMetric,
      threshold: 10, // 10% error rate
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    error4xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Latency alarm
    const latencyMetric = api.metricLatency({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const latencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `${api.restApiName}-latency`,
      alarmDescription: `API Gateway ${api.restApiName} latency is high`,
      metric: latencyMetric,
      threshold: 5000, // 5 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    latencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }

  /**
   * Create CloudWatch alarms for RDS
   * Alert on high CPU (>80%) and low storage (<20% free)
   */
  private createRdsAlarms(database: rds.DatabaseInstance): void {
    // CPU utilization alarm (>80%)
    const cpuMetric = database.metricCPUUtilization({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const cpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      alarmName: `${database.instanceIdentifier}-cpu-utilization`,
      alarmDescription: `RDS instance ${database.instanceIdentifier} CPU exceeds 80%`,
      metric: cpuMetric,
      threshold: 80, // 80% CPU
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    cpuAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Free storage space alarm (<20% free)
    const freeStorageMetric = database.metricFreeStorageSpace({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Calculate 20% of allocated storage in bytes
    const allocatedStorageBytes = database.node.tryGetContext('allocatedStorage') || 20; // GB
    const twentyPercentThreshold = allocatedStorageBytes * 1024 * 1024 * 1024 * 0.2; // 20% in bytes

    const storageAlarm = new cloudwatch.Alarm(this, 'RdsStorageAlarm', {
      alarmName: `${database.instanceIdentifier}-free-storage`,
      alarmDescription: `RDS instance ${database.instanceIdentifier} has less than 20% free storage`,
      metric: freeStorageMetric,
      threshold: twentyPercentThreshold,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    storageAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Database connections alarm
    const connectionsMetric = database.metricDatabaseConnections({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const connectionsAlarm = new cloudwatch.Alarm(this, 'RdsConnectionsAlarm', {
      alarmName: `${database.instanceIdentifier}-connections`,
      alarmDescription: `RDS instance ${database.instanceIdentifier} has high connection count`,
      metric: connectionsMetric,
      threshold: 80, // Adjust based on instance type
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    connectionsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Read latency alarm - using custom metric since metricReadLatency is not available
    const readLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'ReadLatency',
      dimensionsMap: {
        DBInstanceIdentifier: database.instanceIdentifier,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const readLatencyAlarm = new cloudwatch.Alarm(this, 'RdsReadLatencyAlarm', {
      alarmName: `${database.instanceIdentifier}-read-latency`,
      alarmDescription: `RDS instance ${database.instanceIdentifier} has high read latency`,
      metric: readLatencyMetric,
      threshold: 0.1, // 100ms
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    readLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));

    // Write latency alarm - using custom metric since metricWriteLatency is not available
    const writeLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'WriteLatency',
      dimensionsMap: {
        DBInstanceIdentifier: database.instanceIdentifier,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const writeLatencyAlarm = new cloudwatch.Alarm(this, 'RdsWriteLatencyAlarm', {
      alarmName: `${database.instanceIdentifier}-write-latency`,
      alarmDescription: `RDS instance ${database.instanceIdentifier} has high write latency`,
      metric: writeLatencyMetric,
      threshold: 0.1, // 100ms
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    writeLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
  }

  /**
   * Enable AWS Config for compliance monitoring
   */
  private createAwsConfig(): config.CfnConfigurationRecorder {
    // Create S3 bucket for AWS Config
    const configBucket = new s3.Bucket(this, 'ConfigBucket', {
      bucketName: this.getResourceName('s3', 'aws-config'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldConfigData',
          enabled: true,
          expiration: cdk.Duration.days(this.isProduction() ? 365 : 90),
        },
      ],
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: !this.isProduction(),
      enforceSSL: true,
    });

    cdk.Tags.of(configBucket).add('Name', this.getResourceName('s3', 'aws-config'));
    cdk.Tags.of(configBucket).add('Purpose', 'AWS Config Data');

    // Create IAM role for AWS Config
    const configRole = new iam.Role(this, 'ConfigRole', {
      roleName: this.getResourceName('role', 'aws-config'),
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/ConfigRole')],
    });

    // Grant Config permission to write to S3 bucket
    configBucket.grantWrite(configRole);

    // Create delivery channel
    const deliveryChannel = new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      s3BucketName: configBucket.bucketName,
      configSnapshotDeliveryProperties: {
        deliveryFrequency: this.isProduction() ? 'TwentyFour_Hours' : 'Six_Hours',
      },
    });

    // Create configuration recorder
    const recorder = new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      name: this.getResourceName('config', 'recorder'),
      roleArn: configRole.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
        resourceTypes: [], // Empty when allSupported is true
      },
    });

    // Recorder depends on delivery channel
    recorder.addDependency(deliveryChannel);

    // Add managed config rules for security best practices
    this.createConfigRules();

    return recorder;
  }

  /**
   * Create AWS Config managed rules for compliance
   */
  private createConfigRules(): void {
    // S3 bucket encryption enabled
    new config.ManagedRule(this, 'S3BucketEncryptionRule', {
      configRuleName: this.getResourceName('config-rule', 's3-encryption'),
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED,
      description: 'Checks that S3 buckets have encryption enabled',
    });

    // S3 bucket public read prohibited
    new config.ManagedRule(this, 'S3BucketPublicReadRule', {
      configRuleName: this.getResourceName('config-rule', 's3-public-read'),
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_PUBLIC_READ_PROHIBITED,
      description: 'Checks that S3 buckets do not allow public read access',
    });

    // S3 bucket public write prohibited
    new config.ManagedRule(this, 'S3BucketPublicWriteRule', {
      configRuleName: this.getResourceName('config-rule', 's3-public-write'),
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_PUBLIC_WRITE_PROHIBITED,
      description: 'Checks that S3 buckets do not allow public write access',
    });

    // RDS encryption enabled
    new config.ManagedRule(this, 'RdsEncryptionRule', {
      configRuleName: this.getResourceName('config-rule', 'rds-encryption'),
      identifier: config.ManagedRuleIdentifiers.RDS_STORAGE_ENCRYPTED,
      description: 'Checks that RDS instances have encryption enabled',
    });

    // RDS in VPC
    new config.ManagedRule(this, 'RdsInVpcRule', {
      configRuleName: this.getResourceName('config-rule', 'rds-in-vpc'),
      identifier: config.ManagedRuleIdentifiers.RDS_INSTANCE_PUBLIC_ACCESS_CHECK,
      description: 'Checks that RDS instances are not publicly accessible',
    });

    // IAM password policy
    new config.ManagedRule(this, 'IamPasswordPolicyRule', {
      configRuleName: this.getResourceName('config-rule', 'iam-password-policy'),
      identifier: config.ManagedRuleIdentifiers.IAM_PASSWORD_POLICY,
      description: 'Checks that IAM password policy meets requirements',
    });

    // CloudTrail enabled
    new config.ManagedRule(this, 'CloudTrailEnabledRule', {
      configRuleName: this.getResourceName('config-rule', 'cloudtrail-enabled'),
      identifier: config.ManagedRuleIdentifiers.CLOUD_TRAIL_ENABLED,
      description: 'Checks that CloudTrail is enabled',
    });

    // VPC flow logs enabled
    new config.ManagedRule(this, 'VpcFlowLogsRule', {
      configRuleName: this.getResourceName('config-rule', 'vpc-flow-logs'),
      identifier: config.ManagedRuleIdentifiers.VPC_FLOW_LOGS_ENABLED,
      description: 'Checks that VPC Flow Logs are enabled',
    });
  }

  /**
   * Create CloudFormation outputs
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'CloudTrailArn', {
      value: this.trail.trailArn,
      description: 'CloudTrail ARN',
      exportName: `${this.stackName}-CloudTrailArn`,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for Alarms',
      exportName: `${this.stackName}-AlarmTopicArn`,
    });

    new cdk.CfnOutput(this, 'ConfigRecorderName', {
      value: this.configRecorder.name || 'config-recorder',
      description: 'AWS Config Recorder Name',
      exportName: `${this.stackName}-ConfigRecorderName`,
    });
  }
}
