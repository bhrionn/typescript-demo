import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * WafStack properties extending base stack props
 */
export interface IWafStackProps extends IBaseStackProps {
  // CloudFront distribution ARN will be added later when associating
  readonly cloudFrontDistributionArn?: string;
}

/**
 * WafStack creates AWS WAF WebACL with comprehensive security rules
 *
 * Security Rules:
 * - AWS Managed Rules for Core Rule Set
 * - AWS Managed Rules for Known Bad Inputs
 * - Rate-based rule (2000 requests per 5 minutes per IP)
 * - SQL injection protection
 * - XSS protection
 *
 * The WebACL is designed to be associated with CloudFront distribution
 *
 * Requirements: 3.1, 8.4
 */
export class WafStack extends BaseStack {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: IWafStackProps) {
    super(scope, id, props);

    // Create WAF WebACL
    this.webAcl = this.createWebAcl();
    this.webAclArn = this.webAcl.attrArn;

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create WAF WebACL with comprehensive security rules
   */
  private createWebAcl(): wafv2.CfnWebACL {
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: this.getResourceName('waf', 'webacl'),
      scope: 'CLOUDFRONT', // Must be CLOUDFRONT for CloudFront association
      defaultAction: {
        allow: {}, // Allow by default, block based on rules
      },
      description: 'WAF WebACL for protecting CloudFront distribution',
      rules: [
        // Rule 1: AWS Managed Rules - Core Rule Set
        this.createManagedRuleGroup(
          'AWSManagedRulesCoreRuleSet',
          'AWS-AWSManagedRulesCommonRuleSet',
          0
        ),

        // Rule 2: AWS Managed Rules - Known Bad Inputs
        this.createManagedRuleGroup(
          'AWSManagedRulesKnownBadInputsRuleSet',
          'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          1
        ),

        // Rule 3: AWS Managed Rules - SQL Injection Protection
        this.createManagedRuleGroup(
          'AWSManagedRulesSQLiRuleSet',
          'AWS-AWSManagedRulesSQLiRuleSet',
          2
        ),

        // Rule 4: Rate-based rule (2000 requests per 5 minutes per IP)
        this.createRateBasedRule(),

        // Rule 5: Custom XSS Protection (additional to Core Rule Set)
        this.createXssProtectionRule(),
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: this.getResourceName('waf', 'webacl-metric'),
      },
      tags: [
        {
          key: 'Name',
          value: this.getResourceName('waf', 'webacl'),
        },
        {
          key: 'Environment',
          value: this.config.environment,
        },
        {
          key: 'ManagedBy',
          value: 'CDK',
        },
      ],
    });

    return webAcl;
  }

  /**
   * Create AWS Managed Rule Group
   */
  private createManagedRuleGroup(
    name: string,
    vendorName: string,
    priority: number
  ): wafv2.CfnWebACL.RuleProperty {
    return {
      name,
      priority,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: vendorName,
        },
      },
      overrideAction: {
        none: {}, // Use the rule group's actions
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: this.getResourceName('waf', `${name}-metric`),
      },
    };
  }

  /**
   * Create rate-based rule
   * Blocks IPs that exceed 2000 requests per 5 minutes
   */
  private createRateBasedRule(): wafv2.CfnWebACL.RuleProperty {
    return {
      name: 'RateLimitRule',
      priority: 3,
      statement: {
        rateBasedStatement: {
          limit: 2000, // 2000 requests per 5 minutes
          aggregateKeyType: 'IP',
        },
      },
      action: {
        block: {}, // Block requests exceeding the limit
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: this.getResourceName('waf', 'rate-limit-metric'),
      },
    };
  }

  /**
   * Create custom XSS protection rule
   * Inspects common XSS attack vectors in query strings and body
   */
  private createXssProtectionRule(): wafv2.CfnWebACL.RuleProperty {
    return {
      name: 'XssProtectionRule',
      priority: 4,
      statement: {
        orStatement: {
          statements: [
            // Check query string for XSS patterns
            {
              xssMatchStatement: {
                fieldToMatch: {
                  queryString: {},
                },
                textTransformations: [
                  {
                    priority: 0,
                    type: 'URL_DECODE',
                  },
                  {
                    priority: 1,
                    type: 'HTML_ENTITY_DECODE',
                  },
                ],
              },
            },
            // Check request body for XSS patterns
            {
              xssMatchStatement: {
                fieldToMatch: {
                  body: {
                    oversizeHandling: 'CONTINUE',
                  },
                },
                textTransformations: [
                  {
                    priority: 0,
                    type: 'URL_DECODE',
                  },
                  {
                    priority: 1,
                    type: 'HTML_ENTITY_DECODE',
                  },
                ],
              },
            },
            // Check URI path for XSS patterns
            {
              xssMatchStatement: {
                fieldToMatch: {
                  uriPath: {},
                },
                textTransformations: [
                  {
                    priority: 0,
                    type: 'URL_DECODE',
                  },
                  {
                    priority: 1,
                    type: 'HTML_ENTITY_DECODE',
                  },
                ],
              },
            },
          ],
        },
      },
      action: {
        block: {}, // Block requests with XSS patterns
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: this.getResourceName('waf', 'xss-protection-metric'),
      },
    };
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAclArn,
      description: 'WAF WebACL ARN for CloudFront association',
      exportName: `${this.stackName}-WebAclArn`,
    });

    new cdk.CfnOutput(this, 'WebAclId', {
      value: this.webAcl.attrId,
      description: 'WAF WebACL ID',
      exportName: `${this.stackName}-WebAclId`,
    });

    new cdk.CfnOutput(this, 'WebAclName', {
      value: this.webAcl.name!,
      description: 'WAF WebACL Name',
    });
  }
}
