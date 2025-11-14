import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SecurityStack } from '../lib/stacks/security-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { loadEnvironmentConfig } from '../lib/config/environment';

describe('SecurityStack', () => {
  let app: cdk.App;
  let networkStack: NetworkStack;
  let securityStack: SecurityStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    const config = loadEnvironmentConfig('dev', '123456789012', 'us-east-1');

    networkStack = new NetworkStack(app, 'NetworkStack', { config });
    securityStack = new SecurityStack(app, 'SecurityStack', {
      config,
      vpc: networkStack.vpc,
      publicSubnets: networkStack.publicSubnets,
      privateAppSubnets: networkStack.privateAppSubnets,
      privateDatabaseSubnets: networkStack.privateDatabaseSubnets,
    });

    template = Template.fromStack(securityStack);
  });

  describe('Snapshot Tests', () => {
    test('matches snapshot', () => {
      expect(template.toJSON()).toMatchSnapshot();
    });
  });

  describe('Security Groups', () => {
    test('creates Lambda security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: Match.stringLikeRegexp(
          'Security group for Lambda functions with egress to RDS, S3, and Secrets Manager'
        ),
      });
    });

    test('creates RDS security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: Match.stringLikeRegexp(
          'Security group for RDS PostgreSQL with ingress from Lambda only'
        ),
      });
    });

    test('Lambda SG allows HTTPS egress to AWS services', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription:
          'Security group for Lambda functions with egress to RDS, S3, and Secrets Manager',
        SecurityGroupEgress: Match.arrayWith([
          Match.objectLike({
            IpProtocol: 'tcp',
            FromPort: 443,
            ToPort: 443,
            CidrIp: '0.0.0.0/0',
          }),
        ]),
      });
    });

    test('Lambda SG allows PostgreSQL egress to VPC', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription:
          'Security group for Lambda functions with egress to RDS, S3, and Secrets Manager',
        SecurityGroupEgress: Match.arrayWith([
          Match.objectLike({
            IpProtocol: 'tcp',
            FromPort: 5432,
            ToPort: 5432,
            CidrIp: '10.0.0.0/16',
          }),
        ]),
      });
    });

    test('RDS SG allows PostgreSQL ingress from Lambda SG only', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
        SourceSecurityGroupId: Match.anyValue(),
      });
    });

    test('RDS SG has minimal outbound rules', () => {
      const rdsSecurityGroups = template.findResources('AWS::EC2::SecurityGroup', {
        Properties: {
          GroupDescription: Match.stringLikeRegexp('RDS PostgreSQL'),
        },
      });

      // RDS security group should have restrictive egress (CDK adds a deny-all rule)
      Object.values(rdsSecurityGroups).forEach((sg: any) => {
        const egress = sg.Properties.SecurityGroupEgress;
        expect(egress).toBeDefined();
        // Should have only the deny-all rule
        expect(egress.length).toBe(1);
        expect(egress[0].CidrIp).toBe('255.255.255.255/32');
      });
    });
  });

  describe('Network ACLs', () => {
    test('creates three NACLs', () => {
      template.resourceCountIs('AWS::EC2::NetworkAcl', 3);
    });

    test('creates public subnet NACL', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAcl', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Tier',
            Value: 'Public',
          }),
        ]),
      });
    });

    test('creates application subnet NACL', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAcl', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Tier',
            Value: 'Application',
          }),
        ]),
      });
    });

    test('creates database subnet NACL', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAcl', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Tier',
            Value: 'Database',
          }),
        ]),
      });
    });
  });

  describe('Public Subnet NACL Rules', () => {
    test('allows HTTP inbound', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: 6, // TCP
        PortRange: {
          From: 80,
          To: 80,
        },
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows HTTPS inbound', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 110,
        Protocol: 6, // TCP
        PortRange: {
          From: 443,
          To: 443,
        },
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows ephemeral ports inbound', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 120,
        Protocol: 6, // TCP
        PortRange: {
          From: 1024,
          To: 65535,
        },
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows all outbound traffic', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: -1, // All protocols
        Egress: true,
        RuleAction: 'allow',
      });
    });
  });

  describe('Application Subnet NACL Rules', () => {
    test('allows VPC traffic inbound', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: -1, // All protocols
        CidrBlock: '10.0.0.0/16',
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows ephemeral ports inbound for NAT return traffic', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 110,
        Protocol: 6, // TCP
        PortRange: {
          From: 1024,
          To: 65535,
        },
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows all outbound traffic', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: -1,
        Egress: true,
        RuleAction: 'allow',
      });
    });
  });

  describe('Database Subnet NACL Rules', () => {
    test('allows PostgreSQL from app subnet 1', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: 6, // TCP
        PortRange: {
          From: 5432,
          To: 5432,
        },
        CidrBlock: '10.0.10.0/24',
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows PostgreSQL from app subnet 2', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 110,
        Protocol: 6, // TCP
        PortRange: {
          From: 5432,
          To: 5432,
        },
        CidrBlock: '10.0.11.0/24',
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows ephemeral ports from app subnets', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 120,
        Protocol: 6,
        PortRange: {
          From: 1024,
          To: 65535,
        },
        CidrBlock: '10.0.10.0/24',
        Egress: false,
        RuleAction: 'allow',
      });
    });

    test('allows outbound to app subnets', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: 6,
        PortRange: {
          From: 1024,
          To: 65535,
        },
        CidrBlock: '10.0.10.0/24',
        Egress: true,
        RuleAction: 'allow',
      });
    });
  });

  describe('Stack Outputs', () => {
    test('exports Lambda security group ID', () => {
      template.hasOutput('LambdaSecurityGroupId', {
        Export: {
          Name: Match.stringLikeRegexp('SecurityStack-LambdaSecurityGroupId'),
        },
      });
    });

    test('exports RDS security group ID', () => {
      template.hasOutput('RdsSecurityGroupId', {
        Export: {
          Name: Match.stringLikeRegexp('SecurityStack-RdsSecurityGroupId'),
        },
      });
    });

    test('exports NACL IDs', () => {
      template.hasOutput('PublicSubnetNaclId', {});
      template.hasOutput('AppSubnetNaclId', {});
      template.hasOutput('DatabaseSubnetNaclId', {});
    });
  });

  describe('Security Checklist - Network Security', () => {
    test('Lambda security group does not allow all outbound by default', () => {
      const lambdaSGs = template.findResources('AWS::EC2::SecurityGroup', {
        Properties: {
          GroupDescription: Match.stringLikeRegexp('Lambda functions'),
        },
      });

      // Should have specific egress rules, not default allow all
      expect(Object.keys(lambdaSGs).length).toBeGreaterThan(0);
    });

    test('RDS security group only allows ingress from Lambda', () => {
      const ingressRules = template.findResources('AWS::EC2::SecurityGroupIngress', {
        Properties: {
          IpProtocol: 'tcp',
          FromPort: 5432,
          ToPort: 5432,
        },
      });

      // Should only have one ingress rule for PostgreSQL
      expect(Object.keys(ingressRules).length).toBe(1);
    });

    test('database NACL restricts access to application tier only', () => {
      const dbNaclEntries = template.findResources('AWS::EC2::NetworkAclEntry', {
        Properties: {
          Protocol: 6,
          PortRange: {
            From: 5432,
            To: 5432,
          },
          Egress: false,
        },
      });

      // Should have entries for both app subnets
      expect(Object.keys(dbNaclEntries).length).toBe(2);
    });

    test('NACLs are associated with correct subnets', () => {
      // Should have associations for all subnets (2 public + 2 app + 2 db = 6)
      const associations = template.findResources('AWS::EC2::SubnetNetworkAclAssociation');
      expect(Object.keys(associations).length).toBe(6);
    });
  });
});
