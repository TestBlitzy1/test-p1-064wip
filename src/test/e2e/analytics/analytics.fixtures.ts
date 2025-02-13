import { faker } from '@faker-js/faker'; // ^8.0.0
import { CampaignMetrics } from '../../../web/src/types/analytics';
import { testApiClient } from '../utils/test-client';
import { mockCampaignMetrics } from '../../mocks/data/analytics.mock';

// Test campaign IDs for consistent data generation
export const TEST_CAMPAIGN_IDS = ['test-campaign-1', 'test-campaign-2'];

// Supported ad platforms for testing
export const TEST_PLATFORMS = ['linkedin', 'google'] as const;

// Metric validation ranges based on platform benchmarks
export const METRIC_RANGES = {
  impressions: { min: 1000, max: 100000 },
  clicks: { min: 50, max: 5000 },
  conversions: { min: 1, max: 500 },
  ctr: {
    linkedin: { min: 0.01, max: 0.05 },
    google: { min: 0.02, max: 0.07 }
  },
  cpc: {
    linkedin: { min: 2, max: 8 },
    google: { min: 1, max: 5 }
  },
  roas: { min: 2, max: 5 }
};

/**
 * Creates test campaign metrics with platform-specific benchmarks
 * @param campaignId - Campaign identifier
 * @param platform - Ad platform (linkedin/google)
 * @param options - Optional configuration for metrics generation
 */
export async function createTestCampaignMetrics(
  campaignId: string,
  platform: typeof TEST_PLATFORMS[number],
  options: {
    dateOffset?: number;
    customRanges?: Partial<typeof METRIC_RANGES>;
    skipValidation?: boolean;
  } = {}
): Promise<CampaignMetrics> {
  // Generate base metrics using mock generator
  const baseMetrics = mockCampaignMetrics.generateMockMetrics(campaignId, platform);

  // Apply platform-specific adjustments
  const metrics: CampaignMetrics = {
    ...baseMetrics,
    timestamp: new Date(Date.now() - (options.dateOffset || 0)).toISOString(),
    campaign_id: campaignId,
    platform,
    ctr: baseMetrics.clicks / baseMetrics.impressions,
    cpc: baseMetrics.spend / baseMetrics.clicks,
    roas: baseMetrics.revenue / baseMetrics.spend
  };

  // Validate metrics against ranges unless skipped
  if (!options.skipValidation) {
    validateMetricRanges(metrics, platform);
    validateMetricRelationships(metrics);
  }

  // Store metrics in test API
  try {
    await testApiClient.post('/api/analytics/metrics', {
      metrics,
      test_data: true
    });
  } catch (error) {
    throw new Error(`Failed to store test metrics: ${error.message}`);
  }

  return metrics;
}

/**
 * Sets up complete test analytics data with time-series and trends
 * @param setupOptions - Configuration for test data setup
 */
export async function setupTestAnalyticsData(
  setupOptions: {
    campaigns?: string[];
    platforms?: Array<typeof TEST_PLATFORMS[number]>;
    timeRanges?: Array<'hourly' | 'daily' | 'weekly'>;
    trendSimulation?: boolean;
  } = {}
): Promise<void> {
  const campaigns = setupOptions.campaigns || TEST_CAMPAIGN_IDS;
  const platforms = setupOptions.platforms || TEST_PLATFORMS;
  const timeRanges = setupOptions.timeRanges || ['hourly', 'daily', 'weekly'];

  try {
    // Clear existing test data
    await cleanupTestAnalyticsData();

    // Generate metrics for each campaign and platform
    for (const campaignId of campaigns) {
      for (const platform of platforms) {
        // Generate time-series data
        for (const range of timeRanges) {
          const dataPoints = range === 'hourly' ? 24 : range === 'daily' ? 30 : 12;
          const offsetUnit = range === 'hourly' ? 3600000 : range === 'daily' ? 86400000 : 604800000;

          for (let i = 0; i < dataPoints; i++) {
            await createTestCampaignMetrics(campaignId, platform, {
              dateOffset: i * offsetUnit,
              skipValidation: false
            });
          }
        }

        // Generate trend data if requested
        if (setupOptions.trendSimulation) {
          await generateTrendData(campaignId, platform);
        }
      }
    }

    // Verify data setup
    await verifyTestDataSetup(campaigns, platforms);

  } catch (error) {
    throw new Error(`Failed to setup test analytics data: ${error.message}`);
  }
}

/**
 * Performs comprehensive cleanup of test analytics data
 * @param cleanupOptions - Configuration for cleanup process
 */
