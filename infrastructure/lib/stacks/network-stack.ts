import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * NetworkStack creates the VPC infrastructure with public and private subnets
 * across multiple availability zones.
 *
 * Architecture:
 * - VPC with CIDR 10.0.0.0/16
 * - Public subnets (10.0.1.0/24, 10.0.2.0/24) with Internet Gateway
 * - Private application subnets (10.0.10.0/24, 10.0.11.0/24)
 * - Private database subnets (10.0.20.0/24, 10.0.21.0/24)
 * - NAT Gateways in public subnets for private subnet internet access
 * - VPC Flow Logs to CloudWatch
 *
 * Requirements: 3.4, 8.1
 */
export class NetworkStack extends BaseStack {
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly privateAppSubnets: ec2.ISubnet[];
  public readonly privateDatabaseSubnets: ec2.ISubnet[];

  constructor(scope: Construct, id: string, props: IBaseStackProps) {
    super(scope, id, props);

    // Create VPC Flow Logs CloudWatch Log Group
    const flowLogsLogGroup = new logs.LogGroup(this, 'VpcFlowLogsLogGroup', {
      logGroupName: this.getResourceName('logs', 'vpc-flow-logs'),
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: this.getRemovalPolicy(),
    });

    // Create VPC with custom subnet configuration
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: this.getResourceName('vpc', 'main'),
      ipAddresses: ec2.IpAddresses.cidr(this.config.vpcCidr),
      maxAzs: 2,
      natGateways: 2, // One NAT Gateway per AZ for high availability
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: true,
        },
        {
          name: 'PrivateApp',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'PrivateDatabase',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // Enable VPC Flow Logs
    this.vpc.addFlowLog('VpcFlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogsLogGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Store subnet references for use by other stacks
    this.publicSubnets = this.vpc.publicSubnets;
    this.privateAppSubnets = this.vpc.privateSubnets;
    this.privateDatabaseSubnets = this.vpc.isolatedSubnets;

    // Add tags to subnets for identification
    this.tagSubnets();

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Tag subnets for easy identification and filtering
   */
  private tagSubnets(): void {
    // Tag public subnets
    this.publicSubnets.forEach((subnet, index) => {
      cdk.Tags.of(subnet).add('Name', this.getResourceName('subnet', `public-${index + 1}`));
      cdk.Tags.of(subnet).add('Tier', 'Public');
    });

    // Tag private application subnets
    this.privateAppSubnets.forEach((subnet, index) => {
      cdk.Tags.of(subnet).add('Name', this.getResourceName('subnet', `private-app-${index + 1}`));
      cdk.Tags.of(subnet).add('Tier', 'Application');
    });

    // Tag private database subnets
    this.privateDatabaseSubnets.forEach((subnet, index) => {
      cdk.Tags.of(subnet).add('Name', this.getResourceName('subnet', `private-db-${index + 1}`));
      cdk.Tags.of(subnet).add('Tier', 'Database');
    });
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
      exportName: `${this.stackName}-VpcCidr`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: this.publicSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Public Subnet IDs',
      exportName: `${this.stackName}-PublicSubnetIds`,
    });

    new cdk.CfnOutput(this, 'PrivateAppSubnetIds', {
      value: this.privateAppSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Private Application Subnet IDs',
      exportName: `${this.stackName}-PrivateAppSubnetIds`,
    });

    new cdk.CfnOutput(this, 'PrivateDatabaseSubnetIds', {
      value: this.privateDatabaseSubnets.map((subnet) => subnet.subnetId).join(','),
      description: 'Private Database Subnet IDs',
      exportName: `${this.stackName}-PrivateDatabaseSubnetIds`,
    });

    new cdk.CfnOutput(this, 'AvailabilityZones', {
      value: this.vpc.availabilityZones.join(','),
      description: 'Availability Zones',
      exportName: `${this.stackName}-AvailabilityZones`,
    });
  }
}
