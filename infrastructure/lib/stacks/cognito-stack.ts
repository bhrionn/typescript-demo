import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { BaseStack, IBaseStackProps } from './base-stack';

/**
 * CognitoStack properties
 */
export interface ICognitoStackProps extends IBaseStackProps {
  /**
   * Callback URLs for OAuth flows
   * Should include localhost for development and production URLs
   */
  readonly callbackUrls?: string[];

  /**
   * Logout URLs for OAuth flows
   */
  readonly logoutUrls?: string[];

  /**
   * Google OAuth client ID (optional, can be added later)
   */
  readonly googleClientId?: string;

  /**
   * Google OAuth client secret (optional, can be added later)
   */
  readonly googleClientSecret?: string;

  /**
   * Microsoft OAuth client ID (optional, can be added later)
   */
  readonly microsoftClientId?: string;

  /**
   * Microsoft OAuth client secret (optional, can be added later)
   */
  readonly microsoftClientSecret?: string;
}

/**
 * CognitoStack - AWS Cognito User Pool with federated identity providers
 *
 * This stack creates:
 * - Cognito User Pool with email as username
 * - Password policy (min 8 chars, uppercase, lowercase, numbers, symbols)
 * - Google identity provider (if credentials provided)
 * - Microsoft identity provider (if credentials provided)
 * - User Pool Client for web application
 * - OAuth flows and callback URLs
 *
 * Requirements: 1.1, 1.2, 1.3, 8.11
 */
export class CognitoStack extends BaseStack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: ICognitoStackProps) {
    super(scope, id, props);

    // Default callback URLs based on environment
    const defaultCallbackUrls = this.isDevelopment()
      ? ['http://localhost:3000/callback', 'http://localhost:3000']
      : [`https://${this.config.projectName}-${this.config.environment}.example.com/callback`];

    const defaultLogoutUrls = this.isDevelopment()
      ? ['http://localhost:3000', 'http://localhost:3000/login']
      : [`https://${this.config.projectName}-${this.config.environment}.example.com/login`];

    const callbackUrls = props.callbackUrls || defaultCallbackUrls;
    const logoutUrls = props.logoutUrls || defaultLogoutUrls;

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: this.getResourceName('cognito', 'user-pool'),
      // Email as username
      signInAliases: {
        email: true,
        username: false,
      },
      // Self sign-up disabled for federated auth only
      selfSignUpEnabled: true,
      // Email verification
      autoVerify: {
        email: true,
      },
      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      // Password policy: min 8 chars, uppercase, lowercase, numbers, symbols
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // MFA configuration (optional for federated users)
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      // Removal policy based on environment
      removalPolicy: this.getRemovalPolicy(),
    });

    // Add Google Identity Provider if credentials provided
    if (props.googleClientId && props.googleClientSecret) {
      const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
        userPool: this.userPool,
        clientId: props.googleClientId,
        clientSecretValue: cdk.SecretValue.unsafePlainText(props.googleClientSecret),
        scopes: ['profile', 'email', 'openid'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      });

      // Add dependency to ensure provider is created before client
      this.userPool.node.addDependency(googleProvider);
    }

    // Add Microsoft Identity Provider if credentials provided
    if (props.microsoftClientId && props.microsoftClientSecret) {
      const microsoftProvider = new cognito.UserPoolIdentityProviderOidc(
        this,
        'MicrosoftProvider',
        {
          userPool: this.userPool,
          name: 'Microsoft',
          clientId: props.microsoftClientId,
          clientSecret: props.microsoftClientSecret,
          issuerUrl: 'https://login.microsoftonline.com/common/v2.0',
          scopes: ['openid', 'profile', 'email'],
          attributeMapping: {
            email: cognito.ProviderAttribute.other('email'),
            givenName: cognito.ProviderAttribute.other('given_name'),
            familyName: cognito.ProviderAttribute.other('family_name'),
          },
        }
      );

      // Add dependency to ensure provider is created before client
      this.userPool.node.addDependency(microsoftProvider);
    }

    // Create User Pool Domain for hosted UI
    this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: this.getResourceName('cognito', 'domain').toLowerCase(),
      },
    });

    // Create User Pool Client for web application
    this.userPoolClient = this.userPool.addClient('WebAppClient', {
      userPoolClientName: this.getResourceName('cognito', 'web-client'),
      // OAuth configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false, // Not recommended for security
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls,
        logoutUrls,
      },
      // Supported identity providers
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        ...(props.googleClientId ? [cognito.UserPoolClientIdentityProvider.GOOGLE] : []),
        ...(props.microsoftClientId
          ? [cognito.UserPoolClientIdentityProvider.custom('Microsoft')]
          : []),
      ],
      // Token validity
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      // Prevent user existence errors
      preventUserExistenceErrors: true,
      // Read and write attributes
      readAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        emailVerified: true,
        givenName: true,
        familyName: true,
      }),
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        givenName: true,
        familyName: true,
      }),
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${this.stackName}-UserPoolArn`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: this.userPoolDomain.baseUrl(),
      description: 'Cognito User Pool Domain URL',
      exportName: `${this.stackName}-UserPoolDomainUrl`,
    });

    // Add tags
    cdk.Tags.of(this.userPool).add('Component', 'Authentication');
    cdk.Tags.of(this.userPool).add('Service', 'Cognito');
  }
}
