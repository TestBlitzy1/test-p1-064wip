import { useDispatch, useSelector } from 'react-redux'; // v9.0.0
import { useState, useCallback } from 'react'; // v18.0.0
import { getCampaignPerformance, getAnalyticsMetrics, getTimeSeriesData } from '../lib/api/analytics';
import { analyticsSlice } from '../store/analytics.slice';
import type { AnalyticsMetric, CampaignPerformance, MetricType, MetricTimeframe, AnalyticsTimeSeriesData } from '../types/analytics';
import type { DateRange } from '../types/common';
import type { ApiError } from '../types/api';

// Constants for configuration
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_CACHE_TTL = 60000; // 1 minute

interface UseAnalyticsOptions {
  refreshInterval?: number;
  batchSize?: number;
  retryAttempts?: number;
  cacheTTL?: number;
}

/**
 * Custom hook for managing analytics data and operations with optimized performance
 * @param options Configuration options for analytics operations
 */
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const dispatch = useDispatch();
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    batchSize = DEFAULT_BATCH_SIZE,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
    cacheTTL = DEFAULT_CACHE_TTL
  } = options;

  // Local state for loading and error handling
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Redux selectors
  const metrics = useSelector(state => state.analytics.currentMetrics);
  const selectedTimeframe = useSelector(state => state.analytics.selectedTimeframe);
  const selectedCampaigns = useSelector(state => state.analytics.selectedCampaigns);

  /**
   * Fetches campaign performance metrics with batching and caching
   */
  const fetchCampaignMetrics = useCallback(async (
    campaignIds: string[],
    period: DateRange,
    options: { compress?: boolean; forceFresh?: boolean } = {}
  ) => {
    try {
      setLoading(true);
      setError(null);

      const batchedIds = chunk(campaignIds, batchSize);
      const results: CampaignPerformance[] = [];

      for (const batch of batchedIds) {
        const response = await getCampaignPerformance(batch, period, {
          useCache: !options.forceFresh,
          cacheTTL
        });
        results.push(...response.data);
      }

      dispatch(analyticsSlice.actions.setCampaignPerformance(results));
      return results;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [dispatch, batchSize, cacheTTL]);

  /**
   * Fetches analytics metrics with real-time updates
   */
  const fetchAnalyticsMetrics = useCallback(async (
    metrics: MetricType[],
    timeframe: MetricTimeframe,
    period: DateRange
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await getAnalyticsMetrics({
        campaign_ids: selectedCampaigns,
        metrics,
        timeframe,
        period
      });

      dispatch(analyticsSlice.actions.setCurrentMetrics(response.data));
      return response.data;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [dispatch, selectedCampaigns]);

  /**
   * Fetches time series data with progressive loading
   */
  const fetchTimeSeriesData = useCallback(async (
    period: DateRange,
    metrics: MetricType[] = ['IMPRESSIONS', 'CLICKS', 'CONVERSIONS', 'CTR']
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await getTimeSeriesData({
        campaignIds: selectedCampaigns,
        metrics,
        timeframe: selectedTimeframe,
        period
      });

      dispatch(analyticsSlice.actions.setTimeSeriesData(response.data));
      return response.data;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [dispatch, selectedCampaigns, selectedTimeframe]);

  /**
   * Refreshes analytics data based on current selections
   */
  const refreshData = useCallback(async (period: DateRange) => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        fetchCampaignMetrics(selectedCampaigns, period, { forceFresh: true }),
        fetchTimeSeriesData(period)
      ]);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, [fetchCampaignMetrics, fetchTimeSeriesData, selectedCampaigns]);

  /**
   * Utility function to chunk arrays for batch processing
   */
  const chunk = <T>(array: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  };

  return {
    loading,
    error,
    metrics,
    fetchCampaignMetrics,
    fetchAnalyticsMetrics,
    fetchTimeSeriesData,
    refreshData
  };
}