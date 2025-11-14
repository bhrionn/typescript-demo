import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WafStack } from '../lib/stacks/waf-stack';
import { loadEnvironmentConfig } from '../lib/config/environment';

describe('WafStack', () => {
  let app: cdk.App;
  let stack: WafStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    const config = loadEnvironmentConfig('dev', '123456789012', 'us-east-1');
    stack = new WafStack(app, 'WafStack', { config });
    template = Template.fromStack(stack);
  });

  describe('Snapshot Tests', () => {
    test('matches snapshot', () => {
      expect(template.toJSON()).toMatchSnapshot();
    });
  });

  describe('WebACL Configuration', () => {
    test('creates WebACL with CloudFront scope', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Scope: 'CLOUDFRONT',
        DefaultAction: {
          Allow: {},
        },
      });
    });

    test('WebACL has correct name', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Name: Match.stringLikeRegexp('typescript-demo-dev-waf-webacl'),
      });
    });

    test('WebACL has visibility config enabled', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: Match.stringLikeRegexp('typescript-demo-dev-waf-webacl-metric'),
        },
      });
    });

    test('WebACL has correct tags', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Tags: Match.arrayWith([
          {
            Key: 'Name',
            Value: 'typescript-demo-dev-waf-webacl',
          },
        ]),
      });
    });
  });

  describe('AWS Managed Rules', () => {
    test('includes Core Rule Set', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesCoreRuleSet',
            Priority: 0,
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWS-AWSManagedRulesCommonRuleSet',
              },
            },
            OverrideAction: {
              None: {},
            },
          }),
        ]),
      });
    });

    test('includes Known Bad Inputs Rule Set', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesKnownBadInputsRuleSet',
            Priority: 1,
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
          }),
        ]),
      });
    });

    test('includes SQL Injection Rule Set', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesSQLiRuleSet',
            Priority: 2,
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWS-AWSManagedRulesSQLiRuleSet',
              },
            },
          }),
        ]),
      });
    });
  });

  describe('Rate-Based Rule', () => {
    test('creates rate-based rule with correct limit', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Priority: 3,
            Statement: {
              RateBasedStatement: {
                Limit: 2000,
                AggregateKeyType: 'IP',
              },
            },
            Action: {
              Block: {},
            },
          }),
        ]),
      });
    });

    test('rate-based rule has visibility config', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            VisibilityConfig: {
              SampledRequestsEnabled: true,
              CloudWatchMetricsEnabled: true,
              MetricName: Match.stringLikeRegexp('rate-limit-metric'),
            },
          }),
        ]),
      });
    });
  });

  describe('XSS Protection Rule', () => {
    test('creates XSS protection rule', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'XssProtectionRule',
            Priority: 4,
            Action: {
              Block: {},
            },
          }),
        ]),
      });
    });

    test('XSS rule checks query string', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'XssProtectionRule',
            Statement: {
              OrStatement: {
                Statements: Match.arrayWith([
                  Match.objectLike({
                    XssMatchStatement: {
                      FieldToMatch: {
                        QueryString: {},
                      },
                      TextTransformations: Match.arrayWith([
                        Match.objectLike({
                          Type: 'URL_DECODE',
                        }),
                        Match.objectLike({
                          Type: 'HTML_ENTITY_DECODE',
                        }),
                      ]),
                    },
                  }),
                ]),
              },
            },
          }),
        ]),
      });
    });

    test('XSS rule checks request body', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'XssProtectionRule',
            Statement: {
              OrStatement: {
                Statements: Match.arrayWith([
                  Match.objectLike({
                    XssMatchStatement: {
                      FieldToMatch: {
                        Body: {
                          OversizeHandling: 'CONTINUE',
                        },
                      },
                    },
                  }),
                ]),
              },
            },
          }),
        ]),
      });
    });

    test('XSS rule checks URI path', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'XssProtectionRule',
            Statement: {
              OrStatement: {
                Statements: Match.arrayWith([
                  Match.objectLike({
                    XssMatchStatement: {
                      FieldToMatch: {
                        UriPath: {},
                      },
                    },
                  }),
                ]),
              },
            },
          }),
        ]),
      });
    });
  });

  describe('Rule Priorities', () => {
    test('all rules have unique priorities', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      const priorities = rules.map((rule: any) => rule.Priority);
      const uniquePriorities = new Set(priorities);

      expect(priorities.length).toBe(uniquePriorities.size);
    });

    test('rules are in correct priority order', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      expect(rules[0].Priority).toBe(0); // Core Rule Set
      expect(rules[1].Priority).toBe(1); // Known Bad Inputs
      expect(rules[2].Priority).toBe(2); // SQL Injection
      expect(rules[3].Priority).toBe(3); // Rate Limit
      expect(rules[4].Priority).toBe(4); // XSS Protection
    });
  });

  describe('Stack Outputs', () => {
    test('exports WebACL ARN', () => {
      template.hasOutput('WebAclArn', {
        Export: {
          Name: Match.stringLikeRegexp('WafStack-WebAclArn'),
        },
      });
    });

    test('exports WebACL ID', () => {
      template.hasOutput('WebAclId', {
        Export: {
          Name: Match.stringLikeRegexp('WafStack-WebAclId'),
        },
      });
    });

    test('exports WebACL Name', () => {
      template.hasOutput('WebAclName', {});
    });
  });

  describe('Security Checklist - WAF', () => {
    test('WebACL has at least 5 security rules', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      expect(rules.length).toBeGreaterThanOrEqual(5);
    });

    test('WebACL includes SQL injection protection', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      const hasSQLiProtection = rules.some(
        (rule: any) =>
          rule.Name === 'AWSManagedRulesSQLiRuleSet' ||
          rule.Statement?.ManagedRuleGroupStatement?.Name === 'AWS-AWSManagedRulesSQLiRuleSet'
      );

      expect(hasSQLiProtection).toBe(true);
    });

    test('WebACL includes XSS protection', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      const hasXSSProtection = rules.some(
        (rule: any) => rule.Name === 'XssProtectionRule' || rule.Statement?.XssMatchStatement
      );

      expect(hasXSSProtection).toBe(true);
    });

    test('WebACL has rate limiting enabled', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      const hasRateLimit = rules.some(
        (rule: any) => rule.Statement?.RateBasedStatement && rule.Action?.Block
      );

      expect(hasRateLimit).toBe(true);
    });

    test('WebACL has CloudWatch metrics enabled', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          CloudWatchMetricsEnabled: true,
        },
      });
    });

    test('all rules have visibility config enabled', () => {
      const webAcl = template.findResources('AWS::WAFv2::WebACL');
      const webAclResource = Object.values(webAcl)[0] as any;
      const rules = webAclResource.Properties.Rules;

      rules.forEach((rule: any) => {
        expect(rule.VisibilityConfig).toBeDefined();
        expect(rule.VisibilityConfig.SampledRequestsEnabled).toBe(true);
        expect(rule.VisibilityConfig.CloudWatchMetricsEnabled).toBe(true);
      });
    });
  });
});
