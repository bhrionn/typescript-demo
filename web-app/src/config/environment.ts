/**
 * Environment Configuration
 * Centralizes all environment variable access with type safety
 */

interface EnvironmentConfig {
  apiUrl: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  cognitoDomain: string;
  awsRegion: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Validates that required environment variables are present
 * @throws Error if required variables are missing
 */
function validateEnvironment(): void {
  const required = [
    'REACT_APP_API_URL',
    'REACT_APP_COGNITO_USER_POOL_ID',
    'REACT_APP_COGNITO_CLIENT_ID',
    'REACT_APP_COGNITO_DOMAIN',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate environment on module load (only in production)
if (process.env.NODE_ENV === 'production') {
  validateEnvironment();
}

/**
 * Application environment configuration
 * All environment variables are accessed through this object
 */
export const environment: EnvironmentConfig = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  cognitoUserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || '',
  cognitoClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || '',
  cognitoDomain: process.env.REACT_APP_COGNITO_DOMAIN || '',
  awsRegion: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
