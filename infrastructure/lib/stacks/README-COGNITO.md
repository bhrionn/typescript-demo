# CognitoStack - Authentication Configuration

This stack creates AWS Cognito User Pool with federated identity provider support for Google and Microsoft authentication.

## Features

- **User Pool with Email Authentication**: Users can sign in using email addresses
- **Strong Password Policy**: Minimum 8 characters with uppercase, lowercase, numbers, and symbols
- **Federated Identity Providers**: Support for Google and Microsoft OAuth
- **OAuth 2.0 Flows**: Authorization code grant flow for secure authentication
- **MFA Support**: Optional multi-factor authentication with TOTP
- **Hosted UI**: Cognito-hosted authentication pages

## Configuration

### Environment Variables

The stack accepts OAuth credentials via environment variables:

```bash
# Google OAuth Configuration
export GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Microsoft OAuth Configuration
export MICROSOFT_CLIENT_ID="your-microsoft-client-id"
export MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
```

### Callback URLs

Callback URLs can be configured via CDK context or will use defaults based on environment:

**Development (default)**:

- `http://localhost:3000/callback`
- `http://localhost:3000`

**Production**:

- `https://{project}-{environment}.example.com/callback`

To override, use CDK context:

```bash
cdk deploy CognitoStack --context callbackUrls='["https://myapp.com/callback"]'
```

## Setting Up OAuth Providers

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Configure OAuth consent screen if not already done
6. Select **Web application** as application type
7. Add authorized redirect URIs:
   - Development: `https://typescript-demo-dev-cognito-domain.auth.{region}.amazoncognito.com/oauth2/idpresponse`
   - Production: `https://typescript-demo-prod-cognito-domain.auth.{region}.amazoncognito.com/oauth2/idpresponse`
8. Copy the **Client ID** and **Client Secret**
9. Set environment variables before deployment

### Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Enter application name and select supported account types
5. Add redirect URIs:
   - Development: `https://typescript-demo-dev-cognito-domain.auth.{region}.amazoncognito.com/oauth2/idpresponse`
   - Production: `https://typescript-demo-prod-cognito-domain.auth.{region}.amazoncognito.com/oauth2/idpresponse`
6. After registration, copy the **Application (client) ID**
7. Navigate to **Certificates & secrets** > **New client secret**
8. Copy the secret value immediately (it won't be shown again)
9. Set environment variables before deployment

## Deployment

### Deploy with OAuth Providers

```bash
# Set OAuth credentials
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export MICROSOFT_CLIENT_ID="your-microsoft-client-id"
export MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# Deploy
cd infrastructure
cdk deploy CognitoStack
```

### Deploy without OAuth Providers

The stack can be deployed without OAuth credentials. Users will only be able to authenticate with email/password:

```bash
cd infrastructure
cdk deploy CognitoStack
```

You can add OAuth providers later by:

1. Obtaining OAuth credentials
2. Setting environment variables
3. Redeploying the stack

## Stack Outputs

After deployment, the stack exports the following values:

- **UserPoolId**: Cognito User Pool ID (for API token validation)
- **UserPoolArn**: User Pool ARN (for IAM policies)
- **UserPoolClientId**: Client ID for web application
- **UserPoolDomainUrl**: Hosted UI domain URL

## Usage in Web Application

Configure your React application with the exported values:

```typescript
// web-app/src/config/auth.ts
export const authConfig = {
  userPoolId: 'us-east-1_XXXXXXXXX', // From stack output
  userPoolClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX', // From stack output
  domain: 'typescript-demo-dev-cognito-domain.auth.us-east-1.amazoncognito.com',
  redirectSignIn: 'http://localhost:3000/callback',
  redirectSignOut: 'http://localhost:3000/login',
  responseType: 'code',
  scopes: ['email', 'openid', 'profile'],
};
```

## Security Considerations

- **Client Secrets**: Never commit OAuth client secrets to version control
- **Callback URLs**: Ensure callback URLs match exactly (including trailing slashes)
- **HTTPS Only**: Production callback URLs must use HTTPS
- **Token Validity**: Access tokens expire after 1 hour, refresh tokens after 30 days
- **MFA**: Consider enabling MFA for production environments
- **User Existence Errors**: Prevented to avoid user enumeration attacks

## Password Policy

The User Pool enforces the following password requirements:

- Minimum length: 8 characters
- Must contain uppercase letters (A-Z)
- Must contain lowercase letters (a-z)
- Must contain numbers (0-9)
- Must contain symbols (!@#$%^&\*)
- Temporary passwords valid for 7 days

## Troubleshooting

### OAuth Provider Not Showing in Hosted UI

- Ensure OAuth credentials are set before deployment
- Verify the identity provider is created in AWS Console
- Check that the User Pool Client has the provider in `SupportedIdentityProviders`

### Invalid Redirect URI Error

- Verify callback URLs match exactly in both OAuth provider and Cognito
- Check for trailing slashes or protocol mismatches (http vs https)
- Ensure the Cognito domain is correctly configured

### Token Validation Failures

- Verify the User Pool ID and Client ID are correct
- Check that tokens haven't expired
- Ensure the token is from the correct User Pool

## Related Requirements

This stack implements the following requirements:

- **1.1**: Display authentication options for Google and Microsoft
- **1.2**: Redirect to Cognito for federated authentication
- **1.3**: Issue valid JWT tokens on successful authentication
- **8.11**: Cognito User Pool with federated identity providers
