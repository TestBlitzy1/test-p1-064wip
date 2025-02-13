import { KafkaConfig } from '@types/kafkajs'; // v2.0.0
import { TestState } from '../types/test';

/**
 * Default test environment Kafka configuration values
 */
export const DEFAULT_TEST_BROKER = 'localhost:9092';
export const DEFAULT_TEST_CLIENT_ID = 'test-client';
export const DEFAULT_TEST_GROUP_ID = 'test-group';
export const DEFAULT_TEST_TIMEOUT = 30000;
export const DEFAULT_TEST_RETRIES = 3;
export const MAX_TEST_TIMEOUT = 120000;

/**
 * SSL configuration interface for secure Kafka connections
 */
interface SSLConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean;
  ca?: string[];
  cert?: string;
  key?: string;
}

/**
 * SASL authentication configuration interface
 */
interface SASLConfig {
  mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
  username: string;
  password: string;
}

/**
 * Connection pool configuration interface
 */
interface PoolConfig {
  maxInFlightRequests: number;
  maxConnectionBufferSize: number;
  connectionTimeout: number;
  requestTimeout: number;
}

/**
 * Monitoring configuration interface for test environments
 */
interface MonitoringConfig {
  metrics: boolean;
  logging: boolean;
  tracing: boolean;
  errorTracking: boolean;
}

/**
 * Test-specific Kafka configuration interface extending KafkaConfig
 */
export interface TestKafkaConfig extends KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  timeout: number;
  retries: number;
  ssl: SSLConfig;
  sasl: SASLConfig;
  connectionPool: PoolConfig;
  monitoring: MonitoringConfig;
}

/**
 * Configuration overrides interface for test customization
 */
interface KafkaConfigOverrides {
  brokers?: string[];
  clientId?: string;
  groupId?: string;
  timeout?: number;
  retries?: number;
  ssl?: Partial<SSLConfig>;
  sasl?: Partial<SASLConfig>;
  connectionPool?: Partial<PoolConfig>;
  monitoring?: Partial<MonitoringConfig>;
}

/**
 * Decorator for configuration validation
 */
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    // Validate environment
    if (!args[0] || !['unit', 'integration', 'e2e'].includes(args[0])) {
      throw new Error('Invalid test environment specified');
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Decorator for configuration monitoring
 */
function monitorConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    const startTime = Date.now();
    const result = originalMethod.apply(this, args);
    const duration = Date.now() - startTime;
    console.log(`Kafka config generation took ${duration}ms`);
    return result;
  };
  return descriptor;
}

/**
 * Returns environment-specific Kafka configuration for test scenarios
 * @param environment - Test environment (unit, integration, e2e)
 * @param overrides - Optional configuration overrides
 * @returns TestKafkaConfig - Complete Kafka configuration for test environment
 */
@validateConfig
@monitorConfig
export function getTestKafkaConfig(
  environment: TestState['environment'],
  overrides?: KafkaConfigOverrides
): TestKafkaConfig {
  // Base configuration
  const baseConfig: TestKafkaConfig = {
    brokers: [DEFAULT_TEST_BROKER],
    clientId: `${DEFAULT_TEST_CLIENT_ID}-${environment}`,
    groupId: `${DEFAULT_TEST_GROUP_ID}-${environment}`,
    timeout: DEFAULT_TEST_TIMEOUT,
    retries: DEFAULT_TEST_RETRIES,
    ssl: {
      enabled: false,
      rejectUnauthorized: true
    },
    sasl: {
      mechanism: 'plain',
      username: 'test-user',
      password: 'test-password'
    },
    connectionPool: {
      maxInFlightRequests: 10,
      maxConnectionBufferSize: 100,
      connectionTimeout: 5000,
      requestTimeout: 30000
    },
    monitoring: {
      metrics: true,
      logging: true,
      tracing: environment !== 'unit',
      errorTracking: true
    }
  };

  // Environment-specific configurations
  switch (environment) {
    case 'integration':
      baseConfig.connectionPool.maxInFlightRequests = 20;
      baseConfig.timeout = 60000;
      break;
    case 'e2e':
      baseConfig.connectionPool.maxInFlightRequests = 50;
      baseConfig.timeout = MAX_TEST_TIMEOUT;
      baseConfig.ssl.enabled = true;
      break;
  }

  // Apply custom overrides if provided
  if (overrides) {
    return {
      ...baseConfig,
      ...overrides,
      ssl: { ...baseConfig.ssl, ...overrides.ssl },
      sasl: { ...baseConfig.sasl, ...overrides.sasl },
      connectionPool: { ...baseConfig.connectionPool, ...overrides.connectionPool },
      monitoring: { ...baseConfig.monitoring, ...overrides.monitoring }
    };
  }

  return baseConfig;
}