export async function cleanupTestAnalyticsData(
  cleanupOptions: {
    retainCampaigns?: string[];
    deleteSnapshots?: boolean;
  } = {}
): Promise<void> {
  try {
    // Delete test metrics data
    await testApiClient.delete('/api/analytics/metrics', {
      data: {
        test_data: true,
        exclude_campaigns: cleanupOptions.retainCampaigns
      }
    });

    // Delete performance snapshots if requested
    if (cleanupOptions.deleteSnapshots) {
      await testApiClient.delete('/api/analytics/snapshots', {
        data: { test_data: true }
      });
    }

    // Verify cleanup
    const verificationResponse = await testApiClient.get('/api/analytics/metrics', {
      params: { test_data: true }
    });

    if (verificationResponse.data.metrics?.length > 0) {
      throw new Error('Test data cleanup verification failed');
    }

  } catch (error) {
    throw new Error(`Failed to cleanup test analytics data: ${error.message}`);
  }
}

/**
 * Validates metric ranges against platform-specific benchmarks
 */
function validateMetricRanges(
  metrics: CampaignMetrics,
  platform: typeof TEST_PLATFORMS[number]
): void {
  const { impressions, clicks, conversions, ctr, cpc, roas } = metrics;

  if (impressions < METRIC_RANGES.impressions.min || impressions > METRIC_RANGES.impressions.max) {
    throw new Error(`Invalid impressions range: ${impressions}`);
  }

  if (clicks < METRIC_RANGES.clicks.min || clicks > METRIC_RANGES.clicks.max) {
    throw new Error(`Invalid clicks range: ${clicks}`);
  }

  if (conversions < METRIC_RANGES.conversions.min || conversions > METRIC_RANGES.conversions.max) {
    throw new Error(`Invalid conversions range: ${conversions}`);
  }

  if (ctr < METRIC_RANGES.ctr[platform].min || ctr > METRIC_RANGES.ctr[platform].max) {
    throw new Error(`Invalid CTR range for ${platform}: ${ctr}`);
  }

  if (cpc < METRIC_RANGES.cpc[platform].min || cpc > METRIC_RANGES.cpc[platform].max) {
    throw new Error(`Invalid CPC range for ${platform}: ${cpc}`);
  }

  if (roas < METRIC_RANGES.roas.min || roas > METRIC_RANGES.roas.max) {
    throw new Error(`Invalid ROAS range: ${roas}`);
  }
}

/**
 * Validates relationships between metrics
 */
function validateMetricRelationships(metrics: CampaignMetrics): void {
  const { impressions, clicks, conversions, spend, revenue } = metrics;

  if (clicks > impressions) {
    throw new Error('Clicks cannot exceed impressions');
  }

  if (conversions > clicks) {
    throw new Error('Conversions cannot exceed clicks');
  }

  if (revenue < spend) {
    throw new Error('Revenue should be greater than spend for positive ROAS');
  }
}

/**
 * Generates trend data for visualization testing
 */
async function generateTrendData(
  campaignId: string,
  platform: typeof TEST_PLATFORMS[number]
): Promise<void> {
  const trendTypes = ['improving', 'declining', 'stable'];
  const metrics = ['ctr', 'cpc', 'roas'];

  for (const trend of trendTypes) {
    for (const metric of metrics) {
      const baseMetric = await createTestCampaignMetrics(campaignId, platform);
      const trendFactor = trend === 'improving' ? 1.1 : trend === 'declining' ? 0.9 : 1;

      for (let i = 1; i <= 7; i++) {
        await createTestCampaignMetrics(campaignId, platform, {
          dateOffset: i * 86400000,
          customRanges: {
            [metric]: {
              min: baseMetric[metric] * Math.pow(trendFactor, i),
              max: baseMetric[metric] * Math.pow(trendFactor, i) * 1.1
            }
          }
        });
      }
    }
  }
}

/**
 * Verifies test data setup completion
 */
async function verifyTestDataSetup(
  campaigns: string[],
  platforms: Array<typeof TEST_PLATFORMS[number]>
): Promise<void> {
  for (const campaignId of campaigns) {
    for (const platform of platforms) {
      const response = await testApiClient.get('/api/analytics/metrics', {
        params: {
          campaign_id: campaignId,
          platform,
          test_data: true
        }
      });

      if (!response.data.metrics?.length) {
        throw new Error(`Verification failed for campaign ${campaignId} on ${platform}`);
      }
    }
  }
}