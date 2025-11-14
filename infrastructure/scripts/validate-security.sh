#!/bin/bash

# Security Validation Script
# This script runs cfn-nag to validate CloudFormation templates for security issues
# Requirements: 7.4, 8.1

set -e

echo "=== CDK Infrastructure Security Validation ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if cfn-nag is installed
if ! command -v cfn_nag_scan &> /dev/null; then
    echo -e "${YELLOW}Warning: cfn_nag is not installed${NC}"
    echo "To install cfn_nag, run:"
    echo "  gem install cfn-nag"
    echo ""
    echo "Skipping cfn-nag validation..."
    echo ""
else
    echo "Running cfn-nag security validation..."
    echo ""

    # Synthesize CDK templates
    echo "Synthesizing CDK templates..."
    npm run build
    npx cdk synth --quiet

    # Run cfn-nag on all templates
    TEMPLATES_DIR="cdk.out"
    FAILED=0

    for template in "$TEMPLATES_DIR"/*.template.json; do
        if [ -f "$template" ]; then
            template_name=$(basename "$template")
            echo "Validating $template_name..."
            
            if cfn_nag_scan --input-path "$template" --output-format txt; then
                echo -e "${GREEN}✓ $template_name passed security validation${NC}"
            else
                echo -e "${RED}✗ $template_name failed security validation${NC}"
                FAILED=1
            fi
            echo ""
        fi
    done

    if [ $FAILED -eq 1 ]; then
        echo -e "${RED}Security validation failed!${NC}"
        exit 1
    else
        echo -e "${GREEN}All templates passed security validation!${NC}"
    fi
fi

# Run Jest tests for security checklist
echo ""
echo "Running security checklist tests..."
npm test -- tests/security-checklist.test.ts

echo ""
echo -e "${GREEN}=== Security Validation Complete ===${NC}"
