#!/bin/bash

# Security Validation Script
# This script validates all security checklist items from the design document
# Requirements: 7.4, 8.1, 8.2, 8.3, 8.6, 8.7, 8.8, 8.9, 8.12

set -e

echo "=== CDK Infrastructure Security Validation ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build and synthesize CDK templates
echo "Building CDK infrastructure..."
npm run build

echo ""
echo "Synthesizing CloudFormation templates..."
npx cdk synth --quiet

# Step 2: Run TypeScript security validator
echo ""
echo "Running comprehensive security validation..."
npx ts-node scripts/validate-security.ts

# Step 3: Run Jest tests for security checklist
echo ""
echo "Running security checklist tests..."
npm test -- tests/security-checklist.test.ts --passWithNoTests

# Step 4: Optional - Run cfn-nag if installed
if command -v cfn_nag_scan &> /dev/null; then
    echo ""
    echo "Running cfn-nag security validation..."
    echo ""

    TEMPLATES_DIR="cdk.out"
    FAILED=0

    for template in "$TEMPLATES_DIR"/*.template.json; do
        if [ -f "$template" ]; then
            template_name=$(basename "$template")
            echo "Validating $template_name with cfn-nag..."
            
            if cfn_nag_scan --input-path "$template" --output-format txt; then
                echo -e "${GREEN}✓ $template_name passed cfn-nag validation${NC}"
            else
                echo -e "${RED}✗ $template_name failed cfn-nag validation${NC}"
                FAILED=1
            fi
            echo ""
        fi
    done

    if [ $FAILED -eq 1 ]; then
        echo -e "${RED}cfn-nag validation failed!${NC}"
        exit 1
    else
        echo -e "${GREEN}All templates passed cfn-nag validation!${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}Note: cfn-nag is not installed (optional)${NC}"
    echo "To install cfn-nag for additional validation, run:"
    echo "  gem install cfn-nag"
    echo ""
fi

echo ""
echo -e "${GREEN}=== Security Validation Complete ===${NC}"
