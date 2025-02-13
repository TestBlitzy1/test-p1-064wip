import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'; // v29.0.0
import { createTestCampaign, cleanupTestCampaign, setupTestCampaignFixtures } from './campaign.fixtures';
import { testApiClient } from '../utils/test-client';
import { Campaign } from '../../../web/src/types/campaigns';

// Constants for test configuration
const TEST_CAMPAIGN_ENDPOINT = '/api/v1/campaigns';
const TEST_TIMEOUT = 30000; // 30 seconds max processing time
const PERFORMANCE_THRESHOLD = 30000; // 30 seconds performance requirement

/**
 * Sets up test environment before running campaign tests
 */
const setupTestEnvironment = beforeAll(async () => {
  // Initialize test auth token
  testApiClient.setTestAuthToken('test-auth-token');
});

/**
 * Cleans up test environment after campaign tests
 */
const cleanupTestEnvironment = afterAll(async () => {
  testApiClient.clearTestAuthToken();
});

describe('Campaign Creation and Management', () => {
  describe('LinkedIn Campaign Creation', () => {
    test('should create LinkedIn campaign with all ad formats within performance threshold', async () => {
      // Arrange
      const adFormats = ['SINGLE_IMAGE', 'CAROUSEL', 'VIDEO', 'MESSAGE'];
      const startTime = Date.now();

      // Act
      const campaign = await createTestCampaign('LINKEDIN', adFormats);

      // Assert
      expect(campaign).toBeDefined();
      expect(campaign.platformType).toBe('LINKEDIN');
      expect(campaign.processingStatus).toBe('COMPLETED');
      
      // Validate performance requirement
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);

      // Validate ad format support
      expect(campaign.platformSettings.linkedin?.format).toBeDefined();
      expect(adFormats).toContain(campaign.platformSettings.linkedin?.format);

      // Cleanup
      await cleanupTestCampaign(campaign.id);
    }, TEST_TIMEOUT);

    test('should handle LinkedIn campaign creation with AI optimizations', async () => {
      // Arrange
      const campaignData = {
        name: 'Test LinkedIn AI Campaign',
        platform: 'LINKEDIN',
        includeAIOptimizations: true
      };

      // Act
      const response = await testApiClient.post<Campaign>(
        TEST_CAMPAIGN_ENDPOINT,
        campaignData
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.optimizationHints).toBeDefined();
      expect(response.data.performanceMetrics.optimizationScore).toBeGreaterThan(0);

      // Cleanup
      await cleanupTestCampaign(response.data.id);
    }, TEST_TIMEOUT);
  });

  describe('Google Ads Campaign Creation', () => {
    test('should create Google Ads campaign with all formats within performance threshold', async () => {
      // Arrange
      const adFormats = ['SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING'];
      const startTime = Date.now();

      // Act
      const campaign = await createTestCampaign('GOOGLE', adFormats);

      // Assert
      expect(campaign).toBeDefined();
      expect(campaign.platformType).toBe('GOOGLE');
      expect(campaign.processingStatus).toBe('COMPLETED');

      // Validate performance requirement
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);

      // Validate ad format support
      expect(campaign.platformSettings.google?.campaignType).toBeDefined();
      expect(adFormats).toContain(campaign.platformSettings.google?.campaignType);

      // Cleanup
      await cleanupTestCampaign(campaign.id);
    }, TEST_TIMEOUT);

    test('should handle Google Ads campaign creation with AI optimizations', async () => {
      // Arrange
      const campaignData = {
        name: 'Test Google AI Campaign',
        platform: 'GOOGLE',
        includeAIOptimizations: true
      };

      // Act
      const response = await testApiClient.post<Campaign>(
        TEST_CAMPAIGN_ENDPOINT,
        campaignData
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.optimizationHints).toBeDefined();
      expect(response.data.performanceMetrics.optimizationScore).toBeGreaterThan(0);

      // Cleanup
      await cleanupTestCampaign(response.data.id);
    }, TEST_TIMEOUT);
  });

  describe('AI-Powered Campaign Optimization', () => {
    test('should generate optimized campaign variations within time limit', async () => {
      // Arrange
      const campaign = await createTestCampaign('LINKEDIN', ['SINGLE_IMAGE']);
      const startTime = Date.now();

      // Act
      const response = await testApiClient.post<Campaign>(
        `${TEST_CAMPAIGN_ENDPOINT}/${campaign.id}/optimize`,
        { optimizationType: 'STRUCTURE' }
      );

      // Assert
      expect(response.status).toBe(200);
      expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(response.data.optimizationHints).toBeDefined();
      expect(response.data.performanceMetrics.optimizationScore).toBeGreaterThan(0.7);

      // Cleanup
      await cleanupTestCampaign(campaign.id);
    }, TEST_TIMEOUT);

    test('should provide AI-powered targeting recommendations', async () => {
      // Arrange
      const campaign = await createTestCampaign('GOOGLE', ['SEARCH']);

      // Act
      const response = await testApiClient.get<Campaign>(
        `${TEST_CAMPAIGN_ENDPOINT}/${campaign.id}/recommendations`
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.optimizationHints.audienceExpansionSuggestions).toBeDefined();
      expect(response.data.optimizationHints.suggestedBidAdjustments).toBeDefined();

      // Cleanup
      await cleanupTestCampaign(campaign.id);
    }, TEST_TIMEOUT);
  });

  describe('Campaign Performance Requirements', () => {
    test('should handle multiple concurrent campaign creations', async () => {
      // Arrange
      const campaignCount = 5;
      const startTime = Date.now();

      // Act
      const campaigns = await setupTestCampaignFixtures(
        campaignCount,
        'BOTH',
        { validationLevel: 'STRICT' }
      );

      // Assert
      expect(campaigns).toHaveLength(campaignCount);
      expect(Date.now() - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);

      // Validate all campaigns completed successfully
      campaigns.forEach(campaign => {
        expect(campaign.processingStatus).toBe('COMPLETED');
        expect(campaign.performanceMetrics.processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      });

      // Cleanup
      await Promise.all(campaigns.map(c => cleanupTestCampaign(c.id)));
    }, TEST_TIMEOUT * 2);

    test('should maintain performance under load', async () => {
      // Arrange
      const iterations = 3;
      const processingTimes: number[] = [];

      // Act
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const campaign = await createTestCampaign('LINKEDIN', ['SINGLE_IMAGE']);
        processingTimes.push(Date.now() - startTime);

        // Cleanup
        await cleanupTestCampaign(campaign.id);
      }

      // Assert
      const averageProcessingTime = processingTimes.reduce((a, b) => a + b) / iterations;
      expect(averageProcessingTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      
      // Verify processing times don't degrade
      for (let i = 1; i < processingTimes.length; i++) {
        expect(processingTimes[i]).toBeLessThan(PERFORMANCE_THRESHOLD);
      }
    }, TEST_TIMEOUT * 3);
  });
});