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
new SecurityStack(app, 'SecurityStack', {
  config,
  vpc: networkStack.vpc,
  publicSubnets: networkStack.publicSubnets,
  privateAppSubnets: networkStack.privateAppSubnets,
  privateDatabaseSubnets: networkStack.privateDatabaseSubnets,
});

// Additional stacks will be added in subsequent tasks

// Synthesize the app
app.synth();
