import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * StorageStack properties extending base stack props
 */
export interface IStorageStackProps extends IBaseStackProps {
  readonly vpc: ec2.IVpc;
  readonly privateDatabaseSubnets: ec2.ISubnet[];
  readonly rdsSecurityGroup: ec2.ISecurityGroup;
}

/**
 * StorageStack creates S3 buckets and RDS PostgreSQL database
 *
 * S3 Buckets:
 * - Web application bucket: Public read via CloudFront only
 * - File uploads bucket: Private access with AES-256 encryption
 *
 * RDS PostgreSQL:
 * - Deployed in private database subnets
 * - Encryption at rest enabled
 * - Automated backups with 7-day retention (configurable by environment)
 * - Multi-AZ deployment for production
 * - Credentials stored in AWS Secrets Manager
 *
 * Requirements: 2.4, 2.6, 3.5, 3.6, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11
 */
export class StorageStack extends BaseStack {
  public readonly webAppBucket: s3.Bucket;
  public readonly fileUploadBucket: s3.Bucket;
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: IStorageStackProps) {
    super(scope, id, props);

    // Create S3 buckets
    this.webAppBucket = this.createWebAppBucket();
    this.fileUploadBucket = this.createFileUploadBucket();

    // Create RDS database with credentials in Secrets Manager
    const { database, secret } = this.createRdsDatabase(
      props.vpc,
      props.privateDatabaseSubnets,
      props.rdsSecurityGroup
    );
    this.database = database;
    this.databaseSecret = secret;

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create S3 bucket for web application
   * Public read via CloudFront only, no direct public access
   */
  private createWebAppBucket(): s3.Bucket {
    const bucket = new s3.Bucket(this, 'WebAppBucket', {
      bucketName: this.getResourceName('s3', 'web-app'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block direct public access
      versioned: this.isProduction(),
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: !this.isProduction(),
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'], // Will be restricted by CloudFront
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Add tags
    cdk.Tags.of(bucket).add('Name', this.getResourceName('s3', 'web-app'));
    cdk.Tags.of(bucket).add('Purpose', 'Web Application Static Assets');

    return bucket;
  }

  /**
   * Create S3 bucket for file uploads
   * Private access with AES-256 encryption
   */
  private createFileUploadBucket(): s3.Bucket {
    const bucket = new s3.Bucket(this, 'FileUploadBucket', {
      bucketName: this.getResourceName('s3', 'file-uploads'),
      encryption: s3.BucketEncryption.S3_MANAGED, // AES-256 encryption
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Prevent all public access
      versioned: this.isProduction(),
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: !this.isProduction(),
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Will be restricted by API Gateway
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Add explicit bucket policy to deny non-SSL requests
    bucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: 'DenyInsecureTransport',
        effect: cdk.aws_iam.Effect.DENY,
        principals: [new cdk.aws_iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        conditions: {
          Bool: {
            'aws:SecureTransport': 'false',
          },
        },
      })
    );

    // Add tags
    cdk.Tags.of(bucket).add('Name', this.getResourceName('s3', 'file-uploads'));
    cdk.Tags.of(bucket).add('Purpose', 'User File Uploads');
    cdk.Tags.of(bucket).add('Encryption', 'AES-256');

    return bucket;
  }

  /**
   * Create RDS PostgreSQL database instance
   * Deployed in private subnets with encryption and automated backups
   */
  private createRdsDatabase(
    vpc: ec2.IVpc,
    privateDatabaseSubnets: ec2.ISubnet[],
    securityGroup: ec2.ISecurityGroup
  ): { database: rds.DatabaseInstance; secret: secretsmanager.ISecret } {
    // Create database credentials in Secrets Manager
    const databaseCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: this.getResourceName('secret', 'rds-credentials'),
      description: 'RDS PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbadmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
      removalPolicy: this.getRemovalPolicy(),
    });

    // Create subnet group for RDS
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      subnetGroupName: this.getResourceName('subnet-group', 'rds'),
      description: 'Subnet group for RDS PostgreSQL in private database subnets',
      vpc,
      vpcSubnets: {
        subnets: privateDatabaseSubnets,
      },
      removalPolicy: this.getRemovalPolicy(),
    });

    // Create parameter group for PostgreSQL
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      description: 'Parameter group for PostgreSQL 15',
      parameters: {
        'rds.force_ssl': '1', // Enforce SSL connections
        log_connections: '1',
        log_disconnections: '1',
        log_duration: '1',
      },
    });

    // Create RDS instance
    const database = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: this.getResourceName('rds', 'postgres'),
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: this.isProduction()
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: {
        subnets: privateDatabaseSubnets,
      },
      subnetGroup,
      securityGroups: [securityGroup],
      credentials: rds.Credentials.fromSecret(databaseCredentials),
      databaseName: 'appdb',
      allocatedStorage: this.isProduction() ? 100 : 20,
      maxAllocatedStorage: this.isProduction() ? 500 : 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true, // Enable encryption at rest
      multiAz: this.config.enableMultiAz, // Multi-AZ for production
      backupRetention: cdk.Duration.days(this.config.rdsBackupRetentionDays),
      preferredBackupWindow: '03:00-04:00', // 3-4 AM UTC
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00', // Sunday 4-5 AM UTC
      deletionProtection: this.isProduction(),
      removalPolicy: this.getRemovalPolicy(),
      parameterGroup,
      enablePerformanceInsights: this.isProduction(),
      performanceInsightRetention: this.isProduction()
        ? rds.PerformanceInsightRetention.DEFAULT
        : undefined,
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      autoMinorVersionUpgrade: true,
      publiclyAccessible: false, // Never publicly accessible
    });

    // Add tags
    cdk.Tags.of(database).add('Name', this.getResourceName('rds', 'postgres'));
    cdk.Tags.of(database).add('Engine', 'PostgreSQL');
    cdk.Tags.of(database).add('Encryption', 'Enabled');

    return { database, secret: databaseCredentials };
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    // S3 bucket outputs
    new cdk.CfnOutput(this, 'WebAppBucketName', {
      value: this.webAppBucket.bucketName,
      description: 'Web Application S3 Bucket Name',
      exportName: `${this.stackName}-WebAppBucketName`,
    });

    new cdk.CfnOutput(this, 'WebAppBucketArn', {
      value: this.webAppBucket.bucketArn,
      description: 'Web Application S3 Bucket ARN',
      exportName: `${this.stackName}-WebAppBucketArn`,
    });

    new cdk.CfnOutput(this, 'FileUploadBucketName', {
      value: this.fileUploadBucket.bucketName,
      description: 'File Upload S3 Bucket Name',
      exportName: `${this.stackName}-FileUploadBucketName`,
    });

    new cdk.CfnOutput(this, 'FileUploadBucketArn', {
      value: this.fileUploadBucket.bucketArn,
      description: 'File Upload S3 Bucket ARN',
      exportName: `${this.stackName}-FileUploadBucketArn`,
    });

    // RDS outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL Endpoint Address',
      exportName: `${this.stackName}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.database.dbInstanceEndpointPort,
      description: 'RDS PostgreSQL Port',
      exportName: `${this.stackName}-DatabasePort`,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: 'appdb',
      description: 'RDS PostgreSQL Database Name',
      exportName: `${this.stackName}-DatabaseName`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'RDS Credentials Secret ARN',
      exportName: `${this.stackName}-DatabaseSecretArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretName', {
      value: this.databaseSecret.secretName,
      description: 'RDS Credentials Secret Name',
      exportName: `${this.stackName}-DatabaseSecretName`,
    });
  }
}
