#!/bin/bash

# Sales & Intelligence Platform - Test Environment Setup Script
# Version: 1.0.0
# This script sets up the test environment with enhanced security and isolation

set -euo pipefail

# Import configurations
source ../config/test-database.config.ts
source ../config/test-redis.config.ts
source ../config/test-kafka.config.ts

# Default values
DEFAULT_TIMEOUT=30
DEFAULT_MEMORY_LIMIT="2g"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse command line arguments
CLEAN=false
SKIP_DEPS=false
KEEP_CONTAINERS=false
TIMEOUT=$DEFAULT_TIMEOUT
DEBUG=false
MEMORY_LIMIT=$DEFAULT_MEMORY_LIMIT

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean) CLEAN=true ;;
        --skip-deps) SKIP_DEPS=true ;;
        --keep-containers) KEEP_CONTAINERS=true ;;
        --timeout) TIMEOUT="$2"; shift ;;
        --debug) DEBUG=true ;;
        --memory-limit) MEMORY_LIMIT="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Enable debug mode if requested
if [ "$DEBUG" = true ]; then
    set -x
fi

# Check dependencies function with version validation
check_dependencies() {
    local min_docker_version=$1
    local min_psql_version=$2

    echo "Checking dependencies..."

    # Check Docker installation
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed"
        return 1
    fi

    # Validate Docker version
    local docker_version=$(docker --version | cut -d ' ' -f3 | cut -d '.' -f1)
    if [ "$docker_version" -lt "$min_docker_version" ]; then
        echo "Error: Docker version $min_docker_version or higher is required"
        return 1
    fi

    # Check docker-compose
    if ! command -v docker-compose &> /dev/null; then
        echo "Error: docker-compose is not installed"
        return 1
    }

    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        echo "Error: PostgreSQL client is not installed"
        return 1
    }

    # Validate PostgreSQL version
    local psql_version=$(psql --version | cut -d ' ' -f3 | cut -d '.' -f1)
    if [ "$psql_version" -lt "$min_psql_version" ]; then
        echo "Error: PostgreSQL client version $min_psql_version or higher is required"
        return 1
    }

    echo "All dependencies verified successfully"
    return 0
}

# Setup database function with enhanced security
setup_database() {
    local db_config=$1
    local clean_existing=$2

    echo "Setting up test database..."

    # Start PostgreSQL container with resource limits
    docker run -d \
        --name test-postgres \
        --memory="$MEMORY_LIMIT" \
        --memory-swap="$MEMORY_LIMIT" \
        --cpu-shares=1024 \
        -e POSTGRES_DB="${TEST_DATABASE_CONFIG.database}" \
        -e POSTGRES_USER="${TEST_DATABASE_CONFIG.user}" \
        -e POSTGRES_PASSWORD="${TEST_DATABASE_CONFIG.password}" \
        -p "${TEST_DATABASE_CONFIG.port}:5432" \
        postgres:15

    # Wait for database to be ready
    local retries=0
    while ! pg_isready -h localhost -p "${TEST_DATABASE_CONFIG.port}" -U "${TEST_DATABASE_CONFIG.user}" > /dev/null 2>&1; do
        if [ $retries -eq $TIMEOUT ]; then
            echo "Error: Database failed to start within timeout"
            return 1
        fi
        sleep 1
        ((retries++))
    done

    # Clean existing data if requested
    if [ "$clean_existing" = true ]; then
        PGPASSWORD="${TEST_DATABASE_CONFIG.password}" psql \
            -h localhost \
            -p "${TEST_DATABASE_CONFIG.port}" \
            -U "${TEST_DATABASE_CONFIG.user}" \
            -d "${TEST_DATABASE_CONFIG.database}" \
            -c "DROP SCHEMA IF EXISTS ${TEST_DATABASE_CONFIG.schema} CASCADE;"
    fi

    # Create test schema and apply migrations
    PGPASSWORD="${TEST_DATABASE_CONFIG.password}" psql \
        -h localhost \
        -p "${TEST_DATABASE_CONFIG.port}" \
        -U "${TEST_DATABASE_CONFIG.user}" \
        -d "${TEST_DATABASE_CONFIG.database}" \
        -c "CREATE SCHEMA IF NOT EXISTS ${TEST_DATABASE_CONFIG.schema};"

    echo "Database setup completed successfully"
    return 0
}

