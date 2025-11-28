import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * SecurityStack properties extending base stack props
 */
export interface ISecurityStackProps extends IBaseStackProps {
  readonly vpc: ec2.IVpc;
  readonly publicSubnets: ec2.ISubnet[];
  readonly privateAppSubnets: ec2.ISubnet[];
  readonly privateDatabaseSubnets: ec2.ISubnet[];
}

/**
 * SecurityStack creates Network ACLs and Security Groups for the application
 *
 * Network Architecture:
 * - Public subnets: Allow HTTP/HTTPS inbound, all outbound
 * - Application subnets: Allow from public, deny direct internet
 * - Database subnets: Allow from application tier only
 *
 * Security Groups:
 * - Lambda SG: Egress to RDS, S3, Secrets Manager
 * - RDS SG: Ingress from Lambda SG on port 5432 only
 *
 * Requirements: 3.2, 3.3, 3.4, 8.2, 8.3
 */
export class SecurityStack extends BaseStack {
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly rdsSecurityGroup: ec2.SecurityGroup;
  public readonly publicSubnetNacl: ec2.NetworkAcl;
  public readonly appSubnetNacl: ec2.NetworkAcl;
  public readonly databaseSubnetNacl: ec2.NetworkAcl;
  private readonly privateAppSubnets: ec2.ISubnet[];

  constructor(scope: Construct, id: string, props: ISecurityStackProps) {
    super(scope, id, props);

    // Store subnet references for use in NACL rules
    this.privateAppSubnets = props.privateAppSubnets;

    // Create Network ACLs
    this.publicSubnetNacl = this.createPublicSubnetNacl(props.vpc, props.publicSubnets);
    this.appSubnetNacl = this.createAppSubnetNacl(props.vpc, props.privateAppSubnets);
    this.databaseSubnetNacl = this.createDatabaseSubnetNacl(
      props.vpc,
      props.privateDatabaseSubnets
    );

    // Create Security Groups
    this.lambdaSecurityGroup = this.createLambdaSecurityGroup(props.vpc);
    this.rdsSecurityGroup = this.createRdsSecurityGroup(props.vpc);

    // Create stack outputs
    this.createOutputs();
  }

