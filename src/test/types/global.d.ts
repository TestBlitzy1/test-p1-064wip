// @types/jest v29.0.0
// @types/supertest v2.0.0

import { ApiResponse, ApiError } from '../../web/src/types/api';
import type { Campaign, TargetingSettings, PlatformSettings } from '../../web/src/types/campaigns';
import type { Audience } from '../../web/src/types/audiences';
import type { Analytics } from '../../web/src/types/analytics';
import type { SuperTest, Test } from 'supertest';

// Extend NodeJS process env with test-specific environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'test' | 'development' | 'production';
    TEST_API_URL: string;
    TEST_AUTH_TOKEN: string;
    TEST_DB_URL: string;
    TEST_REDIS_URL: string;
    TEST_MOCK_RESPONSES: boolean;
    TEST_LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
    TEST_REQUEST_TIMEOUT: number;
    TEST_RETRY_ATTEMPTS: number;
  }
}

// Test configuration interface
interface TestConfig {
  apiBaseUrl: string;
  environment: string;
  timeout: number;
  retries: number;
  mockResponses: boolean;
  logLevel: string;
  dbConfig: {
    url: string;
    poolSize: number;
  };
  redisConfig: {
    url: string;
    ttl: number;
  };
}

// Base test state interface
export interface TestState {
  isAuthenticated: boolean;
  userId: string;
  testConfig: TestConfig;
  mockData: Record<string, any>;
  cleanup: () => Promise<void>;
}

// Test context interface with state and utilities
export interface TestContext<T extends TestState = TestState> {
  state: T;
  request: SuperTest<Test>;
}

// Mock factory interface for creating test data
export interface MockFactory {
  createMockResponse: <T>(data: T) => ApiResponse<T>;
  createMockError: (message: string, code: string) => ApiError;
  createMockCampaign: (overrides?: Partial<Campaign>) => Campaign;
  createMockAudience: (overrides?: Partial<Audience>) => Audience;
  createMockAnalytics: (overrides?: Partial<Analytics>) => Analytics;
}

// Type utility for creating strongly-typed test context
export function createTestContext<T extends TestState>(
  initialState: Partial<T> = {}
): TestContext<T> {
  return {
    state: initialState as T,
    request: {} as SuperTest<Test> // Will be initialized by test setup
  };
}

// Type utility for creating typed mock API responses
export function createMockResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
    status: 200,
    message: 'Success',
    timestamp: new Date().toISOString(),
    requestId: `test-${Date.now()}`
  };
}

// Extend Jest with custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidResponse(): R;
      toHaveValidSchema(schema: object): R;
      toMatchApiContract(contract: object): R;
      toBeWithinRateLimit(limit: number): R;
    }
  }
}

// Test suite configuration types
export interface TestSuiteConfig {
  name: string;
  description: string;
  timeout?: number;
  retries?: number;
  tags?: string[];
  dependencies?: string[];
}

// Test case metadata types
export interface TestCaseMetadata {
  title: string;
  description?: string;
  timeout?: number;
  retries?: number;
  tags?: string[];
  issue?: string;
  author?: string;
}

// Test data provider types
export interface TestDataProvider<T> {
  getData(): Promise<T>;
  cleanup(): Promise<void>;
}

// Test fixture types
export interface TestFixture<T> {
  setup(): Promise<T>;
  teardown(): Promise<void>;
}

// Test reporter types
export interface TestReport {
  suiteName: string;
  passed: boolean;
  duration: number;
  timestamp: string;
  error?: Error;
  metadata?: Record<string, any>;
}

// Test metrics types
export interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage: number;
}

// Test environment types
export type TestEnvironment = 'unit' | 'integration' | 'e2e';

// Test priority types
export type TestPriority = 'low' | 'medium' | 'high' | 'critical';

// Test status types
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'blocked';

// Test result types with detailed metadata
export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  duration: number;
  environment: TestEnvironment;
  priority: TestPriority;
  error?: Error;
  screenshots?: string[];
  logs?: string[];
  metadata?: Record<string, any>;
}