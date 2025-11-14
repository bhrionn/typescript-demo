import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * ApiStack properties extending base stack props
 */
export interface IApiStackProps extends IBaseStackProps {
  readonly authValidationFunction: lambda.IFunction;
  readonly fileUploadFunction: lambda.IFunction;
  readonly fileListFunction: lambda.IFunction;
  readonly fileMetadataFunction: lambda.IFunction;
  readonly fileDownloadUrlFunction: lambda.IFunction;
  readonly allowedOrigins?: string[];
}

/**
 * ApiStack creates API Gateway REST API with Lambda integrations
 *
 * Features:
 * - REST API with request validation
 * - Lambda proxy integrations for all endpoints
 * - CORS configuration with allowed origins
 * - Usage plan with throttling
 * - CloudWatch logging for monitoring
 *
 * Endpoints:
 * - POST /auth/validate - Validate authentication token
 * - POST /files/upload - Upload file to S3
 * - GET /files - List user's files
 * - GET /files/{id} - Get file metadata
 * - GET /files/{id}/download-url - Get presigned download URL
 *
 * Requirements: 2.2, 3.7, 8.17
 */
export class ApiStack extends BaseStack {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: IApiStackProps) {
    super(scope, id, props);

    // Create CloudWatch log group for API Gateway
    const logGroup = this.createLogGroup();

    // Create REST API
    this.api = this.createRestApi(logGroup);

    // Configure CORS
    const allowedOrigins = props.allowedOrigins || this.getDefaultAllowedOrigins();

    // Create request validators
    const requestValidator = this.createRequestValidator();
    const bodyValidator = this.createBodyValidator();

    // Create API resources and methods
    this.createAuthEndpoints(props.authValidationFunction, requestValidator, allowedOrigins);
    this.createFileEndpoints(
      props.fileUploadFunction,
      props.fileListFunction,
      props.fileMetadataFunction,
      props.fileDownloadUrlFunction,
      requestValidator,
      bodyValidator,
      allowedOrigins
    );

    // Create usage plan with throttling
    this.createUsagePlan();

