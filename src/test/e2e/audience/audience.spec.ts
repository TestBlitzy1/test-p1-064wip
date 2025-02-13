import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { testApiClient } from '../utils/test-client';
import { 
  createValidAudienceSegment, 
  createInvalidAudienceSegment,
  PLATFORM_CONSTRAINTS 
} from './audience.fixtures';
import type { IAudienceSegment } from '../../../web/src/types/targeting';

// API endpoint base URL
const API_BASE_URL = '/api/v1/audience';

// Platform-specific audience size constraints
const PLATFORM_CONFIGS = {
  linkedin: { minSize: 1000, maxSize: 1000000 },
  google: { minSize: 500, maxSize: 500000 }
};

describe('Audience Segmentation API', () => {
  // Clean up test data after each test
  afterEach(async () => {
    try {
      const response = await testApiClient.get<{ segments: IAudienceSegment[] }>(`${API_BASE_URL}/segments`);
      for (const segment of response.data.segments) {
        await testApiClient.delete(`${API_BASE_URL}/segments/${segment.id}`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('AI-Powered Segmentation', () => {
    it('should create and optimize audience segment with AI recommendations', async () => {
      // Create initial segment
      const initialSegment = createValidAudienceSegment({
        aiOptimizationEnabled: true,
        platform: 'linkedin'
      });

      const createResponse = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        initialSegment
      );

      expect(createResponse.status).toBe(201);
      expect(createResponse.data.id).toBeDefined();
      expect(createResponse.data.aiOptimizationEnabled).toBe(true);

      // Request AI optimization
      const optimizeResponse = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments/${createResponse.data.id}/optimize`,
        {
          targetMetric: 'reach',
          minConfidence: 0.7
        }
      );

      expect(optimizeResponse.status).toBe(200);
      expect(optimizeResponse.data.metadata?.performanceScore).toBeGreaterThan(0);
      expect(optimizeResponse.data.metadata?.lastOptimized).toBeDefined();
    });

    it('should validate and apply AI-suggested targeting rules', async () => {
      const segment = createValidAudienceSegment({
        platform: 'linkedin',
        targetingRules: []
      });

      // Create base segment
      const createResponse = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        segment
      );

      // Get AI suggestions
      const suggestionsResponse = await testApiClient.get<{suggestions: Array<{rule: any, confidence: number}>}>(
        `${API_BASE_URL}/segments/${createResponse.data.id}/suggestions`
      );

      expect(suggestionsResponse.status).toBe(200);
      expect(suggestionsResponse.data.suggestions.length).toBeGreaterThan(0);

      // Apply suggestions
      const updatedRules = suggestionsResponse.data.suggestions
        .filter(s => s.confidence > 0.8)
        .map(s => s.rule);

      const updateResponse = await testApiClient.put<IAudienceSegment>(
        `${API_BASE_URL}/segments/${createResponse.data.id}`,
        {
          ...createResponse.data,
          targetingRules: updatedRules
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.targetingRules.length).toBeGreaterThan(0);
    });
  });

  describe('Platform-Specific Validation', () => {
    it('should enforce LinkedIn audience size constraints', async () => {
      const invalidSegment = createInvalidAudienceSegment('size', 'linkedin');

      const response = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        invalidSegment
      );

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        error: 'INVALID_AUDIENCE_SIZE',
        details: {
          platform: 'linkedin',
          minSize: PLATFORM_CONFIGS.linkedin.minSize,
          maxSize: PLATFORM_CONFIGS.linkedin.maxSize
        }
      });
    });

    it('should enforce Google Ads targeting rule limits', async () => {
      const invalidSegment = createInvalidAudienceSegment('rules', 'google');

      const response = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        invalidSegment
      );

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        error: 'EXCEEDED_RULE_LIMIT',
        details: {
          platform: 'google',
          maxRules: PLATFORM_CONSTRAINTS.google.maxTargetingRules
        }
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle segment synchronization across platforms', async () => {
      const linkedinSegment = createValidAudienceSegment({
        platform: 'linkedin'
      });

      // Create LinkedIn segment
      const linkedinResponse = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        linkedinSegment
      );

      // Sync to Google Ads
      const syncResponse = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments/${linkedinResponse.data.id}/sync`,
        { targetPlatform: 'google' }
      );

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.data.platform).toBe('google');
      expect(syncResponse.data.targetingRules).toHaveLength(
        linkedinResponse.data.targetingRules.length
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should track and report segment performance metrics', async () => {
      const segment = createValidAudienceSegment();
      
      // Create segment
      const createResponse = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        segment
      );

      // Get performance metrics
      const metricsResponse = await testApiClient.get(
        `${API_BASE_URL}/segments/${createResponse.data.id}/metrics`
      );

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.data).toMatchObject({
        reach: expect.any(Number),
        engagement: expect.any(Number),
        conversion: expect.any(Number),
        costPerResult: expect.any(Number),
        confidence: expect.any(Number)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const invalidId = 'non-existent-id';

      const response = await testApiClient.get(
        `${API_BASE_URL}/segments/${invalidId}`
      );

      expect(response.status).toBe(404);
      expect(response.data).toMatchObject({
        error: 'SEGMENT_NOT_FOUND',
        message: expect.any(String)
      });
    });

    it('should validate segment format requirements', async () => {
      const invalidSegment = createInvalidAudienceSegment('format', 'linkedin');

      const response = await testApiClient.post<IAudienceSegment>(
        `${API_BASE_URL}/segments`,
        invalidSegment
      );

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        error: 'INVALID_FORMAT',
        details: {
          name: expect.any(String),
          description: expect.any(String)
        }
      });
    });
  });
});