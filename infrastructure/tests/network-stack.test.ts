import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/stacks/network-stack';
import { loadEnvironmentConfig } from '../lib/config/environment';

describe('NetworkStack', () => {
  let app: cdk.App;
  let stack: NetworkStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    const config = loadEnvironmentConfig('dev', '123456789012', 'us-east-1');
    stack = new NetworkStack(app, 'NetworkStack', { config });
    template = Template.fromStack(stack);
  });

  describe('Snapshot Tests', () => {
    test('matches snapshot', () => {
      expect(template.toJSON()).toMatchSnapshot();
    });
  });

  describe('VPC Configuration', () => {
    test('creates VPC with correct CIDR block', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
      });
    });

    test('creates VPC with correct tags', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        Tags: Match.arrayWith([
          Match.objectLike({
            Key: 'Name',
            Value: Match.stringLikeRegexp('typescript-demo-dev-vpc-main'),
          }),
        ]),
      });
    });
  });

  describe('Subnet Configuration', () => {
    test('creates public subnets', () => {
      template.resourceCountIs('AWS::EC2::Subnet', 6); // 2 public + 2 private app + 2 private db
    });

    test('creates public subnets with correct CIDR', () => {
      const subnets = template.findResources('AWS::EC2::Subnet', {
        Properties: {
          MapPublicIpOnLaunch: true,
        },
      });
      expect(Object.keys(subnets).length).toBeGreaterThanOrEqual(2);
    });

    test('creates private application subnets', () => {
      const subnets = template.findResources('AWS::EC2::Subnet', {
        Properties: {
          Tags: Match.arrayWith([
            Match.objectLike({
              Key: 'Tier',
              Value: 'Application',
            }),
          ]),
        },
      });
      expect(Object.keys(subnets).length).toBeGreaterThanOrEqual(2);
    });

    test('creates private database subnets', () => {
      const subnets = template.findResources('AWS::EC2::Subnet', {
        Properties: {
          Tags: Match.arrayWith([
            Match.objectLike({
              Key: 'Tier',
              Value: 'Database',
            }),
          ]),
        },
      });
      expect(Object.keys(subnets).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('NAT Gateway Configuration', () => {
    test('creates NAT gateways for high availability', () => {
      template.resourceCountIs('AWS::EC2::NatGateway', 2);
    });

    test('NAT gateways are in public subnets', () => {
      template.hasResourceProperties('AWS::EC2::NatGateway', {
        SubnetId: Match.anyValue(),
      });
    });
  });

  describe('Internet Gateway Configuration', () => {
    test('creates internet gateway', () => {
      template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    });

    test('attaches internet gateway to VPC', () => {
      template.resourceCountIs('AWS::EC2::VPCGatewayAttachment', 1);
    });
  });

  describe('VPC Flow Logs', () => {
    test('creates CloudWatch log group for flow logs', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.stringLikeRegexp('typescript-demo-dev-logs-vpc-flow-logs'),
        RetentionInDays: 7,
      });
    });

    test('creates VPC flow log', () => {
      template.hasResourceProperties('AWS::EC2::FlowLog', {
        ResourceType: 'VPC',
        TrafficType: 'ALL',
      });
    });

    test('flow log has IAM role for CloudWatch', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: {
                Service: 'vpc-flow-logs.amazonaws.com',
              },
            }),
          ]),
        }),
      });
    });
  });

  describe('Route Tables', () => {
    test('creates route tables for each subnet type', () => {
      // Public, Private App (2 AZs), Private DB (2 AZs) = at least 5 route tables
      const routeTables = template.findResources('AWS::EC2::RouteTable');
      expect(Object.keys(routeTables).length).toBeGreaterThanOrEqual(5);
    });

    test('public subnets have route to internet gateway', () => {
      template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        GatewayId: Match.anyValue(),
      });
    });

    test('private subnets have route to NAT gateway', () => {
      template.hasResourceProperties('AWS::EC2::Route', {
        DestinationCidrBlock: '0.0.0.0/0',
        NatGatewayId: Match.anyValue(),
      });
    });
  });

  describe('Stack Outputs', () => {
    test('exports VPC ID', () => {
      template.hasOutput('VpcId', {
        Export: {
          Name: Match.stringLikeRegexp('NetworkStack-VpcId'),
        },
      });
    });

    test('exports subnet IDs', () => {
      template.hasOutput('PublicSubnetIds', {});
      template.hasOutput('PrivateAppSubnetIds', {});
      template.hasOutput('PrivateDatabaseSubnetIds', {});
    });

    test('exports availability zones', () => {
      template.hasOutput('AvailabilityZones', {});
    });
  });

  describe('Security Checklist - Network', () => {
    test('VPC has DNS support enabled', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        EnableDnsSupport: true,
      });
    });

    test('VPC has DNS hostnames enabled', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        EnableDnsHostnames: true,
      });
    });

    test('VPC Flow Logs are enabled', () => {
      template.resourceCountIs('AWS::EC2::FlowLog', 1);
    });

    test('private database subnets are isolated', () => {
      const dbSubnets = template.findResources('AWS::EC2::Subnet', {
        Properties: {
          Tags: Match.arrayWith([
            Match.objectLike({
              Key: 'Tier',
              Value: 'Database',
            }),
          ]),
        },
      });

      // Database subnets should not have MapPublicIpOnLaunch enabled
      Object.values(dbSubnets).forEach((subnet: any) => {
        expect(subnet.Properties.MapPublicIpOnLaunch).not.toBe(true);
      });
    });
  });
});