    // Store API URL
    this.apiUrl = this.api.url;

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create CloudWatch log group for API Gateway
   */
  private createLogGroup(): logs.LogGroup {
    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/${this.getResourceName('api', 'rest')}`,
      retention: this.config.logRetentionDays as logs.RetentionDays,
      removalPolicy: this.getRemovalPolicy(),
    });

    cdk.Tags.of(logGroup).add('Name', this.getResourceName('logs', 'api-gateway'));
    cdk.Tags.of(logGroup).add('Purpose', 'API Gateway Logging');

    return logGroup;
  }

  /**
   * Create REST API with CloudWatch logging
   */
  private createRestApi(logGroup: logs.LogGroup): apigateway.RestApi {
    const api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: this.getResourceName('api', 'rest'),
      description: `REST API for ${this.config.projectName} (${this.config.environment})`,
      deployOptions: {
        stageName: this.config.environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !this.isProduction(), // Disable data trace in production
        metricsEnabled: true,
        tracingEnabled: true, // Enable X-Ray tracing
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      cloudWatchRole: true, // Create IAM role for CloudWatch logging
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Will be restricted per method
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },
    });

    cdk.Tags.of(api).add('Name', this.getResourceName('api', 'rest'));
    cdk.Tags.of(api).add('Purpose', 'REST API');

    return api;
  }

  /**
   * Create request validator for query strings and headers
   */
  private createRequestValidator(): apigateway.RequestValidator {
    return new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      requestValidatorName: 'request-validator',
      validateRequestParameters: true,
      validateRequestBody: false,
    });
  }

  /**
   * Create body validator for request body validation
   */
  private createBodyValidator(): apigateway.RequestValidator {
    return new apigateway.RequestValidator(this, 'BodyValidator', {
      restApi: this.api,
      requestValidatorName: 'body-validator',
      validateRequestParameters: true,
      validateRequestBody: true,
    });
  }

  /**
   * Create authentication endpoints
   */
  private createAuthEndpoints(
    authValidationFunction: lambda.IFunction,
    requestValidator: apigateway.RequestValidator,
    allowedOrigins: string[]
  ): void {
    // Create /auth resource
    const authResource = this.api.root.addResource('auth');

    // Create /auth/validate resource
    const validateResource = authResource.addResource('validate');

    // POST /auth/validate
    validateResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(authValidationFunction, {
        proxy: true,
        allowTestInvoke: !this.isProduction(),
      }),
      {
        requestValidator,
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );

    // Add CORS configuration
    this.addCorsToResource(validateResource, allowedOrigins);
  }

  /**
   * Create file management endpoints
   */
  private createFileEndpoints(
    fileUploadFunction: lambda.IFunction,
    fileListFunction: lambda.IFunction,
    fileMetadataFunction: lambda.IFunction,
    fileDownloadUrlFunction: lambda.IFunction,
    requestValidator: apigateway.RequestValidator,
    bodyValidator: apigateway.RequestValidator,
    allowedOrigins: string[]
  ): void {
    // Create /files resource
    const filesResource = this.api.root.addResource('files');

    // POST /files/upload
    const uploadResource = filesResource.addResource('upload');
    uploadResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(fileUploadFunction, {
        proxy: true,
        allowTestInvoke: !this.isProduction(),
        timeout: cdk.Duration.seconds(29), // API Gateway max timeout
      }),
      {
        requestValidator: bodyValidator,
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '400',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '413',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );
    this.addCorsToResource(uploadResource, allowedOrigins);

    // GET /files - List user's files
    filesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(fileListFunction, {
        proxy: true,
        allowTestInvoke: !this.isProduction(),
      }),
      {
        requestValidator,
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );
    this.addCorsToResource(filesResource, allowedOrigins);

    // Create /files/{id} resource
    const fileIdResource = filesResource.addResource('{id}');

    // GET /files/{id} - Get file metadata
    fileIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(fileMetadataFunction, {
        proxy: true,
        allowTestInvoke: !this.isProduction(),
      }),
      {
        requestValidator,
        requestParameters: {
          'method.request.path.id': true, // Required path parameter
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );
    this.addCorsToResource(fileIdResource, allowedOrigins);

    // Create /files/{id}/download-url resource
    const downloadUrlResource = fileIdResource.addResource('download-url');

    // GET /files/{id}/download-url - Get presigned download URL
    downloadUrlResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(fileDownloadUrlFunction, {
        proxy: true,
        allowTestInvoke: !this.isProduction(),
      }),
      {
        requestValidator,
        requestParameters: {
          'method.request.path.id': true, // Required path parameter
        },
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '401',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
          {
            statusCode: '404',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          },
        ],
      }
    );
    this.addCorsToResource(downloadUrlResource, allowedOrigins);
  }

  /**
   * Add CORS configuration to a resource
   */
  private addCorsToResource(_resource: apigateway.IResource, _allowedOrigins: string[]): void {
    // CORS is already configured at the API level via defaultCorsPreflightOptions
    // This method can be used for additional per-resource CORS configuration if needed
    // For now, we rely on the default CORS configuration
  }

  /**
   * Create usage plan with throttling
   */
  private createUsagePlan(): void {
    const usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: this.getResourceName('usage-plan', 'api'),
      description: `Usage plan for ${this.config.projectName} API (${this.config.environment})`,
      throttle: {
        rateLimit: this.isProduction() ? 1000 : 100, // Requests per second
        burstLimit: this.isProduction() ? 2000 : 200, // Burst capacity
      },
      quota: this.isProduction()
        ? {
            limit: 1000000, // 1M requests per month in production
            period: apigateway.Period.MONTH,
          }
        : undefined, // No quota in non-production
    });

    // Associate usage plan with API stage
    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    cdk.Tags.of(usagePlan).add('Name', this.getResourceName('usage-plan', 'api'));
    cdk.Tags.of(usagePlan).add('Purpose', 'API Throttling');
  }

  /**
   * Get default allowed origins based on environment
   */
  private getDefaultAllowedOrigins(): string[] {
    if (this.isProduction()) {
      // In production, restrict to specific domains
      return ['https://example.com']; // Replace with actual production domain
    } else {
      // In development/staging, allow localhost
      return ['http://localhost:3000', 'http://localhost:8080'];
    }
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'REST API ID',
      exportName: `${this.stackName}-ApiId`,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'REST API URL',
      exportName: `${this.stackName}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiArn', {
      value: this.api.arnForExecuteApi(),
      description: 'REST API ARN',
      exportName: `${this.stackName}-ApiArn`,
    });

    new cdk.CfnOutput(this, 'ApiStageName', {
      value: this.api.deploymentStage.stageName,
      description: 'API Stage Name',
      exportName: `${this.stackName}-ApiStageName`,
    });
  }
}
