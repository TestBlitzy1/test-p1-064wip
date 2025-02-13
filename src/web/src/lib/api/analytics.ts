import { apiClient } from '../../utils/api-client'; // v1.6.x
import { cache } from 'memory-cache'; // v0.2.0
import type { AxiosResponse } from 'axios';
import type {
  AnalyticsMetric,
  AnalyticsFilter,
  CampaignPerformance,
  MetricType,
  AnalyticsResponse
} from '../../types/analytics';
import type { DateRange } from '../../types/common';
import type { ApiResponse, ApiError } from '../../types/api';

// Constants for configuration
const ANALYTICS_CACHE_TTL = 60 * 1000; // 1 minute cache TTL
const PERFORMANCE_TIMEOUT = 30 * 1000; // 30 seconds timeout
const BATCH_SIZE = 50; // Number of metrics to process in each batch
const MAX_RETRIES = 3;

// Cache key generators
const generateCacheKey = (endpoint: string, params: any): string => {
  return `analytics_${endpoint}_${JSON.stringify(params)}`;
};

// Interface for cache options
interface CacheOptions {
  enabled?: boolean;
  ttl?: number;
}

// Interface for batch processing options
interface BatchOptions {
  batchSize?: number;
  parallel?: boolean;
}

/**
 * Fetches performance metrics for specified campaigns within a date range
 * @param campaignIds - Array of campaign IDs to fetch metrics for
 * @param period - Date range for the metrics
 * @param cacheOptions - Optional caching configuration
 * @returns Promise resolving to campaign performance data
 */
export async function getCampaignPerformance(
  campaignIds: string[],
  period: DateRange,
  cacheOptions: CacheOptions = { enabled: true, ttl: ANALYTICS_CACHE_TTL }
): Promise<ApiResponse<CampaignPerformance[]>> {
  // Input validation
  if (!campaignIds.length) {
    throw new Error('At least one campaign ID is required');
  }

  // Generate cache key
  const cacheKey = generateCacheKey('performance', { campaignIds, period });

  // Check cache if enabled
  if (cacheOptions.enabled) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  try {
    // Set request timeout for performance
    apiClient.setRequestTimeout(PERFORMANCE_TIMEOUT);

    // Make API request
    const response = await apiClient.get<CampaignPerformance[]>('/analytics/performance', {
      params: {
        campaign_ids: campaignIds,
        start_date: period.startDate,
        end_date: period.endDate
      }
    });

    // Cache the response if enabled
    if (cacheOptions.enabled) {
      cache.put(cacheKey, response, cacheOptions.ttl || ANALYTICS_CACHE_TTL);
    }

    return response;
  } catch (error) {
    throw new Error(`Failed to fetch campaign performance: ${(error as ApiError).message}`);
  }
}

/**
 * Retrieves analytics metrics based on provided filters with batch processing
 * @param filter - Analytics filter parameters
 * @param batchOptions - Optional batch processing configuration
 * @returns Promise resolving to filtered analytics metrics
 */
export async function getAnalyticsMetrics(
  filter: AnalyticsFilter,
  batchOptions: BatchOptions = { batchSize: BATCH_SIZE, parallel: true }
): Promise<ApiResponse<AnalyticsMetric[]>> {
  // Validate filter parameters
  if (!filter.metrics.length || !filter.campaign_ids.length) {
    throw new Error('Metrics and campaign IDs are required');
  }

  try {
    // Process metrics in batches
    const batches = chunk(filter.campaign_ids, batchOptions.batchSize || BATCH_SIZE);
    const batchPromises = batches.map(async (batchIds) => {
      const response = await apiClient.post<AnalyticsMetric[]>('/analytics/metrics', {
        campaign_ids: batchIds,
        metrics: filter.metrics,
        timeframe: filter.timeframe,
        period: filter.period
      });
      return response.data;
    });

    // Execute batch requests
    const batchResults = batchOptions.parallel
      ? await Promise.all(batchPromises)
      : await processSequentially(batchPromises);

    // Combine and validate results
    const metrics = batchResults.flat();
    validateMetrics(metrics, filter.metrics);

    return {
      data: metrics,
      status: 200,
      message: 'Analytics metrics retrieved successfully'
    };
  } catch (error) {
    throw new Error(`Failed to fetch analytics metrics: ${(error as ApiError).message}`);
  }
}

/**
 * Validates retrieved metrics against expected metric types
 * @param metrics - Retrieved analytics metrics
 * @param expectedTypes - Expected metric types
 */
function validateMetrics(metrics: AnalyticsMetric[], expectedTypes: MetricType[]): void {
  const invalidMetrics = metrics.filter(metric => !expectedTypes.includes(metric.type));
  if (invalidMetrics.length) {
    throw new Error(`Invalid metric types found: ${invalidMetrics.map(m => m.type).join(', ')}`);
  }
}

/**
 * Processes promises sequentially to prevent rate limiting
 * @param promises - Array of promises to process
 * @returns Promise resolving to array of results
 */
async function processSequentially<T>(promises: Promise<T>[]): Promise<T[]> {
  const results: T[] = [];
  for (const promise of promises) {
    results.push(await promise);
  }
  return results;
}

/**
 * Splits array into chunks for batch processing
 * @param array - Array to split
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}