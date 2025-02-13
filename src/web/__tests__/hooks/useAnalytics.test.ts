import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals'; // v29.7.0
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { getCampaignPerformance, getAnalyticsMetrics, getTimeSeriesData } from '../../src/lib/api/analytics';
import type { MetricType, MetricTimeframe, CampaignPerformance, AnalyticsMetric } from '../../types/analytics';
import type { DateRange } from '../../types/common';

// Mock the API functions
jest.mock('../../src/lib/api/analytics');

// Type-safe mock implementations
const mockGetCampaignPerformance = getCampaignPerformance as jest.MockedFunction<typeof getCampaignPerformance>;
const mockGetAnalyticsMetrics = getAnalyticsMetrics as jest.MockedFunction<typeof getAnalyticsMetrics>;
const mockGetTimeSeriesData = getTimeSeriesData as jest.MockedFunction<typeof getTimeSeriesData>;

// Test data
const testDateRange: DateRange = {
  startDate: '2023-01-01',
  endDate: '2023-12-31'
};

const testCampaignIds = ['campaign-1', 'campaign-2'];

const testMetrics: MetricType[] = ['IMPRESSIONS', 'CLICKS', 'CONVERSIONS', 'CTR'];

const testPerformanceData: CampaignPerformance[] = [
  {
    campaign_id: 'campaign-1',
    impressions: 1000,
    clicks: 100,
    conversions: 10,
    spend: 500,
    revenue: 1500,
    ctr: 0.1,
    cpc: 5,
    roas: 3,
    period: testDateRange
  }
];

describe('useAnalytics Hook', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockGetCampaignPerformance.mockResolvedValue({
      data: testPerformanceData,
      status: 200,
      message: 'Success'
    });

    mockGetAnalyticsMetrics.mockResolvedValue({
      data: [],
      status: 200,
      message: 'Success'
    });

    mockGetTimeSeriesData.mockResolvedValue({
      data: {
        timeframe: 'DAILY',
        metrics: [],
        period: testDateRange
      },
      status: 200,
      message: 'Success'
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should fetch campaign metrics with proper caching', async () => {
    const { result } = renderHook(() => useAnalytics({
      refreshInterval: 30000,
      cacheTTL: 60000
    }));

    // First call should hit the API
    await act(async () => {
      await result.current.fetchCampaignMetrics(testCampaignIds, testDateRange);
    });

    expect(mockGetCampaignPerformance).toHaveBeenCalledTimes(1);
    expect(mockGetCampaignPerformance).toHaveBeenCalledWith(
      testCampaignIds,
      testDateRange,
      expect.any(Object)
    );

    // Second call within cache TTL should use cached data
    await act(async () => {
      await result.current.fetchCampaignMetrics(testCampaignIds, testDateRange);
    });

    expect(mockGetCampaignPerformance).toHaveBeenCalledTimes(1);
  });

  it('should handle concurrent API requests efficiently', async () => {
    const { result } = renderHook(() => useAnalytics());

    // Simulate multiple concurrent requests
    await act(async () => {
      const promises = [
        result.current.fetchCampaignMetrics(testCampaignIds, testDateRange),
        result.current.fetchAnalyticsMetrics(testMetrics, 'DAILY', testDateRange),
        result.current.fetchTimeSeriesData(testDateRange)
      ];
      await Promise.all(promises);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle error states and recovery', async () => {
    const testError = new Error('API Error');
    mockGetCampaignPerformance.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useAnalytics({
      retryAttempts: 3
    }));

    await act(async () => {
      try {
        await result.current.fetchCampaignMetrics(testCampaignIds, testDateRange);
      } catch (error) {
        expect(error).toBe(testError);
      }
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.loading).toBe(false);

    // Test recovery after error
    mockGetCampaignPerformance.mockResolvedValueOnce({
      data: testPerformanceData,
      status: 200,
      message: 'Success'
    });

    await act(async () => {
      await result.current.fetchCampaignMetrics(testCampaignIds, testDateRange);
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle real-time data updates efficiently', async () => {
    const { result } = renderHook(() => useAnalytics({
      refreshInterval: 1000
    }));

    const startTime = Date.now();

    await act(async () => {
      await result.current.fetchTimeSeriesData(testDateRange, testMetrics);
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    expect(mockGetTimeSeriesData).toHaveBeenCalledWith({
      campaignIds: expect.any(Array),
      metrics: testMetrics,
      timeframe: expect.any(String),
      period: testDateRange
    });
  });

  it('should validate metric types and data integrity', async () => {
    const invalidMetrics: MetricType[] = ['INVALID_METRIC' as MetricType];
    
    const { result } = renderHook(() => useAnalytics());

    await act(async () => {
      try {
        await result.current.fetchAnalyticsMetrics(invalidMetrics, 'DAILY', testDateRange);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    expect(result.current.error).not.toBeNull();
  });
});