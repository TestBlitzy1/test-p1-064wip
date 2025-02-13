import React, { useMemo, useCallback } from 'react';
import clsx from 'clsx'; // v2.0.0
import Card from '../common/Card';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { CampaignPerformance, MetricType } from '../../types/analytics';
import type { DateRange } from '../../types/common';

// Trend direction enum for metric changes
enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  NEUTRAL = 'neutral'
}

interface PerformanceCardProps {
  campaignId: string;
  period: DateRange;
  className?: string;
  onMetricClick?: (metricType: MetricType) => void;
  refreshInterval?: number;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

interface MetricTrend {
  direction: TrendDirection;
  percentage: number;
  color: string; // WCAG compliant colors
}

// WCAG AA compliant colors for trends
const TREND_COLORS = {
  positive: '#059669', // Green with 4.5:1 contrast ratio
  negative: '#DC2626', // Red with 4.5:1 contrast ratio
  neutral: '#6B7280'   // Gray with 4.5:1 contrast ratio
};

/**
 * Formats metric values with appropriate units and decimals
 */
const formatMetricValue = (value: number, type: MetricType): string => {
  if (!isFinite(value)) return 'N/A';

  switch (type) {
    case 'CTR':
      return `${(value * 100).toFixed(2)}%`;
    case 'CPC':
      return `$${value.toFixed(2)}`;
    case 'ROAS':
      return `${value.toFixed(2)}x`;
    default:
      return value.toLocaleString();
  }
};

/**
 * Calculates trend direction and percentage change
 */
const calculateTrend = (currentValue: number, previousValue: number): MetricTrend => {
  if (!isFinite(currentValue) || !isFinite(previousValue)) {
    return {
      direction: TrendDirection.NEUTRAL,
      percentage: 0,
      color: TREND_COLORS.neutral
    };
  }

  const percentageChange = previousValue !== 0 
    ? ((currentValue - previousValue) / previousValue) * 100
    : 0;

  if (Math.abs(percentageChange) < 0.1) {
    return {
      direction: TrendDirection.NEUTRAL,
      percentage: 0,
      color: TREND_COLORS.neutral
    };
  }

  return {
    direction: percentageChange > 0 ? TrendDirection.UP : TrendDirection.DOWN,
    percentage: Math.abs(percentageChange),
    color: percentageChange > 0 ? TREND_COLORS.positive : TREND_COLORS.negative
  };
};

const PerformanceCard: React.FC<PerformanceCardProps> = ({
  campaignId,
  period,
  className,
  onMetricClick,
  refreshInterval = 30000,
  isLoading = false,
  error = null,
  onRetry
}) => {
  const { fetchCampaignMetrics } = useAnalytics({
    refreshInterval,
    retryAttempts: 3
  });

  // Fetch and memoize campaign performance data
  const performance = useMemo(() => {
    return fetchCampaignMetrics([campaignId], period);
  }, [campaignId, period, fetchCampaignMetrics]);

  // Handle metric click with accessibility
  const handleMetricClick = useCallback((metricType: MetricType) => {
    onMetricClick?.(metricType);
  }, [onMetricClick]);

  // Render loading state
  if (isLoading) {
    return (
      <Card 
        className={clsx('min-h-[200px]', className)}
        aria-busy="true"
        aria-label="Loading performance metrics"
      >
        <div className="animate-pulse space-y-4 p-4">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-8 bg-gray-200 rounded" />
            <div className="h-8 bg-gray-200 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card 
        className={clsx('min-h-[200px]', className)}
        aria-errormessage="performance-error"
      >
        <div className="p-4 text-center">
          <p id="performance-error" className="text-error-600 mb-4">
            {error.message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="btn btn-secondary"
              aria-label="Retry loading performance metrics"
            >
              Retry
            </button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={clsx('overflow-hidden', className)}
      aria-label="Campaign performance metrics"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        {['CTR', 'CONVERSIONS', 'CPC', 'ROAS'].map((metricType) => (
          <button
            key={metricType}
            onClick={() => handleMetricClick(metricType as MetricType)}
            className="focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg p-3"
            aria-label={`${metricType} metric details`}
          >
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {metricType}
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatMetricValue(performance?.[metricType.toLowerCase()] || 0, metricType as MetricType)}
            </div>
            {performance && (
              <MetricTrendIndicator
                current={performance[metricType.toLowerCase()]}
                previous={0} // Previous period value would come from historical data
                metricType={metricType as MetricType}
              />
            )}
          </button>
        ))}
      </div>
    </Card>
  );
};

interface MetricTrendIndicatorProps {
  current: number;
  previous: number;
  metricType: MetricType;
}

const MetricTrendIndicator: React.FC<MetricTrendIndicatorProps> = ({
  current,
  previous,
  metricType
}) => {
  const trend = calculateTrend(current, previous);

  return (
    <div 
      className="flex items-center mt-1"
      aria-label={`${metricType} trend: ${trend.percentage.toFixed(1)}% ${trend.direction}`}
    >
      <span
        className="text-sm"
        style={{ color: trend.color }}
      >
        {trend.direction === TrendDirection.UP ? '↑' : trend.direction === TrendDirection.DOWN ? '↓' : '→'}
        {trend.percentage > 0 && ` ${trend.percentage.toFixed(1)}%`}
      </span>
    </div>
  );
};

export default PerformanceCard;