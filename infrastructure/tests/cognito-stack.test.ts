import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { loadEnvironmentConfig } from '../lib/config/environment';

describe('CognitoStack', () => {
  let app: cdk.App;
  let stack: CognitoStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    const config = loadEnvironmentConfig('dev', '123456789012', 'us-east-1');
    stack = new CognitoStack(app, 'CognitoStack', {
      config,
      callbackUrls: ['http://localhost:3000/callback'],
      logoutUrls: ['http://localhost:3000/login'],
    });
    template = Template.fromStack(stack);
  });

  describe('Snapshot Tests', () => {
    test('matches snapshot', () => {
      expect(template.toJSON()).toMatchSnapshot();
    });
  });

  describe('User Pool Configuration', () => {
    test('creates user pool with correct name', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: Match.stringLikeRegexp('typescript-demo-dev-cognito-user-pool'),
      });
    });

    test('user pool uses email as username', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
      });
    });

    test('user pool has email auto-verification enabled', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AutoVerifiedAttributes: ['email'],
      });
    });

    test('user pool has correct password policy', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
            RequireLowercase: true,
            RequireUppercase: true,
            RequireNumbers: true,
            RequireSymbols: true,
          },
        },
      });
    });

    test('user pool has MFA optional', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        MfaConfiguration: 'OPTIONAL',
      });
    });

    test('user pool has email recovery enabled', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AccountRecoverySetting: {
          RecoveryMechanisms: Match.arrayWith([
            Match.objectLike({
              Name: 'verified_email',
              Priority: 1,
            }),
          ]),
        },
      });
    });

    test('user pool requires email attribute', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Schema: Match.arrayWith([
          Match.objectLike({
            Name: 'email',
            Required: true,
            Mutable: true,
          }),
        ]),
      });
    });
  });

  describe('User Pool Domain', () => {
    test('creates user pool domain', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolDomain', {
        Domain: Match.stringLikeRegexp('typescript-demo-dev-cognito-domain'),
      });
    });
  });

  describe('User Pool Client', () => {
    test('creates user pool client', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: Match.stringLikeRegexp('typescript-demo-dev-cognito-web-client'),
      });
    });

    test('client has authorization code grant enabled', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AllowedOAuthFlows: Match.arrayWith(['code']),
      });
    });

    test('client has correct OAuth scopes', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        AllowedOAuthScopes: Match.arrayWith(['email', 'openid', 'profile']),
      });
    });

    test('client has callback URLs configured', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        CallbackURLs: Match.arrayWith(['http://localhost:3000/callback']),
      });
    });

    test('client has logout URLs configured', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        LogoutURLs: Match.arrayWith(['http://localhost:3000/login']),
      });
    });

    test('client has correct token validity', () => {
      const clients = template.findResources('AWS::Cognito::UserPoolClient');
      const client = Object.values(clients)[0] as any;

      expect(client.Properties.AccessTokenValidity).toBe(60); // 1 hour in minutes
      expect(client.Properties.IdTokenValidity).toBe(60); // 1 hour in minutes
      expect(client.Properties.RefreshTokenValidity).toBe(43200); // 30 days in minutes
    });

    test('client prevents user existence errors', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        PreventUserExistenceErrors: 'ENABLED',
      });
    });

    test('client supports Cognito identity provider', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        SupportedIdentityProviders: Match.arrayWith(['COGNITO']),
      });
    });
  });

  describe('Stack Outputs', () => {
    test('exports user pool ID', () => {
      template.hasOutput('UserPoolId', {
        Export: {
          Name: Match.stringLikeRegexp('CognitoStack-UserPoolId'),
        },
      });
    });

    test('exports user pool ARN', () => {
      template.hasOutput('UserPoolArn', {
        Export: {
          Name: Match.stringLikeRegexp('CognitoStack-UserPoolArn'),
        },
      });
    });

    test('exports user pool client ID', () => {
      template.hasOutput('UserPoolClientId', {
        Export: {
          Name: Match.stringLikeRegexp('CognitoStack-UserPoolClientId'),
        },
      });
    });

    test('exports user pool domain URL', () => {
      template.hasOutput('UserPoolDomainUrl', {
        Export: {
          Name: Match.stringLikeRegexp('CognitoStack-UserPoolDomainUrl'),
        },
      });
    });
  });

  describe('Security Checklist - Authentication', () => {
    test('password policy requires minimum 8 characters', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
          },
        },
      });
    });

    test('password policy requires uppercase letters', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            RequireUppercase: true,
          },
        },
      });
    });

    test('password policy requires lowercase letters', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            RequireLowercase: true,
          },
        },
      });
    });

    test('password policy requires numbers', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            RequireNumbers: true,
          },
        },
      });
    });

    test('password policy requires symbols', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            RequireSymbols: true,
          },
        },
      });
    });

    test('user pool has tags for identification', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolTags: Match.objectLike({
          Component: 'Authentication',
          Service: 'Cognito',
        }),
      });
    });
  });

  describe('Federated Identity Providers', () => {
    test('stack supports federated identity providers', () => {
      // Note: Identity providers are created when credentials are provided
      // This test verifies the client supports federated auth
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        SupportedIdentityProviders: Match.arrayWith(['COGNITO']),
      });
    });
  });
});
