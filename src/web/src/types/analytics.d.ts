import { BaseResponse, DateRange } from './common';
import { Campaign } from './campaigns';

/**
 * Timeframe granularity for metric aggregation
 * @version 1.0.0
 */
export type MetricTimeframe = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/**
 * Supported metric types for analytics tracking
 * @version 1.0.0
 */
export type MetricType = 
  | 'IMPRESSIONS'  // Number of ad views
  | 'CLICKS'       // Number of ad clicks
  | 'CONVERSIONS'  // Number of successful conversions
  | 'SPEND'        // Total ad spend
  | 'REVENUE'      // Total revenue generated
  | 'CTR'          // Click-through rate
  | 'CPC'          // Cost per click
  | 'ROAS';        // Return on ad spend

/**
 * Supported chart visualization types
 * @version 1.0.0
 */
export type ChartType = 'LINE' | 'BAR' | 'PIE' | 'AREA' | 'SCATTER';

/**
 * Individual analytics metric data point
 * @interface AnalyticsMetric
 */
export interface AnalyticsMetric {
  type: MetricType;
  value: number;
  timestamp: string;
  campaign_id: string;
}

/**
 * Comprehensive campaign performance metrics
 * @interface CampaignPerformance
 */
export interface CampaignPerformance {
  campaign_id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;      // Click-through rate (percentage)
  cpc: number;      // Cost per click (currency)
  roas: number;     // Return on ad spend (ratio)
  period: DateRange;
}

/**
 * Time-series analytics data structure
 * @interface AnalyticsTimeSeriesData
 */
export interface AnalyticsTimeSeriesData {
  timeframe: MetricTimeframe;
  metrics: AnalyticsMetric[];
  period: DateRange;
}

/**
 * Chart configuration for analytics visualization
 * @interface AnalyticsChartConfig
 */
export interface AnalyticsChartConfig {
  type: ChartType;
  metrics: MetricType[];
  timeframe: MetricTimeframe;
  campaign_ids: string[];
}

/**
 * Analytics data filtering options
 * @interface AnalyticsFilter
 */
export interface AnalyticsFilter {
  campaign_ids: string[];
  metrics: MetricType[];
  timeframe: MetricTimeframe;
  period: DateRange;
}

/**
 * Analytics API response types
 */
export interface AnalyticsResponse extends BaseResponse<{
  performance: CampaignPerformance[];
  timeSeries: AnalyticsTimeSeriesData;
}> {}

/**
 * Analytics data retention configuration
 * @interface AnalyticsRetentionConfig
 */
export interface AnalyticsRetentionConfig {
  realTimeData: {
    retentionDays: number;    // 90 days for hot data
    granularity: MetricTimeframe;
  };
  historicalData: {
    retentionDays: number;    // 365 days for warm data
    granularity: MetricTimeframe;
  };
  archivedData: {
    retentionDays: number;    // Indefinite for cold data
    granularity: MetricTimeframe;
  };
}

/**
 * Analytics dashboard widget configuration
 * @interface AnalyticsDashboardWidget
 */
export interface AnalyticsDashboardWidget {
  id: string;
  title: string;
  type: ChartType;
  metrics: MetricType[];
  timeframe: MetricTimeframe;
  dimensions?: {
    width: number;
    height: number;
    position: {
      x: number;
      y: number;
    };
  };
  filters?: AnalyticsFilter;
}

/**
 * Analytics export configuration
 * @interface AnalyticsExportConfig
 */
export interface AnalyticsExportConfig {
  format: 'CSV' | 'JSON' | 'PDF';
  metrics: MetricType[];
  period: DateRange;
  timeframe: MetricTimeframe;
  campaigns: string[];
  includeCharts: boolean;
  scheduledDelivery?: {
    frequency: MetricTimeframe;
    recipients: string[];
  };
}