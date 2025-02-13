#!/bin/bash

# Security Test Suite Runner
# Version: 1.0.0
# Description: Executes comprehensive security test suites including compliance tests (GDPR, SOC2)
# and penetration tests for the Sales Intelligence Platform

# Exit on any error
set -e

# Constants
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REPORT_DIR="$PROJECT_ROOT/reports/security"
LOG_DIR="$PROJECT_ROOT/logs/security"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Test suite paths
GDPR_TESTS="src/test/security/compliance/gdpr.test.ts"
SOC2_TESTS="src/test/security/compliance/soc2.test.ts"
API_PEN_TESTS="src/test/security/penetration/api.pen.ts"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create required directories
setup_directories() {
    echo "Setting up test directories..."
    mkdir -p "$REPORT_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$REPORT_DIR/compliance"
    mkdir -p "$REPORT_DIR/penetration"
}

# Check required dependencies
check_dependencies() {
    echo "Checking dependencies..."
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: Node.js and npm are required${NC}"
        exit 1
    fi

    # Check OWASP ZAP
    if ! command -v zap.sh &> /dev/null; then
        echo -e "${YELLOW}Warning: OWASP ZAP not found. Penetration tests may be limited${NC}"
    }

    # Check Jest
    if ! npm list jest | grep -q 'jest@'; then
        echo -e "${RED}Error: Jest is required for running tests${NC}"
        exit 1
    }
}

# Initialize test environment
init_test_environment() {
    echo "Initializing test environment..."
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env.test" ]; then
        source "$PROJECT_ROOT/.env.test"
    else
        echo -e "${RED}Error: .env.test file not found${NC}"
        exit 1
    fi

    # Set test specific environment variables
    export NODE_ENV=test
    export TEST_REPORT_DIR="$REPORT_DIR"
    export TEST_LOG_DIR="$LOG_DIR"
    export TEST_RUN_ID="security_test_$TIMESTAMP"
}

# Run GDPR compliance tests
run_gdpr_tests() {
    echo "Running GDPR compliance tests..."
    npx jest "$GDPR_TESTS" \
        --config="$PROJECT_ROOT/jest.config.js" \
        --runInBand \
        --forceExit \
        --json \
        --outputFile="$REPORT_DIR/compliance/gdpr_results_$TIMESTAMP.json" \
        --testTimeout=30000 \
        || return 1
}

# Run SOC2 compliance tests
run_soc2_tests() {
    echo "Running SOC2 compliance tests..."
    npx jest "$SOC2_TESTS" \
        --config="$PROJECT_ROOT/jest.config.js" \
        --runInBand \
        --forceExit \
        --json \
        --outputFile="$REPORT_DIR/compliance/soc2_results_$TIMESTAMP.json" \
        --testTimeout=30000 \
        || return 1
}

# Run API penetration tests
run_penetration_tests() {
    echo "Running API penetration tests..."
    
    # Start ZAP in daemon mode if available
    if command -v zap.sh &> /dev/null; then
        zap.sh -daemon -port 8080 -host 127.0.0.1 &
        ZAP_PID=$!
        sleep 10 # Wait for ZAP to start
    fi

    npx jest "$API_PEN_TESTS" \
        --config="$PROJECT_ROOT/jest.config.js" \
        --runInBand \
        --forceExit \
        --json \
        --outputFile="$REPORT_DIR/penetration/api_results_$TIMESTAMP.json" \
        --testTimeout=60000 \
        || return 1

    # Kill ZAP process if it was started
    if [ -n "$ZAP_PID" ]; then
        kill $ZAP_PID
    fi
}

# Generate consolidated report
generate_report() {
    echo "Generating consolidated security test report..."
    
    REPORT_FILE="$REPORT_DIR/security_test_report_$TIMESTAMP.html"
    
    # Combine test results
    node "$PROJECT_ROOT/src/test/scripts/generate-security-report.js" \
        --gdpr="$REPORT_DIR/compliance/gdpr_results_$TIMESTAMP.json" \
        --soc2="$REPORT_DIR/compliance/soc2_results_$TIMESTAMP.json" \
        --pentest="$REPORT_DIR/penetration/api_results_$TIMESTAMP.json" \
        --output="$REPORT_FILE"
        
    echo -e "${GREEN}Security test report generated: $REPORT_FILE${NC}"
}

# Cleanup function
cleanup() {
    echo "Cleaning up test environment..."
    
    # Remove any temporary files
    rm -f /tmp/security_test_*
    
    # Kill any remaining test processes
    pkill -f "jest" || true
    pkill -f "zap.sh" || true
    
    # Reset environment variables
    unset NODE_ENV
    unset TEST_REPORT_DIR
    unset TEST_LOG_DIR
    unset TEST_RUN_ID
}

# Main execution
main() {
    local exit_code=0
    
    echo "Starting security test suite..."
    
    # Setup phase
    setup_directories
    check_dependencies
    init_test_environment
    
    # Test execution phase
    if ! run_gdpr_tests; then
        echo -e "${RED}GDPR compliance tests failed${NC}"
        exit_code=1
    fi
    
    if ! run_soc2_tests; then
        echo -e "${RED}SOC2 compliance tests failed${NC}"
        exit_code=1
    fi
    
    if ! run_penetration_tests; then
        echo -e "${RED}Penetration tests failed${NC}"
        exit_code=1
    fi
    
    # Report generation
    generate_report
    
    # Cleanup
    cleanup
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}Security test suite completed successfully${NC}"
    else
        echo -e "${RED}Security test suite failed${NC}"
    fi
    
    return $exit_code
}

# Trap cleanup function
trap cleanup EXIT

# Execute main function
main "$@"