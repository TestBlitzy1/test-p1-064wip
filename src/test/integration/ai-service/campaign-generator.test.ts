import { jest } from 'jest'; // ^29.0.0
import supertest from 'supertest'; // ^2.0.0
import { IntegrationTestFixture } from '../utils/test-helpers';
import { MockServiceManager } from '../utils/mock-services';
import type { Campaign } from '../../../web/src/types/campaigns';
import type { ApiResponse } from '../../../web/src/types/api';

// Test configuration constants
const TEST_TIMEOUT = 30000; // 30 seconds as per F-001-RQ-001
const RETRY_OPTIONS = {
  retries: 3,
  backoff: 'exponential' as const,
  initialDelay: 1000
};

// Mock campaign input data
const MOCK_CAMPAIGN_INPUT = {
  objective: 'LEAD_GENERATION',
  platform: 'linkedin' as const,
  target_audience: {
    industries: ['Technology', 'SaaS'],
    company_size: '50-1000',
    job_titles: ['CTO', 'VP Engineering'],
    locations: ['United States', 'Canada']
  },
  budget: 5000.0,
  ad_formats: ['single_image', 'carousel', 'video']
};

/**
 * Integration test suite for AI Campaign Structure Generator
 * Tests campaign generation functionality, performance, and platform optimizations
 */
@testFixture
class CampaignGeneratorTestFixture extends IntegrationTestFixture {
  private serviceManager: MockServiceManager;
  private request: supertest.SuperTest<supertest.Test>;
  private perfMonitor: any;

  constructor() {
    super();
    this.serviceManager = new MockServiceManager();
    this.request = supertest('http://localhost:3000');
    this.perfMonitor = {
      startTime: 0,
      measurements: [] as number[]
    };
  }

  /**
   * Set up test environment with necessary mocks and configurations
   */
  async setup(): Promise<void> {
    await super.setup();
    await this.serviceManager.initialize();
    
    // Configure mock services for LinkedIn and Google Ads
    const { linkedInAds, googleAds } = this.serviceManager.getServices();
    
    // Initialize performance monitoring
    this.perfMonitor = {
      startTime: Date.now(),
      measurements: []
    };
  }

  /**
   * Clean up test environment and resources
   */
  async teardown(): Promise<void> {
    await this.serviceManager.reset();
    await super.teardown();
  }

  /**
   * Test campaign structure generation with comprehensive validation
   */
  @test
  @retry(RETRY_OPTIONS)
  async testCampaignGeneration(): Promise<void> {
    // Arrange
    const startTime = Date.now();

    // Act
    const response = await this.request
      .post('/api/v1/campaigns/generate')
      .send(MOCK_CAMPAIGN_INPUT)
      .timeout(TEST_TIMEOUT)
      .expect(200);

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Assert
    expect(response.body).toMatchObject({
      status: 200,
      message: expect.any(String),
      data: expect.objectContaining({
        id: expect.any(String),
        platformType: MOCK_CAMPAIGN_INPUT.platform,
        targetingSettings: expect.objectContaining({
          industries: expect.arrayContaining(MOCK_CAMPAIGN_INPUT.target_audience.industries),
          jobFunctions: expect.any(Array),
          companySizes: expect.any(Array),
          locations: expect.arrayContaining([
            expect.objectContaining({
              country: expect.stringMatching(/United States|Canada/)
            })
          ])
        }),
        platformSettings: expect.objectContaining({
          linkedin: expect.any(Object)
        }),
        performanceMetrics: expect.any(Object)
      })
    });

    // Validate processing time requirement (F-001-RQ-001)
    expect(processingTime).toBeLessThanOrEqual(30000);
  }

  /**
   * Test campaign generation performance metrics and optimization
   */
  @test
  @performance
  async testGenerationPerformance(): Promise<void> {
    // Arrange
    const iterations = 5;
    const measurements: number[] = [];

    // Act
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      const response = await this.request
        .post('/api/v1/campaigns/generate')
        .send(MOCK_CAMPAIGN_INPUT)
        .timeout(TEST_TIMEOUT);

      const processingTime = Date.now() - startTime;
      measurements.push(processingTime);

      // Assert each response
      expect(response.status).toBe(200);
      expect(response.body.data.performanceMetrics).toBeDefined();
    }

    // Calculate performance statistics
    const avgProcessingTime = measurements.reduce((a, b) => a + b, 0) / iterations;
    const maxProcessingTime = Math.max(...measurements);

    // Assert performance requirements
    expect(avgProcessingTime).toBeLessThanOrEqual(20000); // Average should be well under limit
    expect(maxProcessingTime).toBeLessThanOrEqual(30000); // Max should not exceed limit
  }

  /**
   * Test platform-specific ad format support and validation
   */
  @test
  @platformSpecific
  async testPlatformSpecificFormats(): Promise<void> {
    // Test LinkedIn ad formats
    const linkedInFormats = ['single_image', 'carousel', 'video'];
    for (const format of linkedInFormats) {
      const response = await this.request
        .post('/api/v1/campaigns/generate')
        .send({
          ...MOCK_CAMPAIGN_INPUT,
          ad_formats: [format]
        })
        .expect(200);

      expect(response.body.data.platformSettings.linkedin.format).toBe(format);
    }

    // Test Google ad formats
    const googleFormats = ['RESPONSIVE_SEARCH', 'DISPLAY', 'VIDEO'];
    for (const format of googleFormats) {
      const response = await this.request
        .post('/api/v1/campaigns/generate')
        .send({
          ...MOCK_CAMPAIGN_INPUT,
          platform: 'google',
          ad_formats: [format]
        })
        .expect(200);

      expect(response.body.data.platformSettings.google.campaignType).toBe(format);
    }
  }
}

export { CampaignGeneratorTestFixture };