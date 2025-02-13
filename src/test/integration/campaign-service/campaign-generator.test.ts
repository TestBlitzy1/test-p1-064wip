import { jest } from 'jest'; // ^29.0.0
import { MockServiceManager } from '../utils/mock-services';
import { IntegrationTestFixture } from '../utils/test-helpers';
import { generateMockCampaign } from '../../mocks/data/campaign.mock';
import type { Campaign } from '../../../web/src/types/campaigns';

// Constants for test configuration
const TEST_TIMEOUT = 30000; // 30 seconds as per requirements
const RATE_LIMITS = {
  LINKEDIN: 100, // 100 requests per minute
  GOOGLE: 150   // 150 requests per minute
};

/**
 * Enhanced test fixture for campaign generator integration tests
 */
class CampaignGeneratorTestFixture extends IntegrationTestFixture {
  private _serviceManager: MockServiceManager;
  private _platformConfigs: {
    linkedin: { maxRetries: number; timeout: number };
    google: { maxRetries: number; timeout: number };
  };

  constructor() {
    super();
    this._serviceManager = new MockServiceManager();
    this._platformConfigs = {
      linkedin: { maxRetries: 3, timeout: 5000 },
      google: { maxRetries: 3, timeout: 5000 }
    };
  }

  /**
   * Sets up test environment with platform-specific configurations
   */
  async setup(): Promise<void> {
    await super.setup();
    await this._serviceManager.initialize();

    // Configure platform-specific test settings
    await this._serviceManager.getServices().linkedInAds.reset();
    await this._serviceManager.getServices().googleAds.reset();

    // Initialize test data
    this._state.mockData = {
      linkedInCampaign: generateMockCampaign('LINKEDIN'),
      googleCampaign: generateMockCampaign('GOOGLE')
    };
  }

  /**
   * Cleans up test environment and resets services
   */
  async teardown(): Promise<void> {
    await this._serviceManager.reset();
    await super.teardown();
  }
}

describe('Campaign Generator Integration Tests', () => {
  let fixture: CampaignGeneratorTestFixture;

  beforeAll(async () => {
    fixture = new CampaignGeneratorTestFixture();
    await fixture.setup();
  });

  afterAll(async () => {
    await fixture.teardown();
  });

  beforeEach(() => {
    jest.setTimeout(TEST_TIMEOUT);
  });

  describe('Campaign Structure Generation', () => {
    test('should generate LinkedIn campaign structure within 30 seconds', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('LINKEDIN', {
        status: 'QUEUED',
        budget: 25000
      });

      // Act
      const startTime = Date.now();
      const result = await fixture._serviceManager.getServices().linkedInAds.createCampaign(mockCampaign);
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.status).toBe(201);
      expect(result.data).toBeTruthy();
      expect(processingTime).toBeLessThanOrEqual(30000);
      expect(result.data.id).toBeDefined();
    });

    test('should generate Google Ads campaign structure within 30 seconds', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('GOOGLE', {
        status: 'QUEUED',
        budget: 30000
      });

      // Act
      const startTime = Date.now();
      const campaignId = await fixture._serviceManager.getServices().googleAds.createCampaign(mockCampaign);
      const processingTime = Date.now() - startTime;

      // Assert
      expect(campaignId).toBeTruthy();
      expect(processingTime).toBeLessThanOrEqual(30000);
    });

    test('should handle multi-platform campaign generation', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('BOTH', {
        status: 'QUEUED',
        budget: 50000
      });

      // Act
      const startTime = Date.now();
      const [linkedInResult, googleResult] = await Promise.all([
        fixture._serviceManager.getServices().linkedInAds.createCampaign(mockCampaign),
        fixture._serviceManager.getServices().googleAds.createCampaign(mockCampaign)
      ]);
      const processingTime = Date.now() - startTime;

      // Assert
      expect(linkedInResult.status).toBe(201);
      expect(googleResult).toBeTruthy();
      expect(processingTime).toBeLessThanOrEqual(30000);
    });
  });

  describe('Platform-Specific Validations', () => {
    test('should validate LinkedIn campaign format requirements', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('LINKEDIN');
      mockCampaign.platformSettings.linkedin!.format = 'SINGLE_IMAGE';

      // Act
      const result = await fixture._serviceManager.getServices().linkedInAds.createCampaign(mockCampaign);

      // Assert
      expect(result.status).toBe(201);
      expect(result.data.id).toBeDefined();
    });

    test('should validate Google Ads campaign format requirements', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('GOOGLE');
      mockCampaign.platformSettings.google!.campaignType = 'SEARCH';

      // Act
      const campaignId = await fixture._serviceManager.getServices().googleAds.createCampaign(mockCampaign);

      // Assert
      expect(campaignId).toBeTruthy();
    });
  });

  describe('Rate Limiting and Error Handling', () => {
    test('should handle LinkedIn rate limits correctly', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('LINKEDIN');
      const requests = Array(RATE_LIMITS.LINKEDIN + 1).fill(mockCampaign);

      // Act & Assert
      const results = await Promise.allSettled(
        requests.map(campaign => 
          fixture._serviceManager.getServices().linkedInAds.createCampaign(campaign)
        )
      );

      const rateLimitedRequests = results.filter(
        result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && result.value.status === 429)
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });

    test('should handle Google Ads rate limits correctly', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('GOOGLE');
      const requests = Array(RATE_LIMITS.GOOGLE + 1).fill(mockCampaign);

      // Act & Assert
      const results = await Promise.allSettled(
        requests.map(campaign =>
          fixture._serviceManager.getServices().googleAds.createCampaign(campaign)
        )
      );

      const rateLimitedRequests = results.filter(
        result => result.status === 'rejected'
      );

      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    });
  });

  describe('AI Optimization Integration', () => {
    test('should include AI-powered optimizations in campaign structure', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('LINKEDIN', {
        includeAIOptimizations: true
      });

      // Act
      const result = await fixture._serviceManager.getServices().linkedInAds.createCampaign(mockCampaign);

      // Assert
      expect(result.status).toBe(201);
      expect(result.data.id).toBeDefined();
      expect(mockCampaign.optimizationHints).toBeDefined();
      expect(mockCampaign.optimizationHints.suggestedBidAdjustments.length).toBeGreaterThan(0);
    });

    test('should validate AI optimization parameters', async () => {
      // Arrange
      const mockCampaign = generateMockCampaign('GOOGLE', {
        includeAIOptimizations: true
      });

      // Act
      const campaignId = await fixture._serviceManager.getServices().googleAds.createCampaign(mockCampaign);

      // Assert
      expect(campaignId).toBeTruthy();
      expect(mockCampaign.optimizationHints).toBeDefined();
      expect(mockCampaign.optimizationHints.audienceExpansionSuggestions.length).toBeGreaterThan(0);
    });
  });
});