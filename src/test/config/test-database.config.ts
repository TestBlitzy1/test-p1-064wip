import { Pool, PoolConfig } from 'pg'; // v8.11.3

/**
 * Test database configuration for Sales & Intelligence Platform
 * 
 * This configuration is used across all test suites (unit, integration, e2e)
 * with optimized settings for test environment including:
 * - Connection pooling with appropriate limits
 * - Timeouts for idle and connection attempts
 * - Test-specific database name and user
 * - SSL disabled for local test environment
 * - READ COMMITTED isolation level for test consistency
 */

const TEST_DATABASE_CONFIG: PoolConfig = {
    // Connection Settings
    host: 'localhost',
    port: 5432,
    database: 'test_sales_intelligence',
    user: 'test_user',
    password: 'test_password',

    // Pool Configuration
    max: 20,                           // Maximum number of clients in the pool
    idleTimeoutMillis: 10000,         // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 5000,     // How long to wait for a connection
    
    // Security Settings
    ssl: false,                        // SSL disabled for test environment

    // Application Name (helps with monitoring)
    application_name: 'sales_intelligence_test',

    // Statement Timeout (prevent long-running queries in tests)
    statement_timeout: 10000,          // 10 seconds

    // Transaction Isolation Level
    isolationLevel: 'READ COMMITTED',  // Ensures consistent test execution

    // Query Logging (enabled for test debugging)
    log_statement: 'all',
    
    // Connection Parameters
    options: {
        // Schema search path for test isolation
        search_path: 'test_schema,public'
    }
};

// Export the configuration for use in test suites
export { TEST_DATABASE_CONFIG };

// Type definition for strongly-typed access to the configuration
export type TestDatabaseConfig = typeof TEST_DATABASE_CONFIG;