# Setup Redis function with memory limits
setup_redis() {
    local redis_config=$1
    local flush_existing=$2

    echo "Setting up Redis cache..."

    # Start Redis container with memory limits
    docker run -d \
        --name test-redis \
        --memory="$MEMORY_LIMIT" \
        --memory-swap="$MEMORY_LIMIT" \
        -p "${TEST_REDIS_CONFIG.port}:6379" \
        --maxmemory "${TEST_REDIS_CONFIG.maxMemory}" \
        --maxmemory-policy "${TEST_REDIS_CONFIG.evictionPolicy}" \
        redis:7

    # Wait for Redis to be ready
    local retries=0
    while ! redis-cli -h localhost -p "${TEST_REDIS_CONFIG.port}" ping > /dev/null 2>&1; do
        if [ $retries -eq $TIMEOUT ]; then
            echo "Error: Redis failed to start within timeout"
            return 1
        fi
        sleep 1
        ((retries++))
    done

    # Flush existing data if requested
    if [ "$flush_existing" = true ]; then
        redis-cli -h localhost -p "${TEST_REDIS_CONFIG.port}" FLUSHALL
    fi

    echo "Redis setup completed successfully"
    return 0
}

# Setup Kafka function with topic isolation
setup_kafka() {
    local kafka_config=$1
    local required_topics=$2

    echo "Setting up Kafka broker..."

    # Start Kafka and Zookeeper containers
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d kafka zookeeper

    # Wait for Kafka to be ready
    local retries=0
    while ! kafka-topics.sh --bootstrap-server localhost:9092 --list > /dev/null 2>&1; do
        if [ $retries -eq $TIMEOUT ]; then
            echo "Error: Kafka failed to start within timeout"
            return 1
        fi
        sleep 1
        ((retries++))
    done

    # Create required topics
    for topic in "${required_topics[@]}"; do
        kafka-topics.sh --bootstrap-server localhost:9092 \
            --create \
            --if-not-exists \
            --topic "test.$topic" \
            --partitions 1 \
            --replication-factor 1
    done

    echo "Kafka setup completed successfully"
    return 0
}

# Cleanup function with secure handling
cleanup() {
    local remove_volumes=$1
    local force_cleanup=$2

    echo "Cleaning up test environment..."

    # Stop and remove containers
    if [ "$force_cleanup" = true ]; then
        docker rm -f test-postgres test-redis test-kafka test-zookeeper 2>/dev/null || true
    else
        docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down
    fi

    # Remove volumes if requested
    if [ "$remove_volumes" = true ]; then
        docker volume prune -f
    fi

    # Clean up environment variables
    unset TEST_DB_HOST TEST_DB_PORT TEST_REDIS_HOST TEST_REDIS_PORT

    echo "Cleanup completed successfully"
}

# Main execution
main() {
    # Check dependencies if not skipped
    if [ "$SKIP_DEPS" = false ]; then
        check_dependencies 20 15 || exit 1
    fi

    # Setup test environment
    trap 'cleanup true true' ERR
    trap 'cleanup false false' EXIT

    # Initialize services
    setup_database "$TEST_DATABASE_CONFIG" "$CLEAN" || exit 1
    setup_redis "$TEST_REDIS_CONFIG" "$CLEAN" || exit 1
    setup_kafka "$(getTestKafkaConfig 'test')" ["campaign-events", "analytics-events"] || exit 1

    echo "Test environment setup completed successfully"
}

main