import { Pool, Client } from 'pg'; // v8.11.3
import { beforeAll, afterAll } from '@jest/globals'; // v29.0.0
import { TEST_DATABASE_CONFIG } from '../config/test-database.config';

/**
 * Global test database pool instance
 * Initialized during test setup and cleaned up after tests
 */
let testPool: Pool | null = null;

/**
 * Prefix for test schemas to ensure isolation
 * Each test run gets its own schema with this prefix
 */
const SCHEMA_PREFIX: string = 'test_';

/**
 * Default timeout for database operations (5 seconds)
 */
const DEFAULT_TIMEOUT: number = 5000;

/**
 * Initializes the test database connection pool and sets up required schema
 * Called before all tests run to ensure proper database setup
 * 
 * @throws Error if database initialization fails
 */
export const initializeTestDatabase = beforeAll(async (): Promise<void> => {
    try {
        // Create new pool with test configuration
        testPool = new Pool({
            ...TEST_DATABASE_CONFIG,
            max: TEST_DATABASE_CONFIG.max,
            idleTimeoutMillis: TEST_DATABASE_CONFIG.idleTimeoutMillis
        });

        // Generate unique schema name for this test run
        const schemaName = `${SCHEMA_PREFIX}${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Get initial client for schema setup
        const setupClient = await testPool.connect();
        
        try {
            // Create isolated schema for tests
            await setupClient.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            await setupClient.query(`SET search_path TO ${schemaName},public`);
            
            // Verify schema creation
            const schemaCheck = await setupClient.query(
                'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
                [schemaName]
            );
            
            if (!schemaCheck.rows.length) {
                throw new Error(`Failed to create test schema: ${schemaName}`);
            }
            
        } finally {
            // Always release the setup client
            setupClient.release();
        }
        
    } catch (error) {
        console.error('Failed to initialize test database:', error);
        throw error;
    }
});

/**
 * Cleans up test database resources including schemas and connections
 * Called after all tests complete to ensure proper cleanup
 */
export const cleanupTestDatabase = afterAll(async (): Promise<void> => {
    try {
        if (testPool) {
            // Get cleanup client
            const cleanupClient = await testPool.connect();
            
            try {
                // Find and drop all test schemas
                const dropQuery = `
                    SELECT schema_name 
                    FROM information_schema.schemata 
                    WHERE schema_name LIKE '${SCHEMA_PREFIX}%'
                `;
                
                const schemas = await cleanupClient.query(dropQuery);
                
                for (const row of schemas.rows) {
                    await cleanupClient.query(`DROP SCHEMA IF EXISTS ${row.schema_name} CASCADE`);
                }
                
            } finally {
                cleanupClient.release();
            }
            
            // End pool with timeout
            await Promise.race([
                testPool.end(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Pool end timeout')), DEFAULT_TIMEOUT)
                )
            ]);
            
            testPool = null;
        }
    } catch (error) {
        console.error('Failed to cleanup test database:', error);
        throw error;
    }
});

/**
 * Retrieves a configured database client from the pool
 * Ensures proper schema context and timeout settings
 * 
 * @returns Promise<Client> Configured database client
 * @throws Error if pool is not initialized or client acquisition fails
 */
export const getTestClient = async (): Promise<Client> => {
    if (!testPool) {
        throw new Error('Test database pool not initialized');
    }
    
    try {
        const client = await Promise.race([
            testPool.connect(),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Client acquisition timeout')), DEFAULT_TIMEOUT)
            )
        ]) as Client;
        
        // Set statement timeout for all operations
        await client.query(`SET statement_timeout = ${DEFAULT_TIMEOUT}`);
        
        return client;
    } catch (error) {
        console.error('Failed to get test client:', error);
        throw error;
    }
};

/**
 * Executes database operations within a transaction
 * Provides automatic rollback on error and proper cleanup
 * 
 * @param callback Function to execute within transaction
 * @returns Promise<T> Result of the transaction
 * @throws Error if transaction fails
 */
export const withTransaction = async <T>(
    callback: (client: Client) => Promise<T>
): Promise<T> => {
    const client = await getTestClient();
    
    try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        
        const result = await callback(client);
        await client.query('COMMIT');
        
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};