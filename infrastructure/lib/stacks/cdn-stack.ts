import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * CdnStack properties extending base stack props
 */
export interface ICdnStackProps extends IBaseStackProps {
  readonly webAppBucketName: string;
  readonly webAppBucketArn: string;
  readonly webAppBucketRegionalDomainName: string;
  readonly api: apigateway.RestApi;
  readonly webAclArn: string;
}

/**
 * CdnStack creates CloudFront distribution for global content delivery
 *
 * Features:
 * - CloudFront distribution with S3 web bucket as primary origin
 * - API Gateway as additional origin for /api/* path
 * - Cache behaviors for static assets (max TTL)
 * - Cache behaviors for API requests (no caching)
 * - HTTPS only with TLS 1.2 minimum
 * - WAF WebACL association for security
 *
 * Origins:
 * - S3 Origin: Serves static web application assets
 * - API Gateway Origin: Serves dynamic API requests
 *
 * Requirements: 3.7, 6.1, 6.2, 6.3, 6.4, 6.5, 8.5
 */
export class CdnStack extends BaseStack {
  public readonly distribution: cloudfront.Distribution;
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: ICdnStackProps) {
    super(scope, id, props);

    // Import S3 bucket from attributes to avoid cyclic dependency
    const webAppBucket = s3.Bucket.fromBucketAttributes(this, 'WebAppBucket', {
      bucketName: props.webAppBucketName,
      bucketArn: props.webAppBucketArn,
      bucketRegionalDomainName: props.webAppBucketRegionalDomainName,
    });

    // Create Origin Access Identity for S3 bucket access
    const originAccessIdentity = this.createOriginAccessIdentity();

    // Create CloudFront distribution
    // Note: The S3BucketOrigin will automatically grant CloudFront read access
    this.distribution = this.createDistribution(
      webAppBucket,
      props.api,
      originAccessIdentity,
      props.webAclArn
    );

    this.distributionDomainName = this.distribution.distributionDomainName;

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create Origin Access Identity for S3 bucket access
   * This allows CloudFront to access the private S3 bucket
   */
  private createOriginAccessIdentity(): cloudfront.OriginAccessIdentity {
    const oai = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: `OAI for ${this.getResourceName('cloudfront', 'web-app')}`,
    });

    cdk.Tags.of(oai).add('Name', this.getResourceName('oai', 'web-app'));
    cdk.Tags.of(oai).add('Purpose', 'CloudFront S3 Access');

    return oai;
  }

  /**
   * Create CloudFront distribution with multiple origins and cache behaviors
   */
  private createDistribution(
    webAppBucket: s3.IBucket,
    api: apigateway.RestApi,
    originAccessIdentity: cloudfront.OriginAccessIdentity,
    webAclArn: string
  ): cloudfront.Distribution {
    // Create S3 origin for web application
    const s3Origin = origins.S3BucketOrigin.withOriginAccessIdentity(webAppBucket, {
      originAccessIdentity,
      originPath: '', // Serve from root of bucket
    });

    // Create API Gateway origin
    // Extract the domain from the API URL (remove https:// and path)
    const apiDomainName = `${api.restApiId}.execute-api.${this.config.region}.amazonaws.com`;
    const apiOrigin = new origins.HttpOrigin(apiDomainName, {
      originPath: `/${api.deploymentStage.stageName}`,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      httpsPort: 443,
      originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
      customHeaders: {
        'X-Origin-Verify': this.generateOriginVerifyToken(),
      },
    });

    // Create cache policy for static assets (max caching)
    const staticAssetsCachePolicy = new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: this.getResourceName('cache-policy', 'static-assets'),
      comment: 'Cache policy for static assets with max TTL',
      defaultTtl: cdk.Duration.days(7),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Create cache policy for API requests (no caching)
    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: this.getResourceName('cache-policy', 'api'),
      comment: 'Cache policy for API requests with no caching',
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
      enableAcceptEncodingGzip: false,
      enableAcceptEncodingBrotli: false,
    });

    // Create origin request policy for API requests
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      'ApiOriginRequestPolicy',
      {
        originRequestPolicyName: this.getResourceName('origin-request-policy', 'api'),
        comment: 'Origin request policy for API requests',
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          'Content-Type',
          'Accept',
          'Origin',
          'Referer',
          'User-Agent'
        ),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
      }
    );

    // Create response headers policy for security headers
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'ResponseHeadersPolicy',
      {
        responseHeadersPolicyName: this.getResourceName('response-headers-policy', 'security'),
        comment: 'Security headers policy',
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'X-Content-Type-Options',
              value: 'nosniff',
              override: true,
            },
            {
              header: 'Permissions-Policy',
              value: 'geolocation=(), microphone=(), camera=()',
              override: true,
            },
          ],
        },
      }
    );

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `CloudFront distribution for ${this.config.projectName} (${this.config.environment})`,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: staticAssetsCachePolicy,
        responseHeadersPolicy,
        compress: true,
      },
      additionalBehaviors: {
        // API requests - no caching
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: apiOriginRequestPolicy,
          responseHeadersPolicy,
          compress: false, // Don't compress API responses
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      enableLogging: true,
      logBucket: this.createLogBucket(),
      logFilePrefix: 'cloudfront-logs/',
      logIncludesCookies: false,
      priceClass: this.isProduction()
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100,
      webAclId: webAclArn,
    });

    cdk.Tags.of(distribution).add('Name', this.getResourceName('cloudfront', 'distribution'));
    cdk.Tags.of(distribution).add('Purpose', 'Global Content Delivery');

    return distribution;
  }

  /**
   * Create S3 bucket for CloudFront access logs
   */
  private createLogBucket(): s3.Bucket {
    const logBucket = new s3.Bucket(this, 'CloudFrontLogBucket', {
      bucketName: this.getResourceName('s3', 'cloudfront-logs'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: this.getRemovalPolicy(),
      autoDeleteObjects: !this.isProduction(),
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(this.config.logRetentionDays),
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    cdk.Tags.of(logBucket).add('Name', this.getResourceName('s3', 'cloudfront-logs'));
    cdk.Tags.of(logBucket).add('Purpose', 'CloudFront Access Logs');

    return logBucket;
  }

  /**
   * Generate a random token for origin verification
   * This can be used to verify requests are coming from CloudFront
   */
  private generateOriginVerifyToken(): string {
    // In production, this should be a secure random value stored in Secrets Manager
    // For now, we'll use a simple token based on environment
    return `${this.config.projectName}-${this.config.environment}-origin-verify`;
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `${this.stackName}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `${this.stackName}-DistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${this.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: `https://${this.distributionDomainName}/api`,
      description: 'API URL via CloudFront',
    });
  }
}
