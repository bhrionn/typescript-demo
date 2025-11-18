#!/bin/bash

###############################################################################
# Integration Testing Script
#
# This script automates end-to-end integration testing for the federated
# authentication TypeScript application.
#
# Usage: ./run-integration-tests.sh [environment]
# Example: ./run-integration-tests.sh dev
#
# Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
PROJECT_NAME="typescript-demo"
STACK_PREFIX="${PROJECT_NAME}-${ENVIRONMENT}"
TEST_RESULTS_FILE="integration-test-results-$(date +%Y%m%d-%H%M%S).txt"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_failure() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    ((WARNINGS++))
    ((TOTAL_TESTS++))
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

get_stack_output() {
    local stack_name=$1
    local output_key=$2
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

check_command() {
    if command -v $1 &> /dev/null; then
        log_success "$1 is installed"
        return 0
    else
        log_failure "$1 is not installed"
        return 1
    fi
}

###############################################################################
# Test Functions
###############################################################################

test_prerequisites() {
    log_section "Phase 1: Checking Prerequisites"
    
    check_command "aws"
    check_command "jq"
    check_command "curl"
    
    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        log_success "AWS credentials configured"
    else
        log_failure "AWS credentials not configured"
    fi
}

test_infrastructure_deployment() {
    log_section "Phase 2: Verifying Infrastructure Deployment"
    
    # Check each stack
    local stacks=("network" "security" "waf" "cognito" "storage" "compute" "api" "cdn" "monitoring")
    
    for stack in "${stacks[@]}"; do
        local stack_name="${STACK_PREFIX}-${stack}"
        local status=$(aws cloudformation describe-stacks \
            --stack-name "$stack_name" \
            --query 'Stacks[0].StackStatus' \
            --output text 2>/dev/null || echo "NOT_FOUND")
        
        if [[ "$status" == "CREATE_COMPLETE" ]] || [[ "$status" == "UPDATE_COMPLETE" ]]; then
            log_success "Stack $stack_name is deployed ($status)"
        else
            log_failure "Stack $stack_name is not properly deployed ($status)"
        fi
    done
}

test_security_validation() {
    log_section "Phase 3: Running Security Validation"
    
    log_info "Synthesizing CloudFormation templates..."
    cd infrastructure
    
    if npm run build &> /dev/null && npx cdk synth &> /dev/null; then
        log_success "CDK synthesis completed"
    else
        log_failure "CDK synthesis failed"
        cd ..
        return 1
    fi
    
    log_info "Running security validation script..."
    if npx ts-node scripts/validate-security.ts &> security-validation.log; then
        log_success "Security validation passed"
    else
        log_warning "Security validation completed with warnings (see security-validation.log)"
    fi
    
    cd ..
}

test_vpc_configuration() {
    log_section "Phase 4: Verifying VPC Configuration"
    
    # Get VPC ID
    local vpc_id=$(aws ec2 describe-vpcs \
        --filters "Name=tag:Name,Values=${STACK_PREFIX}*" \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$vpc_id" ]] && [[ "$vpc_id" != "None" ]]; then
        log_success "VPC found: $vpc_id"
        
        # Check subnets
        local subnet_count=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$vpc_id" \
            --query 'length(Subnets)' \
            --output text)
        
        if [[ $subnet_count -ge 6 ]]; then
            log_success "Sufficient subnets configured ($subnet_count)"
        else
            log_warning "Only $subnet_count subnets found (expected at least 6)"
        fi
        
        # Check NAT Gateways
        local nat_count=$(aws ec2 describe-nat-gateways \
            --filter "Name=vpc-id,Values=$vpc_id" "Name=state,Values=available" \
            --query 'length(NatGateways)' \
            --output text)
        
        if [[ $nat_count -ge 1 ]]; then
            log_success "NAT Gateway(s) configured ($nat_count)"
        else
            log_warning "No NAT Gateways found"
        fi
    else
        log_failure "VPC not found"
    fi
}

test_cognito_configuration() {
    log_section "Phase 5: Verifying Cognito Configuration"
    
    local user_pool_id=$(get_stack_output "${STACK_PREFIX}-cognito" "UserPoolId")
    
    if [[ -n "$user_pool_id" ]] && [[ "$user_pool_id" != "None" ]]; then
        log_success "Cognito User Pool found: $user_pool_id"
        
        # Check identity providers
        local providers=$(aws cognito-idp list-identity-providers \
            --user-pool-id "$user_pool_id" \
            --query 'Providers[*].ProviderName' \
            --output text 2>/dev/null || echo "")
        
        if echo "$providers" | grep -q "Google"; then
            log_success "Google identity provider configured"
        else
            log_warning "Google identity provider not found"
        fi
        
        if echo "$providers" | grep -q "Microsoft"; then
            log_success "Microsoft identity provider configured"
        else
            log_warning "Microsoft identity provider not found"
        fi
        
        # Check password policy
        local password_policy=$(aws cognito-idp describe-user-pool \
            --user-pool-id "$user_pool_id" \
            --query 'UserPool.Policies.PasswordPolicy' \
            --output json 2>/dev/null || echo "{}")
        
        local min_length=$(echo "$password_policy" | jq -r '.MinimumLength // 0')
        if [[ $min_length -ge 8 ]]; then
            log_success "Strong password policy configured (min length: $min_length)"
        else
            log_warning "Weak password policy (min length: $min_length)"
        fi
    else
        log_failure "Cognito User Pool not found"
    fi
}

test_s3_configuration() {
    log_section "Phase 6: Verifying S3 Configuration"
    
    local bucket_name=$(get_stack_output "${STACK_PREFIX}-storage" "FilesBucketName")
    
    if [[ -n "$bucket_name" ]] && [[ "$bucket_name" != "None" ]]; then
        log_success "S3 bucket found: $bucket_name"
        
        # Check public access block
        local public_access=$(aws s3api get-public-access-block \
            --bucket "$bucket_name" \
            --query 'PublicAccessBlockConfiguration' \
            --output json 2>/dev/null || echo "{}")
        
        local block_public_acls=$(echo "$public_access" | jq -r '.BlockPublicAcls // false')
        local block_public_policy=$(echo "$public_access" | jq -r '.BlockPublicPolicy // false')
        
        if [[ "$block_public_acls" == "true" ]] && [[ "$block_public_policy" == "true" ]]; then
            log_success "S3 public access blocked"
        else
            log_failure "S3 public access not fully blocked"
        fi
        
        # Check encryption
        if aws s3api get-bucket-encryption --bucket "$bucket_name" &> /dev/null; then
            log_success "S3 bucket encryption enabled"
        else
            log_failure "S3 bucket encryption not enabled"
        fi
        
        # Test direct access (should fail)
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "https://${bucket_name}.s3.amazonaws.com/" || echo "000")
        if [[ "$http_code" == "403" ]]; then
            log_success "S3 direct access blocked (403)"
        else
            log_warning "S3 direct access returned unexpected code: $http_code"
        fi
    else
        log_failure "S3 bucket not found"
    fi
}

test_rds_configuration() {
    log_section "Phase 7: Verifying RDS Configuration"
    
    # Find RDS instance
    local db_instance=$(aws rds describe-db-instances \
        --query "DBInstances[?contains(DBInstanceIdentifier, '${STACK_PREFIX}')].DBInstanceIdentifier" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$db_instance" ]] && [[ "$db_instance" != "None" ]]; then
        log_success "RDS instance found: $db_instance"
        
        # Check public accessibility
        local publicly_accessible=$(aws rds describe-db-instances \
            --db-instance-identifier "$db_instance" \
            --query 'DBInstances[0].PubliclyAccessible' \
            --output text)
        
        if [[ "$publicly_accessible" == "False" ]]; then
            log_success "RDS is not publicly accessible"
        else
            log_failure "RDS is publicly accessible"
        fi
        
        # Check encryption
        local encrypted=$(aws rds describe-db-instances \
            --db-instance-identifier "$db_instance" \
            --query 'DBInstances[0].StorageEncrypted' \
            --output text)
        
        if [[ "$encrypted" == "True" ]]; then
            log_success "RDS encryption at rest enabled"
        else
            log_failure "RDS encryption at rest not enabled"
        fi
        
        # Check backups
        local backup_retention=$(aws rds describe-db-instances \
            --db-instance-identifier "$db_instance" \
            --query 'DBInstances[0].BackupRetentionPeriod' \
            --output text)
        
        if [[ $backup_retention -gt 0 ]]; then
            log_success "RDS automated backups enabled ($backup_retention days)"
        else
            log_failure "RDS automated backups not enabled"
        fi
    else
        log_failure "RDS instance not found"
    fi
}

test_lambda_configuration() {
    log_section "Phase 8: Verifying Lambda Configuration"
    
    # Find Lambda functions
    local functions=$(aws lambda list-functions \
        --query "Functions[?contains(FunctionName, '${STACK_PREFIX}')].FunctionName" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$functions" ]]; then
        local function_count=$(echo "$functions" | wc -w)
        log_success "Found $function_count Lambda function(s)"
        
        # Check each function
        for func in $functions; do
            # Check VPC configuration
            local vpc_config=$(aws lambda get-function-configuration \
                --function-name "$func" \
                --query 'VpcConfig.VpcId' \
                --output text 2>/dev/null || echo "")
            
            if [[ -n "$vpc_config" ]] && [[ "$vpc_config" != "None" ]]; then
                log_success "Lambda $func is in VPC"
            else
                log_warning "Lambda $func is not in VPC"
            fi
        done
    else
        log_failure "No Lambda functions found"
    fi
}

test_api_gateway() {
    log_section "Phase 9: Verifying API Gateway"
    
    local api_endpoint=$(get_stack_output "${STACK_PREFIX}-api" "ApiEndpoint")
    
    if [[ -n "$api_endpoint" ]] && [[ "$api_endpoint" != "None" ]]; then
        log_success "API Gateway endpoint found: $api_endpoint"
        
        # Test health endpoint (if exists)
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "${api_endpoint}/health" || echo "000")
        if [[ "$http_code" == "200" ]] || [[ "$http_code" == "401" ]]; then
            log_success "API Gateway is responding (HTTP $http_code)"
        else
            log_warning "API Gateway returned unexpected code: $http_code"
        fi
        
        # Test CORS
        local cors_header=$(curl -s -I -X OPTIONS "${api_endpoint}/api/files" | grep -i "access-control-allow-origin" || echo "")
        if [[ -n "$cors_header" ]]; then
            log_success "CORS headers configured"
        else
            log_warning "CORS headers not found"
        fi
    else
        log_failure "API Gateway endpoint not found"
    fi
}

test_cloudfront_distribution() {
    log_section "Phase 10: Verifying CloudFront Distribution"
    
    local distribution_id=$(get_stack_output "${STACK_PREFIX}-cdn" "DistributionId")
    
    if [[ -n "$distribution_id" ]] && [[ "$distribution_id" != "None" ]]; then
        log_success "CloudFront distribution found: $distribution_id"
        
        # Get distribution domain
        local domain=$(aws cloudfront get-distribution \
            --id "$distribution_id" \
            --query 'Distribution.DomainName' \
            --output text 2>/dev/null || echo "")
        
        if [[ -n "$domain" ]]; then
            log_success "CloudFront domain: $domain"
            
            # Test HTTPS
            local https_code=$(curl -s -o /dev/null -w "%{http_code}" "https://${domain}/" || echo "000")
            if [[ "$https_code" == "200" ]] || [[ "$https_code" == "403" ]]; then
                log_success "CloudFront HTTPS is working (HTTP $https_code)"
            else
                log_warning "CloudFront HTTPS returned unexpected code: $https_code"
            fi
            
            # Test HTTP redirect
            local http_redirect=$(curl -s -I "http://${domain}/" | grep -i "location: https" || echo "")
            if [[ -n "$http_redirect" ]]; then
                log_success "HTTP to HTTPS redirect configured"
            else
                log_warning "HTTP to HTTPS redirect not detected"
            fi
        fi
        
        # Check WAF association
        local waf_id=$(aws cloudfront get-distribution \
            --id "$distribution_id" \
            --query 'Distribution.DistributionConfig.WebACLId' \
            --output text 2>/dev/null || echo "")
        
        if [[ -n "$waf_id" ]] && [[ "$waf_id" != "None" ]]; then
            log_success "WAF associated with CloudFront"
        else
            log_warning "No WAF associated with CloudFront"
        fi
    else
        log_failure "CloudFront distribution not found"
    fi
}

test_waf_configuration() {
    log_section "Phase 11: Verifying WAF Configuration"
    
    # Find WAF WebACL
    local web_acl=$(aws wafv2 list-web-acls \
        --scope CLOUDFRONT \
        --query "WebACLs[?contains(Name, '${STACK_PREFIX}')].Name" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$web_acl" ]]; then
        log_success "WAF WebACL found: $web_acl"
        
        # Get WebACL details
        local web_acl_id=$(aws wafv2 list-web-acls \
            --scope CLOUDFRONT \
            --query "WebACLs[?Name=='${web_acl}'].Id" \
            --output text)
        
        local rule_count=$(aws wafv2 get-web-acl \
            --scope CLOUDFRONT \
            --id "$web_acl_id" \
            --name "$web_acl" \
            --query 'length(WebACL.Rules)' \
            --output text 2>/dev/null || echo "0")
        
        if [[ $rule_count -gt 0 ]]; then
            log_success "WAF has $rule_count rule(s) configured"
        else
            log_warning "WAF has no rules configured"
        fi
    else
        log_failure "WAF WebACL not found"
    fi
}

test_cloudwatch_monitoring() {
    log_section "Phase 12: Verifying CloudWatch Monitoring"
    
    # Check CloudTrail
    local trail=$(aws cloudtrail describe-trails \
        --query "trailList[?contains(Name, '${STACK_PREFIX}')].Name" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$trail" ]]; then
        log_success "CloudTrail found: $trail"
    else
        log_warning "CloudTrail not found"
    fi
    
    # Check for Lambda log groups
    local log_groups=$(aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/${STACK_PREFIX}" \
        --query 'length(logGroups)' \
        --output text 2>/dev/null || echo "0")
    
    if [[ $log_groups -gt 0 ]]; then
        log_success "Found $log_groups Lambda log group(s)"
    else
        log_warning "No Lambda log groups found"
    fi
    
    # Check for CloudWatch alarms
    local alarms=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "${STACK_PREFIX}" \
        --query 'length(MetricAlarms)' \
        --output text 2>/dev/null || echo "0")
    
    if [[ $alarms -gt 0 ]]; then
        log_success "Found $alarms CloudWatch alarm(s)"
    else
        log_warning "No CloudWatch alarms found"
    fi
}

test_security_groups() {
    log_section "Phase 13: Verifying Security Groups"
    
    # Find security groups
    local security_groups=$(aws ec2 describe-security-groups \
        --filters "Name=tag:Name,Values=${STACK_PREFIX}*" \
        --query 'SecurityGroups[*].GroupId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$security_groups" ]]; then
        local sg_count=$(echo "$security_groups" | wc -w)
        log_success "Found $sg_count security group(s)"
        
        # Check for overly permissive rules
        for sg in $security_groups; do
            local open_ingress=$(aws ec2 describe-security-groups \
                --group-ids "$sg" \
                --query 'SecurityGroups[0].IpPermissions[?contains(IpRanges[].CidrIp, `0.0.0.0/0`)]' \
                --output json | jq 'length')
            
            if [[ $open_ingress -eq 0 ]]; then
                log_success "Security group $sg has no open ingress rules"
            else
                log_warning "Security group $sg has $open_ingress open ingress rule(s)"
            fi
        done
    else
        log_warning "No security groups found"
    fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     Integration Testing Script                             ║"
    echo "║     Environment: $ENVIRONMENT                                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Start logging
    exec > >(tee -a "$TEST_RESULTS_FILE")
    exec 2>&1
    
    log_info "Starting integration tests at $(date)"
    log_info "Results will be saved to: $TEST_RESULTS_FILE"
    
    # Run all tests
    test_prerequisites
    test_infrastructure_deployment
    test_security_validation
    test_vpc_configuration
    test_cognito_configuration
    test_s3_configuration
    test_rds_configuration
    test_lambda_configuration
    test_api_gateway
    test_cloudfront_distribution
    test_waf_configuration
    test_cloudwatch_monitoring
    test_security_groups
    
    # Print summary
    log_section "Test Summary"
    echo ""
    echo "Total Tests:   $TOTAL_TESTS"
    echo -e "${GREEN}Passed:        $PASSED_TESTS${NC}"
    echo -e "${RED}Failed:        $FAILED_TESTS${NC}"
    echo -e "${YELLOW}Warnings:      $WARNINGS${NC}"
    echo ""
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}✅ All critical tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Please review the results.${NC}"
        exit 1
    fi
}

# Run main function
main