  /**
   * Create NACL for public subnets
   * Allow HTTP/HTTPS inbound, all outbound
   */
  private createPublicSubnetNacl(vpc: ec2.IVpc, subnets: ec2.ISubnet[]): ec2.NetworkAcl {
    const nacl = new ec2.NetworkAcl(this, 'PublicSubnetNacl', {
      vpc,
      networkAclName: this.getResourceName('nacl', 'public'),
    });

    // Associate NACL with public subnets
    subnets.forEach((subnet, index) => {
      new ec2.SubnetNetworkAclAssociation(this, `PublicNaclAssoc${index}`, {
        subnet,
        networkAcl: nacl,
      });
    });

    // Inbound rules
    // Allow HTTP
    nacl.addEntry('AllowHttpInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.tcpPort(80),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    // Allow HTTPS
    nacl.addEntry('AllowHttpsInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 110,
      traffic: ec2.AclTraffic.tcpPort(443),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    // Allow ephemeral ports for return traffic
    nacl.addEntry('AllowEphemeralInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 120,
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    // Outbound rules
    // Allow all outbound traffic
    nacl.addEntry('AllowAllOutbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.allTraffic(),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    cdk.Tags.of(nacl).add('Name', this.getResourceName('nacl', 'public'));
    cdk.Tags.of(nacl).add('Tier', 'Public');

    return nacl;
  }

  /**
   * Create NACL for application subnets
   * Allow from public subnets, deny direct internet access
   */
  private createAppSubnetNacl(vpc: ec2.IVpc, subnets: ec2.ISubnet[]): ec2.NetworkAcl {
    const nacl = new ec2.NetworkAcl(this, 'AppSubnetNacl', {
      vpc,
      networkAclName: this.getResourceName('nacl', 'app'),
    });

    // Associate NACL with application subnets
    subnets.forEach((subnet, index) => {
      new ec2.SubnetNetworkAclAssociation(this, `AppNaclAssoc${index}`, {
        subnet,
        networkAcl: nacl,
      });
    });

    // Inbound rules
    // Allow traffic from VPC CIDR (includes public subnets)
    nacl.addEntry('AllowVpcInbound', {
      cidr: ec2.AclCidr.ipv4(this.config.vpcCidr),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.allTraffic(),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    // Allow ephemeral ports for return traffic from internet (via NAT)
    nacl.addEntry('AllowEphemeralInbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 110,
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    // Outbound rules
    // Allow all outbound traffic (will go through NAT Gateway)
    nacl.addEntry('AllowAllOutbound', {
      cidr: ec2.AclCidr.anyIpv4(),
      ruleNumber: 100,
      traffic: ec2.AclTraffic.allTraffic(),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.ALLOW,
    });

    cdk.Tags.of(nacl).add('Name', this.getResourceName('nacl', 'app'));
    cdk.Tags.of(nacl).add('Tier', 'Application');

    return nacl;
  }

  /**
   * Create NACL for database subnets
   * Allow from application tier only
   */
  private createDatabaseSubnetNacl(vpc: ec2.IVpc, subnets: ec2.ISubnet[]): ec2.NetworkAcl {
    const nacl = new ec2.NetworkAcl(this, 'DatabaseSubnetNacl', {
      vpc,
      networkAclName: this.getResourceName('nacl', 'database'),
    });

    // Associate NACL with database subnets
    subnets.forEach((subnet, index) => {
      new ec2.SubnetNetworkAclAssociation(this, `DbNaclAssoc${index}`, {
        subnet,
        networkAcl: nacl,
      });
    });

    // Inbound rules
    // Allow PostgreSQL from application subnets dynamically
    this.privateAppSubnets.forEach((appSubnet, index) => {
      // Get the CIDR block from the subnet
      const subnetCidr = appSubnet.ipv4CidrBlock;

      // Allow PostgreSQL ingress from this app subnet
      nacl.addEntry(`AllowPostgresFromApp${index + 1}`, {
        cidr: ec2.AclCidr.ipv4(subnetCidr),
        ruleNumber: 100 + index * 10,
        traffic: ec2.AclTraffic.tcpPort(5432),
        direction: ec2.TrafficDirection.INGRESS,
        ruleAction: ec2.Action.ALLOW,
      });

      // Allow ephemeral ports for return traffic to this app subnet
      nacl.addEntry(`AllowEphemeralToApp${index + 1}`, {
        cidr: ec2.AclCidr.ipv4(subnetCidr),
        ruleNumber: 120 + index * 10,
        traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
        direction: ec2.TrafficDirection.INGRESS,
        ruleAction: ec2.Action.ALLOW,
      });
    });

    // Outbound rules
    // Allow PostgreSQL responses to application subnets dynamically
    this.privateAppSubnets.forEach((appSubnet, index) => {
      const subnetCidr = appSubnet.ipv4CidrBlock;

      nacl.addEntry(`AllowPostgresToApp${index + 1}`, {
        cidr: ec2.AclCidr.ipv4(subnetCidr),
        ruleNumber: 100 + index * 10,
        traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
        direction: ec2.TrafficDirection.EGRESS,
        ruleAction: ec2.Action.ALLOW,
      });
    });

    cdk.Tags.of(nacl).add('Name', this.getResourceName('nacl', 'database'));
    cdk.Tags.of(nacl).add('Tier', 'Database');

    return nacl;
  }

  /**
   * Create Security Group for Lambda functions
   * Egress to RDS, S3, Secrets Manager
   */
  private createLambdaSecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      securityGroupName: this.getResourceName('sg', 'lambda'),
      description:
        'Security group for Lambda functions with egress to RDS, S3, and Secrets Manager',
      allowAllOutbound: false, // We'll add specific egress rules
    });

    // Allow HTTPS egress to VPC endpoints for AWS services (S3, Secrets Manager)
    // This restricts egress to VPC CIDR only, preventing unrestricted internet access
    sg.addEgressRule(
      ec2.Peer.ipv4(this.config.vpcCidr),
      ec2.Port.tcp(443),
      'Allow HTTPS egress to VPC endpoints for AWS services (S3, Secrets Manager)'
    );

    // Allow PostgreSQL egress to RDS
    sg.addEgressRule(
      ec2.Peer.ipv4(this.config.vpcCidr),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL egress to RDS'
    );

    cdk.Tags.of(sg).add('Name', this.getResourceName('sg', 'lambda'));
    cdk.Tags.of(sg).add('Purpose', 'Lambda Functions');

    return sg;
  }

  /**
   * Create Security Group for RDS
   * Ingress from Lambda SG on port 5432 only
   */
  private createRdsSecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      securityGroupName: this.getResourceName('sg', 'rds'),
      description: 'Security group for RDS PostgreSQL with ingress from Lambda only',
      allowAllOutbound: false, // RDS doesn't need outbound access
    });

    // Allow PostgreSQL ingress from Lambda Security Group only
    sg.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from Lambda functions'
    );

    cdk.Tags.of(sg).add('Name', this.getResourceName('sg', 'rds'));
    cdk.Tags.of(sg).add('Purpose', 'RDS PostgreSQL');

    return sg;
  }

  /**
   * Create CloudFormation outputs for cross-stack references
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
      exportName: `${this.stackName}-LambdaSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.rdsSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: `${this.stackName}-RdsSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetNaclId', {
      value: this.publicSubnetNacl.networkAclId,
      description: 'Public Subnet NACL ID',
      exportName: `${this.stackName}-PublicSubnetNaclId`,
    });

    new cdk.CfnOutput(this, 'AppSubnetNaclId', {
      value: this.appSubnetNacl.networkAclId,
      description: 'Application Subnet NACL ID',
      exportName: `${this.stackName}-AppSubnetNaclId`,
    });

    new cdk.CfnOutput(this, 'DatabaseSubnetNaclId', {
      value: this.databaseSubnetNacl.networkAclId,
      description: 'Database Subnet NACL ID',
      exportName: `${this.stackName}-DatabaseSubnetNaclId`,
    });
  }
}
