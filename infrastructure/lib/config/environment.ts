/**
 * Environment configuration types and loader
 */

import * as cdk from 'aws-cdk-lib';

export type Environment = 'dev' | 'staging' | 'prod';

export interface IEnvironmentConfig {
  readonly environment: Environment;
  readonly account: string;
  readonly region: string;
  readonly projectName: string;
  readonly vpcCidr: string;
  readonly enableMultiAz: boolean;
  readonly rdsBackupRetentionDays: number;
  readonly logRetentionDays: number;
  readonly tags: Record<string, string>;
}

/**
 * Environment-specific configurations
 */
const environmentConfigs: Record<Environment, Omit<IEnvironmentConfig, 'account' | 'region'>> = {
  dev: {
    environment: 'dev',
    projectName: 'typescript-demo',
    vpcCidr: '10.0.0.0/16',
    enableMultiAz: false,
    rdsBackupRetentionDays: 1,
    logRetentionDays: 7,
    tags: {
      Environment: 'dev',
      Project: 'typescript-demo',
      ManagedBy: 'CDK',
    },
  },
  staging: {
    environment: 'staging',
    projectName: 'typescript-demo',
    vpcCidr: '10.0.0.0/16',
    enableMultiAz: true,
    rdsBackupRetentionDays: 7,
    logRetentionDays: 30,
    tags: {
      Environment: 'staging',
      Project: 'typescript-demo',
      ManagedBy: 'CDK',
    },
  },
  prod: {
    environment: 'prod',
    projectName: 'typescript-demo',
    vpcCidr: '10.0.0.0/16',
    enableMultiAz: true,
    rdsBackupRetentionDays: 30,
    logRetentionDays: 90,
    tags: {
      Environment: 'prod',
      Project: 'typescript-demo',
      ManagedBy: 'CDK',
    },
  },
};

/**
 * Load environment configuration
 * @param environment - Target environment (dev, staging, prod)
 * @param account - AWS account ID
 * @param region - AWS region
 * @returns Complete environment configuration
 */
export function loadEnvironmentConfig(
  environment: Environment,
  account: string,
  region: string
): IEnvironmentConfig {
  const config = environmentConfigs[environment];

  if (!config) {
    throw new Error(`Invalid environment: ${environment}. Must be one of: dev, staging, prod`);
  }

  return {
    ...config,
    account,
    region,
  };
}

/**
 * Get environment from CDK context or environment variable
 * @param app - CDK App instance
 * @returns Environment name
 */
export function getEnvironment(app: cdk.App): Environment {
  const env = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';

  if (!['dev', 'staging', 'prod'].includes(env)) {
    throw new Error(`Invalid environment: ${env}. Must be one of: dev, staging, prod`);
  }

  return env as Environment;
}

/**
 * Get AWS account from environment variable
 * @returns AWS account ID
 */
export function getAccount(): string {
  const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT;

  if (!account) {
    throw new Error(
      'AWS account not specified. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT environment variable'
    );
  }

  return account;
}

/**
 * Get AWS region from environment variable
 * @returns AWS region
 */
export function getRegion(): string {
  const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';
  return region;
}
