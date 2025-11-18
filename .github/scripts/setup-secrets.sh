#!/bin/bash

# CI/CD Secrets Setup Script
# This script helps configure GitHub secrets for CI/CD pipelines

set -e

echo "=========================================="
echo "GitHub Secrets Setup for CI/CD"
echo "=========================================="
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

echo "This script will help you set up GitHub secrets for CI/CD."
echo "You will be prompted to enter values for each secret."
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_optional=$3
    
    echo "----------------------------------------"
    echo "Setting: $secret_name"
    echo "Description: $secret_description"
    
    if [ "$is_optional" = "true" ]; then
        echo "(Optional - press Enter to skip)"
    fi
    
    read -sp "Enter value: " secret_value
    echo ""
    
    if [ -z "$secret_value" ]; then
        if [ "$is_optional" = "true" ]; then
            echo "Skipped."
            return
        else
            echo "Error: This secret is required."
            exit 1
        fi
    fi
    
    gh secret set "$secret_name" --body "$secret_value"
    echo "✓ Secret set successfully"
}

echo "=========================================="
echo "Development Environment Secrets"
echo "=========================================="
echo ""

set_secret "AWS_ACCESS_KEY_ID_DEV" "AWS Access Key ID for Development" false
set_secret "AWS_SECRET_ACCESS_KEY_DEV" "AWS Secret Access Key for Development" false
set_secret "AWS_ACCOUNT_ID_DEV" "AWS Account ID for Development" false
set_secret "API_URL_DEV" "API Gateway URL for Development" false
set_secret "COGNITO_USER_POOL_ID_DEV" "Cognito User Pool ID for Development" false
set_secret "COGNITO_CLIENT_ID_DEV" "Cognito Client ID for Development" false
set_secret "COGNITO_DOMAIN_DEV" "Cognito Domain for Development" false
set_secret "WEB_BUCKET_NAME_DEV" "S3 Web Bucket Name for Development" false

echo ""
echo "=========================================="
echo "Staging Environment Secrets"
echo "=========================================="
echo ""

set_secret "AWS_ACCESS_KEY_ID_STAGING" "AWS Access Key ID for Staging" false
set_secret "AWS_SECRET_ACCESS_KEY_STAGING" "AWS Secret Access Key for Staging" false
set_secret "AWS_ACCOUNT_ID_STAGING" "AWS Account ID for Staging" false
set_secret "API_URL_STAGING" "API Gateway URL for Staging" false
set_secret "COGNITO_USER_POOL_ID_STAGING" "Cognito User Pool ID for Staging" false
set_secret "COGNITO_CLIENT_ID_STAGING" "Cognito Client ID for Staging" false
set_secret "COGNITO_DOMAIN_STAGING" "Cognito Domain for Staging" false
set_secret "WEB_BUCKET_NAME_STAGING" "S3 Web Bucket Name for Staging" false

echo ""
echo "=========================================="
echo "Production Environment Secrets"
echo "=========================================="
echo ""

set_secret "AWS_ACCESS_KEY_ID_PROD" "AWS Access Key ID for Production" false
set_secret "AWS_SECRET_ACCESS_KEY_PROD" "AWS Secret Access Key for Production" false
set_secret "AWS_ACCOUNT_ID_PROD" "AWS Account ID for Production" false
set_secret "API_URL_PROD" "API Gateway URL for Production" false
set_secret "COGNITO_USER_POOL_ID_PROD" "Cognito User Pool ID for Production" false
set_secret "COGNITO_CLIENT_ID_PROD" "Cognito Client ID for Production" false
set_secret "COGNITO_DOMAIN_PROD" "Cognito Domain for Production" false
set_secret "WEB_BUCKET_NAME_PROD" "S3 Web Bucket Name for Production" false

echo ""
echo "=========================================="
echo "Optional Secrets"
echo "=========================================="
echo ""

set_secret "SLACK_WEBHOOK" "Slack Webhook URL for notifications" true

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "All required secrets have been configured."
echo "You can now use the CI/CD pipelines."
echo ""
echo "Next steps:"
echo "1. Configure GitHub environments (development, staging, production)"
echo "2. Set up branch protection rules"
echo "3. Review and customize workflows in .github/workflows/"
echo ""
echo "For more information, see: .github/workflows/README.md"
