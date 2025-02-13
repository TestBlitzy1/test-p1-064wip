#!/bin/bash

# run-e2e-tests.sh
# End-to-end test orchestration script for Sales & Intelligence Platform
# Version: 1.0.0

# Exit on any error
set -e

# Default configuration
export TEST_TIMEOUT=300000
export TEST_ENV=e2e
export TEST_SERVER_PORT=4000
export TEST_SERVER_HOST=localhost
export TEST_DB_PORT=5432
export NODE_ENV=test

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging utilities
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check function with retries
check_health() {
    local url="http://$TEST_SERVER_HOST:$TEST_SERVER_PORT/health"
    local max_retries=3
    local retry_count=0
    local wait_time=5

    while [ $retry_count -lt $max_retries ]; do
        if curl -s -f "$url" > /dev/null; then
            log_info "Health check passed"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_warn "Health check failed, attempt $retry_count of $max_retries"
        sleep $wait_time
    done

    log_error "Health check failed after $max_retries attempts"
    return 1
}

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."

    # Load test environment variables
    if [ -f .env.test ]; then
        source .env.test
    else
        log_error ".env.test file not found"
        return 1
    fi

    # Validate required environment variables
    required_vars=("DB_URL" "API_KEY" "TEST_USER" "TEST_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            return 1
        fi
    done

    # Initialize test database
    log_info "Initializing test database..."
    if ! npx ts-node src/test/e2e/utils/test-database.ts; then
        log_error "Failed to initialize test database"
        return 1
    fi

    # Start test server
    log_info "Starting test server..."
    if ! npx ts-node src/test/e2e/utils/test-server.ts; then
        log_error "Failed to start test server"
        return 1
    fi

    # Perform health check
    if ! check_health; then
        return 1
    fi

    log_info "Test environment setup completed successfully"
    return 0
}

# Run end-to-end tests
run_e2e_tests() {
    log_info "Running end-to-end tests..."

    # Set Jest environment variables
    export JEST_WORKER_ID=1
    export JEST_PARALLEL_WORKERS=4

    # Create test results directory
    mkdir -p test-results/e2e

    # Run tests with coverage and reporting
    jest \
        --config=jest.config.e2e.js \
        --runInBand \
        --forceExit \
        --detectOpenHandles \
        --coverage \
        --coverageDirectory=test-results/e2e/coverage \
        --testTimeout=$TEST_TIMEOUT \
        --json --outputFile=test-results/e2e/results.json \
        --reporters=default \
        --reporters=jest-junit

    local test_exit_code=$?

    # Generate test summary
    if [ $test_exit_code -eq 0 ]; then
        log_info "All tests passed successfully"
    else
        log_error "Tests failed with exit code $test_exit_code"
    fi

    return $test_exit_code
}

# Cleanup test environment
cleanup_test_environment() {
    log_info "Cleaning up test environment..."

    # Stop test server gracefully
    if ! npx ts-node src/test/e2e/utils/test-server.ts --shutdown; then
        log_warn "Failed to stop test server gracefully, forcing shutdown..."
        pkill -f "node.*test-server"
    fi

    # Cleanup test database
    if ! npx ts-node src/test/e2e/utils/test-database.ts --cleanup; then
        log_error "Failed to cleanup test database"
        return 1
    fi

    # Remove temporary files
    rm -rf test-results/e2e/tmp
    find test-results/e2e -type f -name "*.log" -mtime +7 -delete

    log_info "Test environment cleanup completed"
    return 0
}

# Main execution function
main() {
    local start_time=$(date +%s)
    local exit_code=0

    # Create execution log
    exec 3>&1 4>&2
    trap 'exec 2>&4 1>&3' 0 1 2 3
    exec 1>test-results/e2e/execution.log 2>&1

    log_info "Starting end-to-end test execution"

    # Setup phase
    if ! setup_test_environment; then
        log_error "Test environment setup failed"
        exit_code=1
    else
        # Run tests only if setup succeeds
        if ! run_e2e_tests; then
            log_error "Test execution failed"
            exit_code=1
        fi
    fi

    # Always attempt cleanup
    if ! cleanup_test_environment; then
        log_error "Test environment cleanup failed"
        exit_code=1
    fi

    # Calculate execution time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_info "Total execution time: ${duration}s"

    # Generate execution summary
    cat << EOF > test-results/e2e/summary.txt
E2E Test Execution Summary
-------------------------
Start Time: $(date -d @$start_time)
End Time: $(date -d @$end_time)
Duration: ${duration}s
Exit Code: $exit_code
EOF

    return $exit_code
}

# Execute main function
main "$@"