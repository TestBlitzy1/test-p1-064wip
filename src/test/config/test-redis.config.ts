// Redis client configuration for test environment
// Package: ioredis v5.3.2
import { RedisOptions } from 'ioredis';

/**
 * Redis configuration for test environment
 * Defines connection parameters, retry strategies and test-specific settings
 * Used across unit, integration and e2e test suites
 */
const TEST_REDIS_CONFIG: RedisOptions = {
  // Connection settings
  host: 'localhost',
  port: 6379,
  db: 1, // Separate DB for test isolation
  password: process.env.TEST_REDIS_PASSWORD,
  keyPrefix: 'test:', // Prefix for test environment keys

  // Retry configuration
  retryStrategy: (times: number) => {
    // Exponential backoff with max 3 second delay
    return Math.min(times * 1000, 3000);
  },
  maxRetriesPerRequest: 3,

  // Test environment specific flags
  enableReadyCheck: true, // Verify Redis server readiness
  enableOfflineQueue: false, // Fail fast in test environment
  
  // Additional test-specific settings
  connectTimeout: 5000, // 5s connection timeout
  disconnectTimeout: 2000, // 2s disconnect timeout
  commandTimeout: 3000, // 3s command timeout
  lazyConnect: true, // Connect on first command
  
  // Monitoring and debugging for tests
  showFriendlyErrorStack: true,
  enableAutoPipelining: false, // Disable for test predictability
};

// Export configuration for use in test suites
export { TEST_REDIS_CONFIG };