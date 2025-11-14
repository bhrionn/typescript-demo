#!/bin/bash

# LocalStack initialization script for local development
# This script sets up S3 buckets, Secrets Manager, and Cognito resources

echo "Waiting for LocalStack to be ready..."
sleep 5

# Set AWS endpoint
export AWS_ENDPOINT=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

echo "Creating S3 buckets..."

# Create S3 bucket for web application
aws --endpoint-url=$AWS_ENDPOINT s3 mb s3://typescript-demo-dev-web-app

# Create S3 bucket for file uploads
aws --endpoint-url=$AWS_ENDPOINT s3 mb s3://typescript-demo-dev-file-uploads

# Enable encryption on file uploads bucket
aws --endpoint-url=$AWS_ENDPOINT s3api put-bucket-encryption \
  --bucket typescript-demo-dev-file-uploads \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access on file uploads bucket
aws --endpoint-url=$AWS_ENDPOINT s3api put-public-access-block \
  --bucket typescript-demo-dev-file-uploads \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "Creating Secrets Manager secrets..."

# Create database credentials secret
aws --endpoint-url=$AWS_ENDPOINT secretsmanager create-secret \
  --name typescript-demo-dev-db-credentials \
  --secret-string '{
    "username": "user",
    "password": "pass",
    "host": "postgres",
    "port": 5432,
    "database": "appdb"
  }' || echo "Secret already exists"

# Create JWT secret
aws --endpoint-url=$AWS_ENDPOINT secretsmanager create-secret \
  --name typescript-demo-dev-jwt-secret \
  --secret-string '{
    "secret": "local-dev-secret-key-change-in-production"
  }' || echo "Secret already exists"

echo "Creating Cognito User Pool..."

# Create Cognito User Pool
USER_POOL_ID=$(aws --endpoint-url=$AWS_ENDPOINT cognito-idp create-user-pool \
  --pool-name typescript-demo-dev-user-pool \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Required": true,
      "Mutable": true
    }
  ]' \
  --query 'UserPool.Id' \
  --output text 2>/dev/null || echo "us-east-1_localpool")

echo "User Pool ID: $USER_POOL_ID"

# Create User Pool Client
CLIENT_ID=$(aws --endpoint-url=$AWS_ENDPOINT cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name typescript-demo-dev-client \
  --generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:3000/callback" \
  --logout-urls "http://localhost:3000/logout" \
  --allowed-o-auth-flows code implicit \
  --allowed-o-auth-scopes openid email profile \
  --query 'UserPoolClient.ClientId' \
  --output text 2>/dev/null || echo "local-client-id")

echo "User Pool Client ID: $CLIENT_ID"

# Create test user
aws --endpoint-url=$AWS_ENDPOINT cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --message-action SUPPRESS 2>/dev/null || echo "Test user already exists"

# Set permanent password for test user
aws --endpoint-url=$AWS_ENDPOINT cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com \
  --password TestPass123! \
  --permanent 2>/dev/null || echo "Password already set"

echo "LocalStack initialization complete!"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"
echo "Test User: test@example.com / TestPass123!"
