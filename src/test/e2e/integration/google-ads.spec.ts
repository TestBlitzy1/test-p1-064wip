import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // v29.0.0
import { testApiClient } from '../utils/test-client';
import { MockGoogleAdsService } from '../../mocks/services/google-ads.mock';
import { faker } from '@faker-js/faker'; // v8.0.0
import type { Campaign } from '../../../web/src/types/campaigns';
import { TestContainer, StartedTestContainer } from 'testcontainers'; // v9.0.0

// Constants for test configuration
const TEST_TIMEOUT = 30000;
const API_BASE_PATH = '/api/v1/integration/google-ads';
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 150;

describe('Google Ads Integration Tests', () => {
  let mockGoogleAdsService: MockGoogleAdsService;
  let dbContainer: StartedTestContainer;

  beforeAll(async () => {
    // Initialize test database container
    dbContainer = await new TestContainer('postgres:15')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: 'test_sales_intelligence',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'test_password'
      })
      .start();

    // Initialize mock service
    mockGoogleAdsService = new MockGoogleAdsService();

    // Configure test authentication
    testApiClient.setTestAuthToken('test-auth-token');

    // Set test timeout
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterAll(async () => {
    await dbContainer.stop();
    testApiClient.clearTestAuthToken();
  });

  describe('AI Campaign Generation', () => {
    test('should generate optimized campaign structure within 30 seconds', async () => {
      // Prepare test campaign data
      const campaignData = {
        name: faker.company.name(),
        totalBudget: faker.number.int({ min: 5000, max: 50000 }),
        targetingSettings: {
          industries: ['Technology', 'SaaS'],
          jobFunctions: [{ title: 'CTO', seniority: ['Senior'] }],
          locations: [{ country: 'US', region: 'California' }]
        },
        platformType: 'GOOGLE' as const
      };

      const startTime = Date.now();

      // Send campaign generation request
      const response = await testApiClient.post<Campaign>(
        `${API_BASE_PATH}/campaigns`,
        campaignData
      );

      const processingTime = Date.now() - startTime;

      // Verify response and processing time
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(processingTime).toBeLessThan(30000);
      expect(response.data.processingStatus).toBe('COMPLETED');

      // Validate AI optimizations
      expect(response.data.optimizationHints).toBeDefined();
      expect(response.data.optimizationHints.suggestedBidAdjustments).toHaveLength(
        expect.any(Number)
      );
      expect(response.data.performanceMetrics.optimizationScore).toBeGreaterThan(0);
    });

    test('should handle rate limits with exponential backoff', async () => {
      const requests = Array.from({ length: MAX_REQUESTS_PER_MINUTE + 10 }, () => ({
        name: faker.company.name(),
        totalBudget: faker.number.int({ min: 1000, max: 10000 }),
        platformType: 'GOOGLE' as const
      }));

      const startTime = Date.now();
      const responses = await Promise.allSettled(
        requests.map(req => 
          testApiClient.post(`${API_BASE_PATH}/campaigns`, req)
        )
      );

      const totalTime = Date.now() - startTime;

      // Verify rate limit handling
      expect(totalTime).toBeGreaterThan(RATE_LIMIT_WINDOW);
      expect(responses.filter(r => r.status === 'fulfilled').length).toBeLessThanOrEqual(
        MAX_REQUESTS_PER_MINUTE
      );
    });
  });

  describe('Campaign Management', () => {
    test('should apply AI-optimized campaign updates', async () => {
      // Create initial campaign
      const campaign = await mockGoogleAdsService.createCampaign({
        name: faker.company.name(),
        totalBudget: 10000,
        platformType: 'GOOGLE'
      });

      // Request AI optimization
      const optimizationResponse = await testApiClient.post<Campaign>(
        `${API_BASE_PATH}/campaigns/${campaign.id}/optimize`,
        { optimizationTarget: 'CONVERSIONS' }
      );

      // Apply updates
      const updateResponse = await testApiClient.put<Campaign>(
        `${API_BASE_PATH}/campaigns/${campaign.id}`,
        optimizationResponse.data.optimizationHints
      );

      // Verify optimization application
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.performanceMetrics.optimizationScore).toBeGreaterThan(
        campaign.performanceMetrics.optimizationScore
      );
    });
  });

  describe('Performance Analytics', () => {
    test('should provide AI-powered performance insights', async () => {
      const campaignId = faker.string.uuid();
      
      // Generate performance data
      await mockGoogleAdsService.createCampaign({
        id: campaignId,
        name: faker.company.name(),
        totalBudget: 20000,
        platformType: 'GOOGLE'
      });

      // Request AI analysis
      const analyticsResponse = await testApiClient.get<Campaign>(
        `${API_BASE_PATH}/campaigns/${campaignId}/analytics`
      );

      // Validate insights
      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.data.performanceMetrics).toBeDefined();
      expect(analyticsResponse.data.optimizationHints).toBeDefined();
      expect(analyticsResponse.data.optimizationHints.audienceExpansionSuggestions).toHaveLength(
        expect.any(Number)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid campaign configurations', async () => {
      const invalidCampaign = {
        name: '', // Invalid empty name
        totalBudget: -1000, // Invalid negative budget
        platformType: 'GOOGLE' as const
      };

      const response = await testApiClient.post(
        `${API_BASE_PATH}/campaigns`,
        invalidCampaign
      ).catch(error => error);

      expect(response.statusCode).toBe(400);
      expect(response.response).toHaveProperty('validationErrors');
    });

    test('should handle API errors gracefully', async () => {
      // Simulate API error
      mockGoogleAdsService.simulateRateLimit();

      const response = await testApiClient.post(
        `${API_BASE_PATH}/campaigns`,
        { name: faker.company.name(), totalBudget: 10000, platformType: 'GOOGLE' }
      ).catch(error => error);

      expect(response.statusCode).toBe(429);
      expect(response.response).toHaveProperty('retryAfter');
    });
  });
});