import { jest } from 'jest';
import { CampaignManager } from '../../../backend/campaign_service/services/campaign_manager';
import { MockServiceManager } from '../utils/mock-services';
import { IntegrationTestFixture } from '../utils/test-helpers';
import type { Campaign } from '../../../web/src/types/campaigns';

// Test configuration constants
const TEST_TIMEOUT = 30000; // 30 seconds as per F-001-RQ-001
const MOCK_CAMPAIGN_DATA = {
  name: 'Test Campaign',
  description: 'Integration test campaign',
  platforms: ['linkedin', 'google'],
  total_budget: 5000.0,
  targeting_settings: {
    industries: ['Technology', 'SaaS'],
    company_size: '50-1000',
    locations: ['United States', 'Canada']
  }
};

/**
 * Integration test fixture for CampaignManager service testing
 */
class CampaignManagerTestFixture extends IntegrationTestFixture {
  private _campaignManager: CampaignManager;
  private _mockServices: MockServiceManager;

  constructor() {
    super();
    this._mockServices = new MockServiceManager();
  }

  /**
   * Sets up test environment with mock services and campaign manager
   */
  async setup(): Promise<void> {
    await super.setup();
    await this._mockServices.initialize();

    // Initialize campaign manager with mock services
    const { crm, googleAds, linkedInAds } = this._mockServices.getServices();
    this._campaignManager = new CampaignManager(
      crm,
      googleAds,
      linkedInAds
    );

    // Configure test timeouts
    jest.setTimeout(TEST_TIMEOUT);
  }

  /**
   * Cleans up test environment and resets mock services
   */
  async teardown(): Promise<void> {
    await this._mockServices.reset();
    await super.teardown();
  }

  /**
   * Returns initialized campaign manager instance
   */
  getCampaignManager(): CampaignManager {
    return this._campaignManager;
  }
}

describe('CampaignManager Integration Tests', () => {
  let fixture: CampaignManagerTestFixture;
  let campaignManager: CampaignManager;

  beforeEach(async () => {
    fixture = new CampaignManagerTestFixture();
    await fixture.setup();
    campaignManager = fixture.getCampaignManager();
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  describe('Campaign Creation', () => {
    test('should create campaign within 30 seconds and deploy to multiple platforms', async () => {
      const startTime = Date.now();

      // Create campaign
      const campaign = await campaignManager.create_campaign(
        MOCK_CAMPAIGN_DATA.name,
        MOCK_CAMPAIGN_DATA.description,
        MOCK_CAMPAIGN_DATA.platforms,
        MOCK_CAMPAIGN_DATA.total_budget,
        MOCK_CAMPAIGN_DATA.targeting_settings,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days duration
      );

      const duration = Date.now() - startTime;

      // Validate processing time requirement (F-001-RQ-001)
      expect(duration).toBeLessThanOrEqual(30000);

      // Validate campaign structure
      expect(campaign).toBeDefined();
      expect(campaign.name).toBe(MOCK_CAMPAIGN_DATA.name);
      expect(campaign.platform_settings).toBeDefined();

      // Validate platform deployments
      expect(campaign.platform_settings.linkedin).toBeDefined();
      expect(campaign.platform_settings.google).toBeDefined();
    });

    test('should validate campaign data and handle validation errors', async () => {
      const invalidData = { ...MOCK_CAMPAIGN_DATA, total_budget: -1000 };

      await expect(
        campaignManager.create_campaign(
          invalidData.name,
          invalidData.description,
          invalidData.platforms,
          invalidData.total_budget,
          invalidData.targeting_settings,
          new Date(),
          new Date()
        )
      ).rejects.toThrow('Invalid budget amount');
    });
  });

  describe('Campaign Updates', () => {
    test('should update campaign across all platforms synchronously', async () => {
      // Create initial campaign
      const campaign = await campaignManager.create_campaign(
        MOCK_CAMPAIGN_DATA.name,
        MOCK_CAMPAIGN_DATA.description,
        MOCK_CAMPAIGN_DATA.platforms,
        MOCK_CAMPAIGN_DATA.total_budget,
        MOCK_CAMPAIGN_DATA.targeting_settings,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      // Update campaign
      const updates = {
        name: 'Updated Campaign Name',
        total_budget: 7500.0
      };

      const updated = await campaignManager.update_campaign(campaign.id, updates);

      // Validate updates
      expect(updated).toBeTruthy();
      expect(updated.name).toBe(updates.name);
      expect(updated.total_budget).toBe(updates.total_budget);

      // Verify platform synchronization
      const platformStatuses = await Promise.all(
        MOCK_CAMPAIGN_DATA.platforms.map(platform =>
          campaignManager.get_campaign_status(campaign.id, platform)
        )
      );

      platformStatuses.forEach(status => {
        expect(status.synced).toBeTruthy();
        expect(status.lastSyncTime).toBeDefined();
      });
    });
  });

  describe('Performance Tracking', () => {
    test('should retrieve and aggregate performance metrics from all platforms', async () => {
      // Create campaign
      const campaign = await campaignManager.create_campaign(
        MOCK_CAMPAIGN_DATA.name,
        MOCK_CAMPAIGN_DATA.description,
        MOCK_CAMPAIGN_DATA.platforms,
        MOCK_CAMPAIGN_DATA.total_budget,
        MOCK_CAMPAIGN_DATA.targeting_settings,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      // Wait for initial metrics generation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get performance metrics
      const performance = await campaignManager.get_campaign_performance(
        campaign.id,
        {
          metrics: ['impressions', 'clicks', 'conversions'],
          timeRange: 'last_7_days'
        }
      );

      // Validate metrics structure
      expect(performance).toBeDefined();
      expect(performance.metrics).toBeDefined();
      expect(performance.metrics.impressions).toBeDefined();
      expect(performance.metrics.clicks).toBeDefined();
      expect(performance.metrics.conversions).toBeDefined();

      // Validate platform-specific metrics
      MOCK_CAMPAIGN_DATA.platforms.forEach(platform => {
        expect(performance.platformMetrics[platform]).toBeDefined();
        expect(performance.platformMetrics[platform].impressions).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Campaign Status Management', () => {
    test('should manage campaign status transitions and platform synchronization', async () => {
      // Create campaign
      const campaign = await campaignManager.create_campaign(
        MOCK_CAMPAIGN_DATA.name,
        MOCK_CAMPAIGN_DATA.description,
        MOCK_CAMPAIGN_DATA.platforms,
        MOCK_CAMPAIGN_DATA.total_budget,
        MOCK_CAMPAIGN_DATA.targeting_settings,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      // Test status transitions
      const statusTransitions = ['ACTIVE', 'PAUSED', 'ACTIVE', 'COMPLETED'];

      for (const status of statusTransitions) {
        const updated = await campaignManager.update_campaign_status(campaign.id, status);
        expect(updated).toBeTruthy();

        // Verify platform synchronization
        const platformStatuses = await Promise.all(
          MOCK_CAMPAIGN_DATA.platforms.map(platform =>
            campaignManager.get_campaign_status(campaign.id, platform)
          )
        );

        platformStatuses.forEach(platformStatus => {
          expect(platformStatus.status).toBe(status);
          expect(platformStatus.synced).toBeTruthy();
        });
      }
    });
  });
});