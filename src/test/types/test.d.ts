import { ApiResponse } from '../../web/src/types/api';
import { DatabaseConfig } from '../config/test-database.config';
import '@types/jest'; // v29.0.0
import '@types/supertest'; // v2.0.0

/**
 * Test environment type defining available test contexts
 */
export type TestEnvironment = 'unit' | 'integration' | 'e2e';

/**
 * Test reporter configuration interface
 */
export interface TestReporterConfig {
  outputDir: string;
  includeScreenshots: boolean;
  includeConsoleLog: boolean;
  includeNetworkLogs: boolean;
  customReporters?: string[];
}

/**
 * Comprehensive test configuration interface
 */
export interface TestConfig {
  environment: TestEnvironment;
  apiBaseUrl: string;
  dbConfig: DatabaseConfig;
  timeout: number;
  retries: number;
  ciEnvironment?: boolean;
  parallelExecution?: boolean;
  reporterConfig?: TestReporterConfig;
}

/**
 * Test metadata interface for tracking test execution details
 */
export interface TestMetadata {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  retryCount: number;
  testName: string;
  testSuite: string;
  testFile: string;
}

/**
 * Base test state interface with comprehensive test context
 */
export interface TestState {
  environment: TestEnvironment;
  config: TestConfig;
  isAuthenticated: boolean;
  authToken: string;
  apiVersion: string;
  testMetadata: TestMetadata;
  mockData: Record<string, unknown>;
}

/**
 * Database connection interface for test environment
 */
export interface DatabaseConnection {
  query: <T = any>(sql: string, values?: any[]) => Promise<T[]>;
  transaction: <T>(callback: () => Promise<T>) => Promise<T>;
  release: () => void;
}

/**
 * Enhanced test context interface with comprehensive utilities
 */
export interface TestContext<T extends TestState = TestState> {
  state: T;
  request: supertest.SuperTest<supertest.Test>;
  mockResponse: <D>(data: D) => ApiResponse<D>;
  dbConnection: DatabaseConnection;
  cleanup: () => Promise<void>;
}

/**
 * Test fixture interface with enhanced lifecycle hooks
 */
export interface TestFixture {
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  beforeEach: () => Promise<void>;
  afterEach: () => Promise<void>;
  getState: () => TestState;
  startTransaction: () => Promise<void>;
  rollbackTransaction: () => Promise<void>;
}

/**
 * Mock factory interface for generating test data
 */
export interface MockFactory<T> {
  create: (overrides?: Partial<T>) => T;
  createMany: (count: number, overrides?: Partial<T>) => T[];
  createPartial: (fields: Array<keyof T>) => Partial<T>;
}

/**
 * Test assertion utilities
 */
export interface TestAssertions {
  toMatchApiResponse: (response: any) => boolean;
  toHaveValidSchema: (data: any, schema: object) => boolean;
  toBeWithinTimeout: (duration: number, timeout: number) => boolean;
}

/**
 * Creates a strongly-typed test context with enhanced features
 * @template T Type parameter extending TestState
 */
export function createTestContext<T extends TestState>(
  config: TestConfig
): Promise<TestContext<T>>;

/**
 * Creates typed mock API responses with comprehensive data
 * @template T Type parameter for response data
 */
export function createMockResponse<T>(
  data: T,
  status?: number,
  message?: string
): ApiResponse<T>;

/**
 * Test result interface for detailed test reporting
 */
export interface TestResult {
  success: boolean;
  duration: number;
  error?: Error;
  consoleOutput: string[];
  networkCalls: {
    request: any;
    response: any;
    duration: number;
  }[];
  metadata: TestMetadata;
}

/**
 * Test suite configuration for parameterized testing
 */
export interface TestSuiteConfig {
  name: string;
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  dependencies?: string[];
  tags?: string[];
}

declare global {
  namespace jest {
    interface Matchers<R> extends TestAssertions {}
  }
}