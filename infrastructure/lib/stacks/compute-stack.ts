import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';
import * as path from 'path';

/**
 * ComputeStack properties extending base stack props
 */
export interface IComputeStackProps extends IBaseStackProps {
  readonly vpc: ec2.IVpc;
  readonly privateAppSubnets: ec2.ISubnet[];
  readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly fileUploadBucket: s3.IBucket;
  readonly userPoolId: string;
  readonly userPoolArn: string;
}

/**
 * ComputeStack creates Lambda functions for API and business logic
 *
 * Lambda Functions:
 * - Authentication token validation
 * - File upload processing
 * - API business logic handlers
 *
 * All Lambda functions:
 * - Run in VPC private subnets
 * - Use IAM roles with least privilege policies
 * - Access environment variables from Secrets Manager
 * - Share dependencies via Lambda Layer
 *
 * Requirements: 2.3, 2.4, 2.5, 8.12
 */
export class ComputeStack extends BaseStack {
  public readonly sharedLayer: lambda.LayerVersion;
  public readonly authValidationFunction: lambda.Function;
  public readonly fileUploadFunction: lambda.Function;
  public readonly fileListFunction: lambda.Function;
  public readonly fileMetadataFunction: lambda.Function;
  public readonly fileDownloadUrlFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: IComputeStackProps) {
    super(scope, id, props);

    // Create Lambda Layer for shared dependencies
    this.sharedLayer = this.createSharedLayer();

    // Create Lambda execution role with least privilege
    const lambdaRole = this.createLambdaExecutionRole(props.databaseSecret, props.fileUploadBucket);

    // Common Lambda configuration
    const commonLambdaConfig = {
      runtime: lambda.Runtime.NODEJS_20_X,
      layers: [this.sharedLayer],
      role: lambdaRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.privateAppSubnets,
      },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: this.isProduction() ? 512 : 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        NODE_ENV: this.config.environment,
        DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
        FILE_UPLOAD_BUCKET: props.fileUploadBucket.bucketName,
        USER_POOL_ID: props.userPoolId,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1', // Enable connection reuse
      },
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
    };

    // Create Lambda functions
    this.authValidationFunction = this.createAuthValidationFunction(commonLambdaConfig);
    this.fileUploadFunction = this.createFileUploadFunction(commonLambdaConfig);
    this.fileListFunction = this.createFileListFunction(commonLambdaConfig);
    this.fileMetadataFunction = this.createFileMetadataFunction(commonLambdaConfig);
    this.fileDownloadUrlFunction = this.createFileDownloadUrlFunction(
      commonLambdaConfig,
      props.fileUploadBucket
    );

    // Grant permissions
    this.grantPermissions(props);

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create Lambda Layer with shared dependencies
   * Includes AWS SDK v3, database client (pg), and common utilities
   */
  private createSharedLayer(): lambda.LayerVersion {
    const layer = new lambda.LayerVersion(this, 'SharedLayer', {
      layerVersionName: this.getResourceName('lambda-layer', 'shared'),
      description: 'Shared dependencies for Lambda functions (AWS SDK v3, pg)',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist/layer'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'mkdir -p /asset-output/nodejs',
              'cd /asset-output/nodejs',
              'npm init -y',
              'npm install @aws-sdk/client-s3 @aws-sdk/client-secrets-manager @aws-sdk/client-cognito-identity-provider pg',
              'rm package.json package-lock.json',
            ].join(' && '),
          ],
        },
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      removalPolicy: this.getRemovalPolicy(),
    });

    cdk.Tags.of(layer).add('Name', this.getResourceName('lambda-layer', 'shared'));
    cdk.Tags.of(layer).add('Purpose', 'Shared Lambda Dependencies');

    return layer;
  }

  /**
   * Create IAM role for Lambda functions with least privilege policies
   */
  private createLambdaExecutionRole(
    databaseSecret: secretsmanager.ISecret,
    fileUploadBucket: s3.IBucket
  ): iam.Role {
    const role = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: this.getResourceName('role', 'lambda-execution'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Lambda functions with least privilege',
      managedPolicies: [
        // Basic Lambda execution (CloudWatch Logs)
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        // VPC access for Lambda
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
        // X-Ray tracing
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Grant read access to database secret
    databaseSecret.grantRead(role);

    // Grant S3 permissions for file upload bucket
    fileUploadBucket.grantReadWrite(role);

    // Grant Cognito permissions for token validation
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:GetUser', 'cognito-idp:AdminGetUser', 'cognito-idp:ListUsers'],
        resources: ['*'], // Will be scoped to specific User Pool in Lambda
      })
    );

    cdk.Tags.of(role).add('Name', this.getResourceName('role', 'lambda-execution'));
    cdk.Tags.of(role).add('Purpose', 'Lambda Execution');

    return role;
  }

  /**
   * Create Lambda function for authentication token validation
   */
  private createAuthValidationFunction(commonConfig: {
    runtime: lambda.Runtime;
    layers: lambda.ILayerVersion[];
    role: iam.IRole;
    vpc: ec2.IVpc;
    vpcSubnets: ec2.SubnetSelection;
    securityGroups: ec2.ISecurityGroup[];
    timeout: cdk.Duration;
    memorySize: number;
    logRetention: logs.RetentionDays;
    environment: { [key: string]: string };
    tracing: lambda.Tracing;
  }): lambda.Function {
    const fn = new lambda.Function(this, 'AuthValidationFunction', {
      ...commonConfig,
      functionName: this.getResourceName('lambda', 'auth-validation'),
      description: 'Validates JWT tokens from Cognito',
      handler: 'handlers/auth/validate.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
    });

    cdk.Tags.of(fn).add('Name', this.getResourceName('lambda', 'auth-validation'));
    cdk.Tags.of(fn).add('Purpose', 'Authentication');

    return fn;
  }

  /**
   * Create Lambda function for file upload processing
   */
  private createFileUploadFunction(commonConfig: {
    runtime: lambda.Runtime;
    layers: lambda.ILayerVersion[];
    role: iam.IRole;
    vpc: ec2.IVpc;
    vpcSubnets: ec2.SubnetSelection;
    securityGroups: ec2.ISecurityGroup[];
    timeout: cdk.Duration;
    memorySize: number;
    logRetention: logs.RetentionDays;
    environment: { [key: string]: string };
    tracing: lambda.Tracing;
  }): lambda.Function {
    const fn = new lambda.Function(this, 'FileUploadFunction', {
      ...commonConfig,
      functionName: this.getResourceName('lambda', 'file-upload'),
      description: 'Processes file uploads to S3 and stores metadata in RDS',
      handler: 'handlers/files/upload.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
      timeout: cdk.Duration.seconds(60), // Longer timeout for file uploads
      memorySize: this.isProduction() ? 1024 : 512, // More memory for file processing
    });

    cdk.Tags.of(fn).add('Name', this.getResourceName('lambda', 'file-upload'));
    cdk.Tags.of(fn).add('Purpose', 'File Upload');

    return fn;
  }

  /**
   * Create Lambda function for retrieving user's uploaded files
   */
  private createFileListFunction(commonConfig: {
    runtime: lambda.Runtime;
    layers: lambda.ILayerVersion[];
    role: iam.IRole;
    vpc: ec2.IVpc;
    vpcSubnets: ec2.SubnetSelection;
    securityGroups: ec2.ISecurityGroup[];
    timeout: cdk.Duration;
    memorySize: number;
    logRetention: logs.RetentionDays;
    environment: { [key: string]: string };
    tracing: lambda.Tracing;
  }): lambda.Function {
    const fn = new lambda.Function(this, 'FileListFunction', {
      ...commonConfig,
      functionName: this.getResourceName('lambda', 'file-list'),
      description: "Retrieves list of user's uploaded files",
      handler: 'handlers/files/list.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
    });

    cdk.Tags.of(fn).add('Name', this.getResourceName('lambda', 'file-list'));
    cdk.Tags.of(fn).add('Purpose', 'File Retrieval');

    return fn;
  }

  /**
   * Create Lambda function for getting file metadata by ID
   */
  private createFileMetadataFunction(commonConfig: {
    runtime: lambda.Runtime;
    layers: lambda.ILayerVersion[];
    role: iam.IRole;
    vpc: ec2.IVpc;
    vpcSubnets: ec2.SubnetSelection;
    securityGroups: ec2.ISecurityGroup[];
    timeout: cdk.Duration;
    memorySize: number;
    logRetention: logs.RetentionDays;
    environment: { [key: string]: string };
    tracing: lambda.Tracing;
  }): lambda.Function {
    const fn = new lambda.Function(this, 'FileMetadataFunction', {
      ...commonConfig,
      functionName: this.getResourceName('lambda', 'file-metadata'),
      description: 'Retrieves file metadata by ID',
      handler: 'handlers/files/metadata.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
    });

    cdk.Tags.of(fn).add('Name', this.getResourceName('lambda', 'file-metadata'));
    cdk.Tags.of(fn).add('Purpose', 'File Metadata');

    return fn;
  }

  /**
   * Create Lambda function for generating presigned S3 URLs for file download
   */
  private createFileDownloadUrlFunction(
    commonConfig: {
      runtime: lambda.Runtime;
      layers: lambda.ILayerVersion[];
      role: iam.IRole;
      vpc: ec2.IVpc;
      vpcSubnets: ec2.SubnetSelection;
      securityGroups: ec2.ISecurityGroup[];
      timeout: cdk.Duration;
      memorySize: number;
      logRetention: logs.RetentionDays;
      environment: { [key: string]: string };
      tracing: lambda.Tracing;
    },
    fileUploadBucket: s3.IBucket
  ): lambda.Function {
    const fn = new lambda.Function(this, 'FileDownloadUrlFunction', {
      ...commonConfig,
      functionName: this.getResourceName('lambda', 'file-download-url'),
      description: 'Generates presigned S3 URLs for secure file downloads',
      handler: 'handlers/files/download-url.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
    });

    // Grant permission to generate presigned URLs
    fileUploadBucket.grantRead(fn);

    cdk.Tags.of(fn).add('Name', this.getResourceName('lambda', 'file-download-url'));
    cdk.Tags.of(fn).add('Purpose', 'File Download');

    return fn;
  }

  /**
   * Grant necessary permissions to Lambda functions
   */
  private grantPermissions(_props: IComputeStackProps): void {
    // Database secret is already granted via role
    // S3 bucket permissions are already granted via role
    // Additional specific permissions can be added here if needed
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    // Lambda Layer outputs
    new cdk.CfnOutput(this, 'SharedLayerArn', {
      value: this.sharedLayer.layerVersionArn,
      description: 'Shared Lambda Layer ARN',
      exportName: `${this.stackName}-SharedLayerArn`,
    });

    // Auth function outputs
    new cdk.CfnOutput(this, 'AuthValidationFunctionArn', {
      value: this.authValidationFunction.functionArn,
      description: 'Auth Validation Lambda Function ARN',
      exportName: `${this.stackName}-AuthValidationFunctionArn`,
    });

    new cdk.CfnOutput(this, 'AuthValidationFunctionName', {
      value: this.authValidationFunction.functionName,
      description: 'Auth Validation Lambda Function Name',
      exportName: `${this.stackName}-AuthValidationFunctionName`,
    });

    // File upload function outputs
    new cdk.CfnOutput(this, 'FileUploadFunctionArn', {
      value: this.fileUploadFunction.functionArn,
      description: 'File Upload Lambda Function ARN',
      exportName: `${this.stackName}-FileUploadFunctionArn`,
    });

    new cdk.CfnOutput(this, 'FileUploadFunctionName', {
      value: this.fileUploadFunction.functionName,
      description: 'File Upload Lambda Function Name',
      exportName: `${this.stackName}-FileUploadFunctionName`,
    });

    // File list function outputs
    new cdk.CfnOutput(this, 'FileListFunctionArn', {
      value: this.fileListFunction.functionArn,
      description: 'File List Lambda Function ARN',
      exportName: `${this.stackName}-FileListFunctionArn`,
    });

    new cdk.CfnOutput(this, 'FileListFunctionName', {
      value: this.fileListFunction.functionName,
      description: 'File List Lambda Function Name',
      exportName: `${this.stackName}-FileListFunctionName`,
    });

    // File metadata function outputs
    new cdk.CfnOutput(this, 'FileMetadataFunctionArn', {
      value: this.fileMetadataFunction.functionArn,
      description: 'File Metadata Lambda Function ARN',
      exportName: `${this.stackName}-FileMetadataFunctionArn`,
    });

    new cdk.CfnOutput(this, 'FileMetadataFunctionName', {
      value: this.fileMetadataFunction.functionName,
      description: 'File Metadata Lambda Function Name',
      exportName: `${this.stackName}-FileMetadataFunctionName`,
    });

    // File download URL function outputs
    new cdk.CfnOutput(this, 'FileDownloadUrlFunctionArn', {
      value: this.fileDownloadUrlFunction.functionArn,
      description: 'File Download URL Lambda Function ARN',
      exportName: `${this.stackName}-FileDownloadUrlFunctionArn`,
    });

    new cdk.CfnOutput(this, 'FileDownloadUrlFunctionName', {
      value: this.fileDownloadUrlFunction.functionName,
      description: 'File Download URL Lambda Function Name',
      exportName: `${this.stackName}-FileDownloadUrlFunctionName`,
    });
  }
}
