#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  getEnvironment,
  getAccount,
  getRegion,
  loadEnvironmentConfig,
} from '../lib/config/environment';
import { NetworkStack } from '../lib/stacks/network-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { WafStack } from '../lib/stacks/waf-stack';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { StorageStack } from '../lib/stacks/storage-stack';

/**
 * CDK Application Entry Point
 *
 * This file initializes the CDK app and sets up the infrastructure stacks
 * based on the target environment (dev, staging, prod).
 *
 * Usage:
 *   cdk deploy --context environment=dev
 *   cdk deploy --context environment=staging
 *   cdk deploy --context environment=prod
 *
 * Or set environment variables:
 *   ENVIRONMENT=dev cdk deploy
 *   AWS_ACCOUNT=123456789012 AWS_REGION=us-east-1 cdk deploy
 */

// Initialize CDK app
const app = new cdk.App();

// Get environment configuration
const environment = getEnvironment(app);
const account = getAccount();
const region = getRegion();

// Load environment-specific configuration
const config = loadEnvironmentConfig(environment, account, region);

// eslint-disable-next-line no-console
console.log(`Initializing CDK app for environment: ${environment}`);
// eslint-disable-next-line no-console
console.log(`Account: ${account}, Region: ${region}`);
// eslint-disable-next-line no-console
console.log(`Project: ${config.projectName}`);

// Initialize stacks
// NetworkStack provides VPC and subnet infrastructure
const networkStack = new NetworkStack(app, 'NetworkStack', { config });

// SecurityStack provides NACLs and Security Groups
const securityStack = new SecurityStack(app, 'SecurityStack', {
  config,
  vpc: networkStack.vpc,
  publicSubnets: networkStack.publicSubnets,
  privateAppSubnets: networkStack.privateAppSubnets,
  privateDatabaseSubnets: networkStack.privateDatabaseSubnets,
});

// WafStack provides AWS WAF WebACL with security rules
// Note: WAF for CloudFront must be deployed in us-east-1 region
new WafStack(app, 'WafStack', {
  config: {
    ...config,
    region: 'us-east-1', // WAF for CloudFront must be in us-east-1
  },
  env: {
    account: config.account,
    region: 'us-east-1', // Override region for WAF stack
  },
});

// CognitoStack provides user authentication with federated identity providers
// Note: OAuth credentials should be provided via environment variables or context
new CognitoStack(app, 'CognitoStack', {
  config,
  callbackUrls: app.node.tryGetContext('callbackUrls'),
  logoutUrls: app.node.tryGetContext('logoutUrls'),
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID,
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET,
});

// StorageStack provides S3 buckets and RDS PostgreSQL database
new StorageStack(app, 'StorageStack', {
  config,
  vpc: networkStack.vpc,
  privateDatabaseSubnets: networkStack.privateDatabaseSubnets,
  rdsSecurityGroup: securityStack.rdsSecurityGroup,
});

// Additional stacks will be added in subsequent tasks

// Synthesize the app
app.synth();
