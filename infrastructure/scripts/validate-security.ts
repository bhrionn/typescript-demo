#!/usr/bin/env node

/**
 * Security Validation Script
 *
 * This script validates all security checklist items from the design document
 * by analyzing synthesized CloudFormation templates and AWS resources.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.6, 8.7, 8.8, 8.9, 8.12
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  category: string;
  item: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
}

interface CloudFormationTemplate {
  Resources: {
    [key: string]: {
      Type: string;
      Properties: any;
    };
  };
}

class SecurityValidator {
  private results: ValidationResult[] = [];
  private templates: Map<string, CloudFormationTemplate> = new Map();
  private cdkOutDir: string;

  constructor(cdkOutDir: string = 'cdk.out') {
    this.cdkOutDir = cdkOutDir;
  }

  /**
   * Load all CloudFormation templates from cdk.out directory
   */
  private loadTemplates(): void {
    if (!fs.existsSync(this.cdkOutDir)) {
      throw new Error(`CDK output directory not found: ${this.cdkOutDir}. Run 'cdk synth' first.`);
    }

    const files = fs.readdirSync(this.cdkOutDir);
    const templateFiles = files.filter((f) => f.endsWith('.template.json'));

    for (const file of templateFiles) {
      const filePath = path.join(this.cdkOutDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const template = JSON.parse(content) as CloudFormationTemplate;
      this.templates.set(file, template);
    }

    console.log(`Loaded ${this.templates.size} CloudFormation templates\n`);
  }

  /**
   * Find resources of a specific type across all templates
   */
  private findResources(
    resourceType: string
  ): Array<{ template: string; id: string; resource: any }> {
    const found: Array<{ template: string; id: string; resource: any }> = [];

    for (const [templateName, template] of this.templates) {
      if (!template.Resources) continue;

      for (const [resourceId, resource] of Object.entries(template.Resources)) {
        if (resource.Type === resourceType) {
          found.push({ template: templateName, id: resourceId, resource });
        }
      }
    }

    return found;
  }

  /**
   * Add validation result
   */
  private addResult(
    category: string,
    item: string,
    status: 'PASS' | 'FAIL' | 'WARNING',
    message: string
  ): void {
    this.results.push({ category, item, status, message });
  }

  /**
   * Validate S3 bucket policies prevent public access
   */
  private validateS3BucketSecurity(): void {
    const buckets = this.findResources('AWS::S3::Bucket');

    if (buckets.length === 0) {
      this.addResult('Storage', 'S3 Buckets', 'WARNING', 'No S3 buckets found in templates');
      return;
    }

    for (const { id, resource } of buckets) {
      const props = resource.Properties;

      // Check BlockPublicAccess
      if (props.PublicAccessBlockConfiguration) {
        const blockConfig = props.PublicAccessBlockConfiguration;
        if (
          blockConfig.BlockPublicAcls === true &&
          blockConfig.BlockPublicPolicy === true &&
          blockConfig.IgnorePublicAcls === true &&
          blockConfig.RestrictPublicBuckets === true
        ) {
          this.addResult(
            'Storage',
            `S3 Bucket ${id} - Public Access`,
            'PASS',
            'All public access blocked'
          );
        } else {
          this.addResult(
            'Storage',
            `S3 Bucket ${id} - Public Access`,
            'FAIL',
            'Public access not fully blocked'
          );
        }
      } else {
        this.addResult(
          'Storage',
          `S3 Bucket ${id} - Public Access`,
          'FAIL',
          'No PublicAccessBlockConfiguration found'
        );
      }

      // Check encryption
      if (props.BucketEncryption) {
        const rules = props.BucketEncryption.ServerSideEncryptionConfiguration;
        if (rules && rules.length > 0) {
          this.addResult(
            'Storage',
            `S3 Bucket ${id} - Encryption`,
            'PASS',
            'Encryption at rest enabled'
          );
        } else {
          this.addResult(
            'Storage',
            `S3 Bucket ${id} - Encryption`,
            'FAIL',
            'No encryption rules configured'
          );
        }
      } else {
        this.addResult(
          'Storage',
          `S3 Bucket ${id} - Encryption`,
          'FAIL',
          'Encryption not configured'
        );
      }

      // Check SSL enforcement
      const bucketPolicies = this.findResources('AWS::S3::BucketPolicy');
      const hasSslPolicy = bucketPolicies.some((bp) => {
        const statements = bp.resource.Properties?.PolicyDocument?.Statement || [];
        return statements.some(
          (stmt: any) =>
            stmt.Effect === 'Deny' && stmt.Condition?.Bool?.['aws:SecureTransport'] === 'false'
        );
      });

      if (hasSslPolicy) {
        this.addResult(
          'Storage',
          `S3 Bucket ${id} - SSL Enforcement`,
          'PASS',
          'SSL/TLS required for all requests'
        );
      } else {
        this.addResult(
          'Storage',
          `S3 Bucket ${id} - SSL Enforcement`,
          'WARNING',
          'No explicit SSL enforcement policy found'
        );
      }
    }
  }

  /**
   * Validate RDS is in private subnets only
   */
  private validateRDSSecurity(): void {
    const rdsInstances = this.findResources('AWS::RDS::DBInstance');

    if (rdsInstances.length === 0) {
      this.addResult('Database', 'RDS Instances', 'WARNING', 'No RDS instances found in templates');
      return;
    }

    for (const { id, resource } of rdsInstances) {
      const props = resource.Properties;

      // Check PubliclyAccessible
      if (props.PubliclyAccessible === false) {
        this.addResult('Database', `RDS ${id} - Public Access`, 'PASS', 'Not publicly accessible');
      } else if (props.PubliclyAccessible === true) {
        this.addResult(
          'Database',
          `RDS ${id} - Public Access`,
          'FAIL',
          'RDS instance is publicly accessible'
        );
      } else {
        this.addResult(
          'Database',
          `RDS ${id} - Public Access`,
          'WARNING',
          'PubliclyAccessible not explicitly set'
        );
      }

      // Check encryption at rest
      if (props.StorageEncrypted === true) {
        this.addResult(
          'Database',
          `RDS ${id} - Encryption at Rest`,
          'PASS',
          'Storage encryption enabled'
        );
      } else {
        this.addResult(
          'Database',
          `RDS ${id} - Encryption at Rest`,
          'FAIL',
          'Storage encryption not enabled'
        );
      }

      // Check automated backups
      if (props.BackupRetentionPeriod && props.BackupRetentionPeriod > 0) {
        this.addResult(
          'Database',
          `RDS ${id} - Automated Backups`,
          'PASS',
          `Backup retention: ${props.BackupRetentionPeriod} days`
        );
      } else {
        this.addResult(
          'Database',
          `RDS ${id} - Automated Backups`,
          'FAIL',
          'Automated backups not configured'
        );
      }

      // Check Multi-AZ (for production)
      if (props.MultiAZ === true) {
        this.addResult('Database', `RDS ${id} - Multi-AZ`, 'PASS', 'Multi-AZ deployment enabled');
      } else {
        this.addResult(
          'Database',
          `RDS ${id} - Multi-AZ`,
          'WARNING',
          'Multi-AZ not enabled (may be acceptable for dev/test)'
        );
      }

      // Check deletion protection (for production)
      if (props.DeletionProtection === true) {
        this.addResult(
          'Database',
          `RDS ${id} - Deletion Protection`,
          'PASS',
          'Deletion protection enabled'
        );
      } else {
        this.addResult(
          'Database',
          `RDS ${id} - Deletion Protection`,
          'WARNING',
          'Deletion protection not enabled (may be acceptable for dev/test)'
        );
      }
    }
  }

  /**
   * Validate Security Group rules follow least privilege
   */
  private validateSecurityGroups(): void {
    const securityGroups = this.findResources('AWS::EC2::SecurityGroup');

    if (securityGroups.length === 0) {
      this.addResult(
        'Network',
        'Security Groups',
        'WARNING',
        'No security groups found in templates'
      );
      return;
    }

    for (const { id, resource } of securityGroups) {
      const props = resource.Properties;
      const description = props.GroupDescription || '';

      // Check for overly permissive ingress rules
      const ingressRules = props.SecurityGroupIngress || [];
      const hasOpenIngress = ingressRules.some(
        (rule: any) => rule.CidrIp === '0.0.0.0/0' || rule.CidrIpv6 === '::/0'
      );

      if (hasOpenIngress) {
        this.addResult(
          'Network',
          `Security Group ${id} - Ingress Rules`,
          'WARNING',
          'Has rules allowing ingress from 0.0.0.0/0'
        );
      } else if (ingressRules.length > 0) {
        this.addResult(
          'Network',
          `Security Group ${id} - Ingress Rules`,
          'PASS',
          'Ingress rules are restricted'
        );
      } else {
        this.addResult(
          'Network',
          `Security Group ${id} - Ingress Rules`,
          'PASS',
          'No ingress rules (deny all)'
        );
      }

      // Check egress rules
      const egressRules = props.SecurityGroupEgress || [];
      if (egressRules.length > 0) {
        this.addResult(
          'Network',
          `Security Group ${id} - Egress Rules`,
          'PASS',
          `${egressRules.length} egress rule(s) defined`
        );
      } else {
        this.addResult(
          'Network',
          `Security Group ${id} - Egress Rules`,
          'WARNING',
          'No explicit egress rules'
        );
      }

      // Validate RDS security group specifically
      if (
        description.toLowerCase().includes('rds') ||
        description.toLowerCase().includes('database')
      ) {
        const hasPostgresIngress = ingressRules.some(
          (rule: any) => rule.IpProtocol === 'tcp' && rule.FromPort === 5432 && rule.ToPort === 5432
        );

        if (hasPostgresIngress) {
          this.addResult(
            'Network',
            `Security Group ${id} - RDS Access`,
            'PASS',
            'PostgreSQL port (5432) ingress configured'
          );
        } else {
          this.addResult(
            'Network',
            `Security Group ${id} - RDS Access`,
            'WARNING',
            'No PostgreSQL port ingress found'
          );
        }
      }
    }
  }

  /**
   * Validate IAM roles follow least privilege
   */
  private validateIAMRoles(): void {
    const roles = this.findResources('AWS::IAM::Role');

    if (roles.length === 0) {
      this.addResult('IAM', 'IAM Roles', 'WARNING', 'No IAM roles found in templates');
      return;
    }

    for (const { id, resource } of roles) {
      const props = resource.Properties;

      // Check for wildcard actions in inline policies
      const policies = props.Policies || [];
      let hasWildcardActions = false;
      let hasWildcardResources = false;

      for (const policy of policies) {
        const statements = policy.PolicyDocument?.Statement || [];
        for (const statement of statements) {
          if (statement.Effect === 'Allow') {
            const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
            const resources = Array.isArray(statement.Resource)
              ? statement.Resource
              : [statement.Resource];

            if (actions.some((a: string) => a === '*')) {
              hasWildcardActions = true;
            }
            if (resources.some((r: string) => r === '*')) {
              hasWildcardResources = true;
            }
          }
        }
      }

      if (hasWildcardActions && hasWildcardResources) {
        this.addResult(
          'IAM',
          `IAM Role ${id} - Least Privilege`,
          'FAIL',
          'Role has wildcard actions and resources (*)'
        );
      } else if (hasWildcardActions || hasWildcardResources) {
        this.addResult(
          'IAM',
          `IAM Role ${id} - Least Privilege`,
          'WARNING',
          'Role has some wildcard permissions'
        );
      } else {
        this.addResult(
          'IAM',
          `IAM Role ${id} - Least Privilege`,
          'PASS',
          'No wildcard actions or resources'
        );
      }

      // Check managed policies
      const managedPolicies = props.ManagedPolicyArns || [];
      if (managedPolicies.length > 0) {
        this.addResult(
          'IAM',
          `IAM Role ${id} - Managed Policies`,
          'PASS',
          `${managedPolicies.length} managed policy(ies) attached`
        );
      }
    }
  }

  /**
   * Validate VPC and subnet configuration
   */
  private validateVPCConfiguration(): void {
    const vpcs = this.findResources('AWS::EC2::VPC');
    const subnets = this.findResources('AWS::EC2::Subnet');

    if (vpcs.length === 0) {
      this.addResult('Network', 'VPC', 'WARNING', 'No VPC found in templates');
      return;
    }

    this.addResult('Network', 'VPC', 'PASS', `${vpcs.length} VPC(s) configured`);

    // Check for private subnets
    const privateSubnets = subnets.filter((s) => {
      const tags = s.resource.Properties.Tags || [];
      return tags.some(
        (t: any) =>
          (t.Key === 'Tier' && (t.Value === 'Application' || t.Value === 'Database')) ||
          (t.Key === 'aws-cdk:subnet-type' && t.Value === 'Private')
      );
    });

    if (privateSubnets.length >= 2) {
      this.addResult(
        'Network',
        'Private Subnets',
        'PASS',
        `${privateSubnets.length} private subnet(s) configured`
      );
    } else {
      this.addResult(
        'Network',
        'Private Subnets',
        'FAIL',
        'Insufficient private subnets (need at least 2 for HA)'
      );
    }

    // Check for NAT Gateways
    const natGateways = this.findResources('AWS::EC2::NatGateway');
    if (natGateways.length > 0) {
      this.addResult(
        'Network',
        'NAT Gateways',
        'PASS',
        `${natGateways.length} NAT Gateway(s) configured`
      );
    } else {
      this.addResult('Network', 'NAT Gateways', 'WARNING', 'No NAT Gateways found');
    }

    // Check for VPC Flow Logs
    const flowLogs = this.findResources('AWS::EC2::FlowLog');
    if (flowLogs.length > 0) {
      this.addResult('Network', 'VPC Flow Logs', 'PASS', 'VPC Flow Logs enabled');
    } else {
      this.addResult('Network', 'VPC Flow Logs', 'FAIL', 'VPC Flow Logs not enabled');
    }
  }

  /**
   * Validate NACLs are configured
   */
  private validateNACLs(): void {
    const nacls = this.findResources('AWS::EC2::NetworkAcl');
    const naclEntries = this.findResources('AWS::EC2::NetworkAclEntry');

    if (nacls.length === 0) {
      this.addResult('Network', 'NACLs', 'WARNING', 'No custom NACLs found (using default)');
      return;
    }

    this.addResult(
      'Network',
      'NACLs',
      'PASS',
      `${nacls.length} NACL(s) configured with ${naclEntries.length} rule(s)`
    );

    // Check for subnet associations
    const naclAssociations = this.findResources('AWS::EC2::SubnetNetworkAclAssociation');
    if (naclAssociations.length > 0) {
      this.addResult(
        'Network',
        'NACL Associations',
        'PASS',
        `${naclAssociations.length} subnet(s) associated with NACLs`
      );
    } else {
      this.addResult(
        'Network',
        'NACL Associations',
        'WARNING',
        'No explicit NACL associations found'
      );
    }
  }

  /**
   * Validate WAF configuration
   */
  private validateWAF(): void {
    const webAcls = this.findResources('AWS::WAFv2::WebACL');

    if (webAcls.length === 0) {
      this.addResult('Security', 'AWS WAF', 'FAIL', 'No WAF WebACL found');
      return;
    }

    for (const { id, resource } of webAcls) {
      const props = resource.Properties;
      const rules = props.Rules || [];

      this.addResult(
        'Security',
        `WAF ${id}`,
        'PASS',
        `WebACL configured with ${rules.length} rule(s)`
      );

      // Check for managed rule sets
      const hasCoreRuleSet = rules.some((r: any) =>
        r.Statement?.ManagedRuleGroupStatement?.Name?.includes('CommonRuleSet')
      );
      const hasSQLiProtection = rules.some((r: any) =>
        r.Statement?.ManagedRuleGroupStatement?.Name?.includes('SQLi')
      );
      const hasXSSProtection = rules.some((r: any) => r.Name?.toLowerCase().includes('xss'));
      const hasRateLimit = rules.some((r: any) => r.Statement?.RateBasedStatement);

      if (hasCoreRuleSet) {
        this.addResult(
          'Security',
          `WAF ${id} - Core Rule Set`,
          'PASS',
          'AWS Managed Core Rule Set enabled'
        );
      } else {
        this.addResult(
          'Security',
          `WAF ${id} - Core Rule Set`,
          'WARNING',
          'Core Rule Set not found'
        );
      }

      if (hasSQLiProtection) {
        this.addResult(
          'Security',
          `WAF ${id} - SQLi Protection`,
          'PASS',
          'SQL injection protection enabled'
        );
      } else {
        this.addResult(
          'Security',
          `WAF ${id} - SQLi Protection`,
          'WARNING',
          'SQL injection protection not found'
        );
      }

      if (hasXSSProtection) {
        this.addResult('Security', `WAF ${id} - XSS Protection`, 'PASS', 'XSS protection enabled');
      } else {
        this.addResult(
          'Security',
          `WAF ${id} - XSS Protection`,
          'WARNING',
          'XSS protection not found'
        );
      }

      if (hasRateLimit) {
        this.addResult('Security', `WAF ${id} - Rate Limiting`, 'PASS', 'Rate limiting configured');
      } else {
        this.addResult(
          'Security',
          `WAF ${id} - Rate Limiting`,
          'WARNING',
          'Rate limiting not found'
        );
      }

      // Check CloudWatch metrics
      if (props.VisibilityConfig?.CloudWatchMetricsEnabled === true) {
        this.addResult('Security', `WAF ${id} - Monitoring`, 'PASS', 'CloudWatch metrics enabled');
      } else {
        this.addResult(
          'Security',
          `WAF ${id} - Monitoring`,
          'FAIL',
          'CloudWatch metrics not enabled'
        );
      }
    }
  }

  /**
   * Validate Cognito configuration
   */
  private validateCognito(): void {
    const userPools = this.findResources('AWS::Cognito::UserPool');

    if (userPools.length === 0) {
      this.addResult(
        'Authentication',
        'Cognito User Pool',
        'WARNING',
        'No Cognito User Pool found'
      );
      return;
    }

    for (const { id, resource } of userPools) {
      const props = resource.Properties;

      this.addResult('Authentication', `Cognito ${id}`, 'PASS', 'User Pool configured');

      // Check password policy
      const passwordPolicy = props.Policies?.PasswordPolicy;
      if (passwordPolicy) {
        const hasStrongPolicy =
          passwordPolicy.MinimumLength >= 8 &&
          passwordPolicy.RequireLowercase === true &&
          passwordPolicy.RequireUppercase === true &&
          passwordPolicy.RequireNumbers === true &&
          passwordPolicy.RequireSymbols === true;

        if (hasStrongPolicy) {
          this.addResult(
            'Authentication',
            `Cognito ${id} - Password Policy`,
            'PASS',
            'Strong password policy configured'
          );
        } else {
          this.addResult(
            'Authentication',
            `Cognito ${id} - Password Policy`,
            'WARNING',
            'Password policy could be stronger'
          );
        }
      } else {
        this.addResult(
          'Authentication',
          `Cognito ${id} - Password Policy`,
          'FAIL',
          'No password policy configured'
        );
      }

      // Check MFA configuration
      if (props.MfaConfiguration) {
        this.addResult(
          'Authentication',
          `Cognito ${id} - MFA`,
          'PASS',
          `MFA: ${props.MfaConfiguration}`
        );
      } else {
        this.addResult('Authentication', `Cognito ${id} - MFA`, 'WARNING', 'MFA not configured');
      }
    }
  }

  /**
   * Validate Lambda functions are in VPC
   */
  private validateLambdaConfiguration(): void {
    const functions = this.findResources('AWS::Lambda::Function');

    if (functions.length === 0) {
      this.addResult('Compute', 'Lambda Functions', 'WARNING', 'No Lambda functions found');
      return;
    }

    for (const { id, resource } of functions) {
      const props = resource.Properties;

      // Check VPC configuration
      if (props.VpcConfig) {
        this.addResult('Compute', `Lambda ${id} - VPC`, 'PASS', 'Function deployed in VPC');
      } else {
        this.addResult(
          'Compute',
          `Lambda ${id} - VPC`,
          'WARNING',
          'Function not in VPC (may be acceptable for some use cases)'
        );
      }

      // Check tracing
      if (props.TracingConfig?.Mode === 'Active') {
        this.addResult('Compute', `Lambda ${id} - Tracing`, 'PASS', 'X-Ray tracing enabled');
      } else {
        this.addResult('Compute', `Lambda ${id} - Tracing`, 'WARNING', 'X-Ray tracing not enabled');
      }

      // Check environment variables don't contain secrets
      if (props.Environment?.Variables) {
        const vars = props.Environment.Variables;
        const suspiciousKeys = Object.keys(vars).filter(
          (k) =>
            k.toLowerCase().includes('password') ||
            k.toLowerCase().includes('secret') ||
            k.toLowerCase().includes('key')
        );

        if (suspiciousKeys.length > 0) {
          this.addResult(
            'Compute',
            `Lambda ${id} - Secrets`,
            'WARNING',
            `Potential secrets in environment: ${suspiciousKeys.join(', ')}`
          );
        } else {
          this.addResult(
            'Compute',
            `Lambda ${id} - Secrets`,
            'PASS',
            'No obvious secrets in environment variables'
          );
        }
      }
    }
  }

  /**
   * Run all validations
   */
  public async validate(): Promise<void> {
    console.log('=== Security Validation Script ===\n');
    console.log('Loading CloudFormation templates...');

    this.loadTemplates();

    console.log('Running security validations...\n');

    // Run all validation checks
    this.validateVPCConfiguration();
    this.validateNACLs();
    this.validateSecurityGroups();
    this.validateS3BucketSecurity();
    this.validateRDSSecurity();
    this.validateIAMRoles();
    this.validateWAF();
    this.validateCognito();
    this.validateLambdaConfiguration();

    // Print results
    this.printResults();
  }

  /**
   * Print validation results
   */
  private printResults(): void {
    console.log('\n=== Security Validation Results ===\n');

    // Group results by category
    const categories = new Map<string, ValidationResult[]>();
    for (const result of this.results) {
      if (!categories.has(result.category)) {
        categories.set(result.category, []);
      }
      categories.get(result.category)!.push(result);
    }

    // Print by category
    for (const [category, results] of categories) {
      console.log(`\n${category}:`);
      for (const result of results) {
        const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
        const color =
          result.status === 'PASS'
            ? '\x1b[32m'
            : result.status === 'FAIL'
              ? '\x1b[31m'
              : '\x1b[33m';
        const reset = '\x1b[0m';
        console.log(`  ${color}${icon}${reset} ${result.item}: ${result.message}`);
      }
    }

    // Print summary
    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const warnings = this.results.filter((r) => r.status === 'WARNING').length;
    const total = this.results.length;

    console.log('\n=== Summary ===');
    console.log(`Total Checks: ${total}`);
    console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
    console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
    console.log(`\x1b[33mWarnings: ${warnings}\x1b[0m`);

    if (failed > 0) {
      console.log('\n\x1b[31m❌ Security validation failed!\x1b[0m');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n\x1b[33m⚠️  Security validation passed with warnings\x1b[0m');
    } else {
      console.log('\n\x1b[32m✅ All security checks passed!\x1b[0m');
    }
  }
}

// Main execution
if (require.main === module) {
  const validator = new SecurityValidator();
  validator.validate().catch((error) => {
    console.error('\x1b[31mError running security validation:\x1b[0m', error.message);
    process.exit(1);
  });
}

export { SecurityValidator, ValidationResult };
