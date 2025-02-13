import { describe, beforeAll, afterAll, it, expect } from '@jest/globals'; // v29.0.0
import { analyticsFixtures } from './analytics.fixtures';
import { testApiClient } from '../utils/test-client';
import { CampaignMetrics } from '../../../web/src/types/analytics';

// Test timeout for long-running analytics operations
const TEST_TIMEOUT = 30000;

/**
 * Validates the structure and calculations of metrics API response
 * @param response Analytics metrics response object
 */
const validateMetricsResponse = (response: CampaignMetrics): void => {
  // Verify all required metrics are present
  expect(response).toHaveProperty('impressions');
  expect(response).toHaveProperty('clicks');
  expect(response).toHaveProperty('conversions');
  expect(response).toHaveProperty('spend');
  expect(response).toHaveProperty('revenue');
  expect(response).toHaveProperty('roas');

  // Validate numeric data types
  expect(typeof response.impressions).toBe('number');
  expect(typeof response.clicks).toBe('number');
  expect(typeof response.conversions).toBe('number');
  expect(typeof response.spend).toBe('number');
  expect(typeof response.revenue).toBe('number');
  expect(typeof response.roas).toBe('number');

  // Validate metric relationships
  expect(response.clicks).toBeLessThanOrEqual(response.impressions);
  expect(response.conversions).toBeLessThanOrEqual(response.clicks);
  expect(response.revenue).toBeGreaterThanOrEqual(0);

  // Validate calculated metrics
  const calculatedCTR = response.clicks / response.impressions;
  expect(calculatedCTR).toBeGreaterThan(0);
  expect(calculatedCTR).toBeLessThanOrEqual(1);

  const calculatedROAS = response.revenue / response.spend;
  expect(calculatedROAS).toBe(response.roas);
};

describe('Campaign Analytics E2E Tests', () => {
  beforeAll(async () => {
    // Setup test analytics data with various time ranges and platforms
    await analyticsFixtures.setupTestAnalyticsData({
      timeRanges: ['hourly', 'daily', 'weekly'],
      platforms: ['linkedin', 'google'],
      trendSimulation: true
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await analyticsFixtures.cleanupTestAnalyticsData({
      deleteSnapshots: true
    });
  });

  it('should retrieve campaign metrics successfully', async () => {
    const response = await testApiClient.get('/api/analytics/metrics', {
      params: {
        campaign_id: 'test-campaign-1',
        platform: 'linkedin'
      }
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    validateMetricsResponse(response.data);
  });

  it('should aggregate metrics by time period', async () => {
    const timeframes = ['daily', 'weekly', 'monthly'];
    
    for (const timeframe of timeframes) {
      const response = await testApiClient.get('/api/analytics/metrics/aggregate', {
        params: {
          campaign_id: 'test-campaign-1',
          timeframe,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.metrics).toBeInstanceOf(Array);
      expect(response.data.metrics.length).toBeGreaterThan(0);

      // Validate each aggregated metric
      response.data.metrics.forEach(validateMetricsResponse);

      // Verify aggregation consistency
      if (timeframe === 'weekly') {
        expect(response.data.metrics.length).toBeLessThanOrEqual(5); // ~4 weeks in a month
      } else if (timeframe === 'monthly') {
        expect(response.data.metrics.length).toBe(1);
      }
    }
  });

  it('should filter metrics by platform', async () => {
    const platforms = ['linkedin', 'google'];

    for (const platform of platforms) {
      const response = await testApiClient.get('/api/analytics/metrics', {
        params: {
          campaign_id: 'test-campaign-1',
          platform
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.platform).toBe(platform);
      validateMetricsResponse(response.data);

      // Verify platform-specific metrics
      if (platform === 'linkedin') {
        expect(response.data.ctr).toBeGreaterThanOrEqual(0.01); // LinkedIn benchmark
        expect(response.data.ctr).toBeLessThanOrEqual(0.05);
      } else {
        expect(response.data.ctr).toBeGreaterThanOrEqual(0.02); // Google benchmark
        expect(response.data.ctr).toBeLessThanOrEqual(0.07);
      }
    }
  });

  it('should handle real-time metric updates', async () => {
    // Get initial metrics
    const initialResponse = await testApiClient.get('/api/analytics/metrics', {
      params: {
        campaign_id: 'test-campaign-1',
        platform: 'linkedin'
      }
    });

    // Post new metric data
    const newMetrics = {
      impressions: initialResponse.data.impressions + 1000,
      clicks: initialResponse.data.clicks + 50,
      conversions: initialResponse.data.conversions + 5,
      spend: initialResponse.data.spend + 100,
      revenue: initialResponse.data.revenue + 300
    };

    await testApiClient.post('/api/analytics/metrics', {
      campaign_id: 'test-campaign-1',
      platform: 'linkedin',
      metrics: newMetrics
    });

    // Verify immediate update
    const updatedResponse = await testApiClient.get('/api/analytics/metrics', {
      params: {
        campaign_id: 'test-campaign-1',
        platform: 'linkedin'
      }
    });

    expect(updatedResponse.status).toBe(200);
    expect(updatedResponse.data.impressions).toBe(newMetrics.impressions);
    expect(updatedResponse.data.clicks).toBe(newMetrics.clicks);
    expect(updatedResponse.data.conversions).toBe(newMetrics.conversions);
    expect(updatedResponse.data.spend).toBe(newMetrics.spend);
    expect(updatedResponse.data.revenue).toBe(newMetrics.revenue);

    // Validate recalculated metrics
    validateMetricsResponse(updatedResponse.data);
  });
});