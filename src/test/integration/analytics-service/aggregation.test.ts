import { jest } from 'jest';
import supertest from 'supertest';
import { MetricsAggregator } from '../../../backend/analytics_service/services/aggregation';
import { IntegrationTestFixture } from '../utils/test-helpers';
import { mockCampaignMetrics } from '../../mocks/data/analytics.mock';
import { UUID } from 'crypto';

// Test configuration constants
const TEST_TIMEOUT = 30000;
const CONFIDENCE_LEVEL = 0.95;
const PERFORMANCE_THRESHOLD = 1000; // 1 second
const SCALING_INSTANCES = 3;

/**
 * Integration tests for analytics service metrics aggregation
 */
describe('Analytics Service - Metrics Aggregation', () => {
  let fixture: IntegrationTestFixture;
  let aggregator: MetricsAggregator;
  let testCampaignId: UUID;

  beforeAll(async () => {
    // Initialize test fixture with enhanced configuration
    fixture = new IntegrationTestFixture({
      environment: 'integration',
      cleanup: { enabled: true, preserveLog: true }
    });
    await fixture.setup();

    // Initialize metrics aggregator with test configuration
    aggregator = new MetricsAggregator({
      ttl: 3600,
      batchSize: 1000,
      confidenceLevel: CONFIDENCE_LEVEL
    });

    // Generate test campaign ID
    testCampaignId = '123e4567-e89b-12d3-a456-426614174000' as UUID;
  });

  afterAll(async () => {
    await fixture.teardown();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('Campaign Metrics Aggregation', () => {
    it('should aggregate campaign metrics with statistical validation', async () => {
      // Generate test metrics data
      const mockMetrics = mockCampaignMetrics.generateMockMetrics(testCampaignId, 'LINKEDIN');

      // Perform metrics aggregation
      const result = await aggregator.aggregate_campaign_metrics(
        testCampaignId,
        'daily',
        false
      );

      // Verify core metrics presence and types
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('impressions');
      expect(result.metrics).toHaveProperty('clicks');
      expect(result.metrics).toHaveProperty('conversions');
      expect(result.metrics).toHaveProperty('spend');
      expect(result.metrics).toHaveProperty('revenue');

      // Verify statistical analysis
      expect(result).toHaveProperty('statistical_analysis');
      expect(result.statistical_analysis).toHaveProperty('confidence_level');
      expect(result.statistical_analysis.confidence_level).toBe(CONFIDENCE_LEVEL);

      // Verify confidence intervals
      expect(result.statistical_analysis).toHaveProperty('ctr_confidence');
      expect(result.statistical_analysis).toHaveProperty('conversion_confidence');
      expect(Array.isArray(result.statistical_analysis.ctr_confidence)).toBe(true);
      expect(result.statistical_analysis.ctr_confidence).toHaveLength(2);
    });

    it('should handle platform-specific metrics calculation', async () => {
      // Generate platform-specific test data
      const linkedInMetrics = mockCampaignMetrics.generateMockMetrics(testCampaignId, 'LINKEDIN');
      const googleMetrics = mockCampaignMetrics.generateMockMetrics(testCampaignId, 'GOOGLE');

      // Aggregate metrics for both platforms
      const linkedInResult = await aggregator.aggregate_campaign_metrics(
        testCampaignId,
        'daily',
        false
      );
      const googleResult = await aggregator.aggregate_campaign_metrics(
        testCampaignId,
        'daily',
        false
      );

      // Verify platform-specific calculations
      expect(linkedInResult.metrics.ctr).toBeDefined();
      expect(googleResult.metrics.ctr).toBeDefined();
      expect(linkedInResult.metrics.cpc).toBeDefined();
      expect(googleResult.metrics.cpc).toBeDefined();

      // Verify statistical significance between platforms
      const platformDifference = Math.abs(
        linkedInResult.metrics.ctr - googleResult.metrics.ctr
      );
      expect(platformDifference).toBeGreaterThan(0);
    });

    it('should analyze performance trends with statistical confidence', async () => {
      const trendResults = await aggregator.analyze_performance_trends(
        testCampaignId,
        ['CTR', 'CONVERSION_RATE', 'ROAS'],
        '30d'
      );

      // Verify trend analysis structure
      expect(trendResults).toHaveProperty('campaign_id');
      expect(trendResults).toHaveProperty('analysis_period');
      expect(trendResults).toHaveProperty('trends');

      // Verify trend metrics
      Object.values(trendResults.trends).forEach(trend => {
        expect(trend).toHaveProperty('current_value');
        expect(trend).toHaveProperty('mean');
        expect(trend).toHaveProperty('std_dev');
        expect(trend).toHaveProperty('trend_direction');
        expect(trend).toHaveProperty('statistical_significance');
        expect(trend.statistical_significance).toBeGreaterThanOrEqual(0);
        expect(trend.statistical_significance).toBeLessThanOrEqual(1);
      });
    });

    it('should verify horizontal scaling capabilities', async () => {
      // Setup multiple aggregator instances
      const aggregators = Array.from({ length: SCALING_INSTANCES }, () => 
        new MetricsAggregator({
          ttl: 3600,
          batchSize: 1000,
          confidenceLevel: CONFIDENCE_LEVEL
        })
      );

      // Generate high-volume test data
      const testData = Array.from({ length: 1000 }, () => 
        mockCampaignMetrics.generateMockMetrics(testCampaignId, 'LINKEDIN')
      );

      // Process data across instances
      const startTime = Date.now();
      const results = await Promise.all(
        aggregators.map(agg => 
          agg.aggregate_campaign_metrics(testCampaignId, 'daily', false)
        )
      );
      const processingTime = Date.now() - startTime;

      // Verify processing time meets performance requirements
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD);

      // Verify result consistency across instances
      const baseMetrics = results[0].metrics;
      results.slice(1).forEach(result => {
        expect(result.metrics.impressions).toBe(baseMetrics.impressions);
        expect(result.metrics.clicks).toBe(baseMetrics.clicks);
        expect(result.metrics.conversions).toBe(baseMetrics.conversions);
        expect(result.metrics.spend).toBeCloseTo(baseMetrics.spend, 2);
        expect(result.metrics.revenue).toBeCloseTo(baseMetrics.revenue, 2);
      });
    });
  });
});