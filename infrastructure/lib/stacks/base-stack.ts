import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IEnvironmentConfig } from '../config/environment';

/**
 * Base stack properties extending standard CDK stack props
 */
export interface IBaseStackProps extends cdk.StackProps {
  readonly config: IEnvironmentConfig;
}

/**
 * Base stack class with common properties and utilities
 * All application stacks should extend this class
 */
export abstract class BaseStack extends cdk.Stack {
  protected readonly config: IEnvironmentConfig;

  constructor(scope: Construct, id: string, props: IBaseStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
      stackName: `${props.config.projectName}-${props.config.environment}-${id}`,
      description:
        props.description || `${id} for ${props.config.projectName} (${props.config.environment})`,
      tags: props.config.tags,
    });

    this.config = props.config;
  }

  /**
   * Generate a resource name following naming convention
   * Format: {project}-{environment}-{resourceType}-{name}
   * @param resourceType - Type of resource (e.g., 'lambda', 's3', 'rds')
   * @param name - Specific name for the resource
   * @returns Formatted resource name
   */
  protected getResourceName(resourceType: string, name: string): string {
    return `${this.config.projectName}-${this.config.environment}-${resourceType}-${name}`;
  }

  /**
   * Get common tags for resources
   * @param additionalTags - Additional tags to merge with common tags
   * @returns Merged tags object
   */
  protected getResourceTags(additionalTags?: Record<string, string>): Record<string, string> {
    return {
      ...this.config.tags,
      ...additionalTags,
    };
  }

  /**
   * Check if current environment is production
   * @returns true if production environment
   */
  protected isProduction(): boolean {
    return this.config.environment === 'prod';
  }

  /**
   * Check if current environment is development
   * @returns true if development environment
   */
  protected isDevelopment(): boolean {
    return this.config.environment === 'dev';
  }

  /**
   * Apply removal policy based on environment
   * Production: RETAIN, Non-production: DESTROY
   * @returns Appropriate removal policy
   */
  protected getRemovalPolicy(): cdk.RemovalPolicy {
    return this.isProduction() ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
  }
}
