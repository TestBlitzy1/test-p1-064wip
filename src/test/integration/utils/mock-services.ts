import { jest } from 'jest'; // ^29.0.0
import { MockCRMService } from '../../mocks/services/crm.mock';
import { MockGoogleAdsService } from '../../mocks/services/google-ads.mock';
import { MockLinkedInAdsAdapter } from '../../mocks/services/linkedin-ads.mock';

// Global test configuration constants
const TEST_TIMEOUT = 5000;
const MOCK_DELAY = 100;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

/**
 * Enhanced manager for mock services with comprehensive testing capabilities
 */
export class MockServiceManager {
  private _crmService: MockCRMService;
  private _googleAdsService: MockGoogleAdsService;
  private _linkedInAdsService: MockLinkedInAdsAdapter;
  private _testContexts: Map<string, object>;

  constructor(config: Record<string, any> = {}) {
    // Initialize service instances with test isolation
    this._crmService = new MockCRMService(config, {
      enableGDPR: true,
      enableCCPA: true,
      dataRetentionDays: 365
    });

    this._googleAdsService = new MockGoogleAdsService();
    this._linkedInAdsService = new MockLinkedInAdsAdapter();
    this._testContexts = new Map();
  }

  /**
   * Initializes all managed mock services with enhanced features
   */
  public async initialize(): Promise<void> {
    // Initialize CRM service
    await this._crmService.connect({
      apiKey: 'test-api-key',
      environment: 'test'
    });

    // Setup test context separation
    this._testContexts.set('default', {
      initialized: true,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Resets all managed mock services with comprehensive cleanup
   */
  public async reset(): Promise<void> {
    // Reset individual services
    await this._crmService.connect({ apiKey: '', environment: 'test' });
    this._googleAdsService = new MockGoogleAdsService();
    this._linkedInAdsService.reset();

    // Clear test contexts
    this._testContexts.clear();
  }

  /**
   * Returns instances of all managed mock services with context
   */
  public getServices(): {
    crm: MockCRMService;
    googleAds: MockGoogleAdsService;
    linkedInAds: MockLinkedInAdsAdapter;
    context: Map<string, object>;
  } {
    return {
      crm: this._crmService,
      googleAds: this._googleAdsService,
      linkedInAds: this._linkedInAdsService,
      context: this._testContexts
    };
  }
}

/**
 * Initializes all mock services with enhanced configuration
 */
export async function initializeMockServices(
  config: Record<string, any> = {}
): Promise<{
  crm: MockCRMService;
  googleAds: MockGoogleAdsService;
  linkedInAds: MockLinkedInAdsAdapter;
}> {
  const manager = new MockServiceManager(config);
  await manager.initialize();
  const { crm, googleAds, linkedInAds } = manager.getServices();
  return { crm, googleAds, linkedInAds };
}

/**
 * Resets all mock services to their initial state with enhanced cleanup
 */
export async function resetMockServices(): Promise<void> {
  const manager = new MockServiceManager();
  await manager.reset();
}

/**
 * Configures response delays and performance characteristics for mock services
 */
export function configureMockDelays(delayConfig: {
  crm?: number;
  googleAds?: number;
  linkedInAds?: number;
}): void {
  const {
    crm = MOCK_DELAY,
    googleAds = MOCK_DELAY,
    linkedInAds = MOCK_DELAY
  } = delayConfig;

  // Apply custom delays with jitter for realistic simulation
  jest.setTimeout(TEST_TIMEOUT);

  // Configure service-specific delays
  jest.spyOn(MockCRMService.prototype, 'connect').mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, crm + Math.random() * 50));
    return true;
  });

  jest.spyOn(MockGoogleAdsService.prototype, 'createCampaign').mockImplementation(async (data) => {
    await new Promise(resolve => setTimeout(resolve, googleAds + Math.random() * 100));
    return `mock-campaign-${Date.now()}`;
  });

  jest.spyOn(MockLinkedInAdsAdapter.prototype, 'createCampaign').mockImplementation(async (data) => {
    await new Promise(resolve => setTimeout(resolve, linkedInAds + Math.random() * 75));
    return {
      data: { id: `mock-campaign-${Date.now()}` },
      status: 201,
      message: 'Campaign created successfully',
      timestamp: new Date().toISOString()
    };
  });
}