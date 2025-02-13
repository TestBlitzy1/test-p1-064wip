import { jest } from 'jest'; // ^29.0.0
import supertest from 'supertest'; // ^2.0.0
import { MockServiceManager } from './mock-services';
import type { TestState, TestContext } from '../../types/test';

// Global timeout for integration tests
export const INTEGRATION_TEST_TIMEOUT = 30000;

// Default test configuration with comprehensive settings
export const DEFAULT_TEST_CONFIG = {
  environment: 'integration' as const,
  apiBaseUrl: 'http://localhost:3000',
  timeout: 5000,
  retries: 3,
  mockResponses: {
    linkedin: './mocks/linkedin',
    google: './mocks/google',
    crm: './mocks/crm'
  },
  cleanup: {
    enabled: true,
    preserveLog: false
  }
};

/**
 * Creates a comprehensive test context with initialized services and state management
 * @param config - Test configuration overrides
 */
export async function createTestContext(config: Partial<typeof DEFAULT_TEST_CONFIG> = {}): Promise<TestContext> {
  // Merge provided config with defaults
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };

  // Initialize mock service manager with enhanced error handling
  const serviceManager = new MockServiceManager();
  await serviceManager.initialize();

  // Initialize test state
  const state: TestState = {
    environment: testConfig.environment,
    config: testConfig,
    isAuthenticated: false,
    authToken: '',
    apiVersion: 'v1',
    testMetadata: {
      startTime: new Date(),
      retryCount: 0,
      testName: expect.getState().currentTestName || '',
      testSuite: expect.getState().testPath || '',
      testFile: __filename
    },
    mockData: {}
  };

  // Setup supertest instance with retry capability
  const request = supertest(testConfig.apiBaseUrl);

  // Create test context with comprehensive utilities
  const context: TestContext = {
    state,
    request,
    mockResponse: <T>(data: T) => ({
      data,
      status: 200,
      message: 'Success',
      timestamp: new Date().toISOString()
    }),
    dbConnection: null as any, // Will be initialized during setup
    cleanup: async () => {
      await serviceManager.reset();
      if (context.dbConnection) {
        await context.dbConnection.release();
      }
    }
  };

  return context;
}

/**
 * Sets up the integration test environment with necessary configurations
 * @param testConfig - Optional test configuration overrides
 */
export async function setupIntegrationTest(testConfig: Partial<typeof DEFAULT_TEST_CONFIG> = {}): Promise<void> {
  // Set Jest timeout for integration tests
  jest.setTimeout(INTEGRATION_TEST_TIMEOUT);

  // Initialize mock services
  const serviceManager = new MockServiceManager();
  await serviceManager.initialize();

  // Setup global test hooks
  beforeAll(async () => {
    // Initialize test database connection
    // Additional setup as needed
  });

  afterAll(async () => {
    await serviceManager.reset();
    // Additional cleanup as needed
  });

  beforeEach(async () => {
    // Reset mock service states before each test
    await serviceManager.reset();
  });

  afterEach(async () => {
    // Cleanup test artifacts and reset state
    if (testConfig.cleanup?.enabled) {
      await serviceManager.reset();
    }
  });
}

/**
 * Performs comprehensive cleanup of the integration test environment
 */
export async function teardownIntegrationTest(): Promise<void> {
  const serviceManager = new MockServiceManager();
  await serviceManager.reset();

  // Additional cleanup tasks
  jest.clearAllMocks();
  jest.clearAllTimers();
}

/**
 * Enhanced utility to wait for async operations with timeout and retry capability
 * @param operation - Async operation to wait for
 * @param timeout - Maximum time to wait
 * @param options - Additional options for retry and monitoring
 */
export async function waitForAsyncOperation<T>(
  operation: Promise<T>,
  timeout: number = DEFAULT_TEST_CONFIG.timeout,
  options: {
    retries?: number;
    interval?: number;
    onTimeout?: () => void;
  } = {}
): Promise<T> {
  const startTime = Date.now();
  const { retries = DEFAULT_TEST_CONFIG.retries, interval = 1000 } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        operation,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), timeout)
        )
      ]);

      return result as T;
    } catch (error) {
      lastError = error;
      
      if (Date.now() - startTime >= timeout) {
        options.onTimeout?.();
        throw new Error(`Operation failed after ${timeout}ms: ${error.message}`);
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  throw lastError || new Error('Operation failed after all retries');
}

/**
 * Enhanced base class for creating integration test fixtures
 */
export class IntegrationTestFixture {
  protected _serviceManager: MockServiceManager;
  protected _state: TestState;
  protected _transactions: any[] = [];
  protected _metrics: {
    startTime: number;
    operations: { name: string; duration: number }[];
  };

  constructor(config: Partial<typeof DEFAULT_TEST_CONFIG> = {}) {
    this._serviceManager = new MockServiceManager();
    this._state = {
      environment: config.environment || DEFAULT_TEST_CONFIG.environment,
      config: { ...DEFAULT_TEST_CONFIG, ...config },
      isAuthenticated: false,
      authToken: '',
      apiVersion: 'v1',
      testMetadata: {
        startTime: new Date(),
        retryCount: 0,
        testName: '',
        testSuite: '',
        testFile: __filename
      },
      mockData: {}
    };
    this._metrics = {
      startTime: Date.now(),
      operations: []
    };
  }

  /**
   * Comprehensive test fixture setup
   */
  async setup(): Promise<void> {
    await this._serviceManager.initialize();
    // Additional setup tasks
  }

  /**
   * Comprehensive cleanup and resource management
   */
  async teardown(): Promise<void> {
    await this._serviceManager.reset();
    for (const transaction of this._transactions) {
      await transaction.rollback();
    }
    this._transactions = [];
  }

  /**
   * Returns current test state with execution metrics
   */
  getState(): TestState {
    return { ...this._state };
  }
}