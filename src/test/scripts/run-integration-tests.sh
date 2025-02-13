#!/bin/bash

# Integration Test Runner for Sales & Intelligence Platform
# Version: 1.0.0
# Description: Executes comprehensive integration tests across all services with
# enhanced error handling, privacy compliance validation, and performance monitoring.

set -euo pipefail

# Global Configuration
readonly LOG_DIR="./logs/integration"
readonly REPORT_DIR="./reports/integration"
readonly TEST_TIMEOUT=300 # 5 minutes
readonly MAX_RETRIES=3
readonly PARALLEL_JOBS=4

# Environment Variables with defaults
ENVIRONMENT=${TEST_ENV:-"integration"}
LOG_LEVEL=${LOG_LEVEL:-"info"}
RATE_LIMIT_ENABLED=${RATE_LIMIT_ENABLED:-"true"}
PRIVACY_CHECK_ENABLED=${PRIVACY_CHECK_ENABLED:-"true"}
PERF_MONITORING_ENABLED=${PERF_MONITORING_ENABLED:-"true"}

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Initialize logging
setup_logging() {
    mkdir -p "${LOG_DIR}"
    local log_file="${LOG_DIR}/integration-test-$(date +%Y%m%d_%H%M%S).log"
    exec 3>&1 4>&2
    exec 1> >(tee -a "$log_file") 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Integration test session started"
}

# Validate environment prerequisites
check_prerequisites() {
    local missing_deps=()
    
    # Check required tools
    for tool in docker docker-compose node npm jest; do
        if ! command -v "$tool" &> /dev/null; then
            missing_deps+=("$tool")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}Error: Missing required dependencies: ${missing_deps[*]}${NC}"
        exit 1
    fi
}

# Setup test environment
setup_test_environment() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Setting up test environment"
    
    # Export test configuration
    export TEST_ENV="$ENVIRONMENT"
    export NODE_ENV="test"
    
    # Start required services
    docker-compose -f docker-compose.test.yml up -d --remove-orphans
    
    # Wait for services to be healthy
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if docker-compose -f docker-compose.test.yml ps | grep -q "healthy"; then
            echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Services are healthy"
            return 0
        fi
        echo "$(date '+%Y-%m-%d %H:%M:%S') [WARN] Waiting for services to be healthy..."
        sleep 5
        ((retries++))
    done
    
    echo -e "${RED}Error: Services failed to become healthy${NC}"
    return 1
}

# Run integration tests with comprehensive monitoring
run_tests() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Starting integration tests"
    
    # Create reports directory
    mkdir -p "${REPORT_DIR}"
    
    # Set test configuration
    local jest_config=(
        "--config=jest.integration.config.js"
        "--runInBand"
        "--forceExit"
        "--detectOpenHandles"
        "--coverage"
        "--coverageDirectory=${REPORT_DIR}/coverage"
        "--json"
        "--outputFile=${REPORT_DIR}/test-results.json"
        "--testTimeout=$TEST_TIMEOUT"
    )
    
    # Enable parallel execution if configured
    if [ "$PARALLEL_JOBS" -gt 1 ]; then
        jest_config+=("--maxWorkers=$PARALLEL_JOBS")
    fi
    
    # Run tests with performance monitoring
    if [ "$PERF_MONITORING_ENABLED" = "true" ]; then
        jest_config+=("--testEnvironment=./test/environment/performance.js")
    fi
    
    # Execute tests
    if ! npx jest "${jest_config[@]}"; then
        echo -e "${RED}Error: Integration tests failed${NC}"
        return 1
    fi
    
    # Generate test report
    npx jest-html-reporter \
        --outputPath="${REPORT_DIR}/test-report.html" \
        --includeFailureMsg \
        --includeConsoleLog
        
    return 0
}

# Cleanup test environment
cleanup_environment() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Cleaning up test environment"
    
    # Stop and remove containers
    docker-compose -f docker-compose.test.yml down --volumes --remove-orphans
    
    # Clean up temporary files
    rm -rf ./tmp/* || true
    
    # Archive test artifacts
    local archive_dir="./archives/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$archive_dir"
    mv "${LOG_DIR}"/* "$archive_dir/" 2>/dev/null || true
    mv "${REPORT_DIR}"/* "$archive_dir/" 2>/dev/null || true
    
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Cleanup completed"
}

# Enhanced error handling
handle_error() {
    local error_message="$1"
    local exit_code="${2:-1}"
    
    echo -e "${RED}Error: ${error_message}${NC}" >&2
    
    # Collect system state for debugging
    {
        echo "=== Error Context ==="
        echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "Environment: $ENVIRONMENT"
        echo "Docker Status:"
        docker-compose -f docker-compose.test.yml ps || true
        echo "System Resources:"
        free -h || true
        df -h || true
    } >> "${LOG_DIR}/error-$(date +%Y%m%d_%H%M%S).log"
    
    # Attempt cleanup
    cleanup_environment
    
    exit "$exit_code"
}

# Main execution
main() {
    # Trap errors
    trap 'handle_error "Script failed on line $LINENO"' ERR
    
    # Initialize
    setup_logging
    check_prerequisites
    
    # Setup and run tests
    if setup_test_environment; then
        if run_tests; then
            echo -e "${GREEN}Integration tests completed successfully${NC}"
            cleanup_environment
            exit 0
        else
            handle_error "Integration tests failed" 2
        fi
    else
        handle_error "Environment setup failed" 1
    fi
}

# Execute main function
main "$@"