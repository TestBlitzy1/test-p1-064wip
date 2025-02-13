import { jest } from 'jest'; // ^29.0.0
import supertest from 'supertest'; // ^2.0.0
import { IntegrationTestFixture } from '../utils/test-helpers';
import { mockCampaignMetrics, mockPerformanceData } from '../../mocks/data/analytics.mock';
import type { 
  AnalyticsResponse, 
  CampaignPerformance,
  AnalyticsTimeSeriesData,
  MetricTimeframe 
} from '../../../web/src/types/analytics';
import type { DateRange } from '../../../web/src/types/common';

// Test configuration constants
const TEST_TIMEOUT = 30000; // 30 seconds
const MOCK_CAMPAIGN_ID = 'test-campaign-123';
const PERFORMANCE_THRESHOLDS = {
  CTR: 0.5, // 0.5% minimum CTR
  CPC: 5.0, // Maximum $5 CPC
  ROAS: 2.0 // Minimum 2x ROAS
};

/**
 * Integration test suite for analytics service reporting functionality
 */
@jest.describe('Analytics Service - Reporting Integration Tests')
class ReportingTestSuite {
  private _fixture: IntegrationTestFixture;
  private _request: supertest.SuperTest<supertest.Test>;
  private _dateRange: DateRange;

  constructor() {
    this._fixture = new IntegrationTestFixture();
    jest.setTimeout(TEST_TIMEOUT);
    this._dateRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
      endDate: new Date().toISOString()
    };
  }

  @jest.beforeAll()
  async setup(): Promise<void> {
    await this._fixture.setup();
    this._request = supertest('http://localhost:3000/api/v1');
    await this.setupTestData();
  }

  @jest.afterAll()
  async teardown(): Promise<void> {
    await this._fixture.teardown();
  }

  /**
   * Tests real-time analytics capabilities including response times and data freshness
   */
  @jest.test('should retrieve real-time analytics data within performance SLA')
  async testRealTimeAnalytics(): Promise<void> {
    // Test real-time data retrieval
    const startTime = Date.now();
    const response = await this._request
      .get(`/analytics/realtime/${MOCK_CAMPAIGN_ID}`)
      .expect(200);

    // Verify response time is within SLA (< 1 second)
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(1000);

    // Verify data freshness
    const analyticsResponse = response.body as AnalyticsResponse;
    const dataTimestamp = new Date(analyticsResponse.timestamp).getTime();
    const timeDifference = Date.now() - dataTimestamp;
    expect(timeDifference).toBeLessThan(30000); // Data should be < 30 seconds old

    // Verify data structure and completeness
    expect(analyticsResponse.data.performance).toBeDefined();
    expect(analyticsResponse.data.timeSeries).toBeDefined();
  }

  /**
   * Tests comprehensive performance metrics calculation and validation
   */
  @jest.test('should calculate accurate performance metrics')
  async testPerformanceMetrics(): Promise<void> {
    const response = await this._request
      .get(`/analytics/performance/${MOCK_CAMPAIGN_ID}`)
      .query({ period: this._dateRange })
      .expect(200);

    const performance = response.body.data.performance as CampaignPerformance[];
    expect(performance).toHaveLength(1);

    const metrics = performance[0];
    
    // Verify metric calculations
    expect(metrics.ctr).toBeGreaterThan(PERFORMANCE_THRESHOLDS.CTR);
    expect(metrics.cpc).toBeLessThan(PERFORMANCE_THRESHOLDS.CPC);
    expect(metrics.roas).toBeGreaterThan(PERFORMANCE_THRESHOLDS.ROAS);

    // Verify metric relationships
    expect(metrics.clicks).toBeLessThanOrEqual(metrics.impressions);
    expect(metrics.conversions).toBeLessThanOrEqual(metrics.clicks);
    expect(metrics.revenue).toBeGreaterThan(metrics.spend);
  }

  /**
   * Tests trend analysis and time series data aggregation
   */
  @jest.test('should analyze trends across different timeframes')
  async testTrendAnalysis(): Promise<void> {
    const timeframes: MetricTimeframe[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

    for (const timeframe of timeframes) {
      const response = await this._request
        .get(`/analytics/trends/${MOCK_CAMPAIGN_ID}`)
        .query({ 
          timeframe,
          ...this._dateRange
        })
        .expect(200);

      const timeSeries = response.body.data.timeSeries as AnalyticsTimeSeriesData;
      
      // Verify time series data structure
      expect(timeSeries.timeframe).toBe(timeframe);
      expect(timeSeries.period).toEqual(this._dateRange);
      expect(timeSeries.metrics.length).toBeGreaterThan(0);

      // Verify metric consistency across time periods
      const metrics = timeSeries.metrics;
      metrics.forEach(metric => {
        expect(metric.campaign_id).toBe(MOCK_CAMPAIGN_ID);
        expect(metric.value).toBeGreaterThanOrEqual(0);
        expect(new Date(metric.timestamp)).toBeInstanceOf(Date);
      });
    }
  }

  /**
   * Tests concurrent report generation capabilities
   */
  @jest.test('should handle concurrent report generation')
  async testConcurrentReports(): Promise<void> {
    const concurrentRequests = 5;
    const requests = Array(concurrentRequests).fill(null).map(() => 
      this._request
        .get(`/analytics/performance/${MOCK_CAMPAIGN_ID}`)
        .query({ period: this._dateRange })
    );

    const responses = await Promise.all(requests);
    
    // Verify all concurrent requests succeeded
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.data.performance).toBeDefined();
    });
  }

  /**
   * Sets up test data for analytics testing
   */
  private async setupTestData(): Promise<void> {
    // Generate mock campaign metrics
    const metrics = mockCampaignMetrics.generateMockMetrics(
      MOCK_CAMPAIGN_ID,
      'linkedin'
    );

    // Generate mock performance data
    const performanceData = mockPerformanceData.generateMockPerformanceData(
      MOCK_CAMPAIGN_ID,
      'linkedin',
      this._dateRange
    );

    // Store test data in test database
    await this._fixture.getState().dbConnection.query(
      'INSERT INTO analytics_metrics (campaign_id, metrics, performance_data) VALUES ($1, $2, $3)',
      [MOCK_CAMPAIGN_ID, metrics, performanceData]
    );
  }
}

export default ReportingTestSuite;