import React, { useEffect, useState, useCallback, useMemo } from 'react';
import clsx from 'clsx'; // v2.0.0
import Card from '../common/Card';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { CampaignPerformance } from '../../types/analytics';
import type { DateRange } from '../../types/common';

// Constants for metric formatting and validation
const METRIC_REFRESH_INTERVAL = 30000; // 30 seconds
const METRIC_STALENESS_THRESHOLD = 300000; // 5 minutes
const DECIMAL_PLACES = {
  CTR: 2,
  CPC: 2,
  ROAS: 2,
  DEFAULT: 0
};

interface CampaignMetricsProps {
  campaignId: string;
  period: DateRange;
  className?: string;
  enableRealtime?: boolean;
  config?: MetricConfig;
}

interface MetricConfig {
  refreshInterval?: number;
  staleness?: number;
  rules?: ValidationRules;
}

interface ValidationRules {
  minValue?: number;
  maxValue?: number;
  trendThreshold?: number;
}

interface MetricCardProps {
  label: string;
  value: number;
  type: keyof typeof DECIMAL_PLACES;
  trend?: number;
  isStale?: boolean;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  type,
  trend,
  isStale,
  className
}) => {
  const formattedValue = formatMetricValue(value, type);
  
  const cardClasses = clsx(
    'min-w-[200px]',
    'transition-opacity duration-200',
    {
      'opacity-60': isStale
    },
    className
  );

  const trendClasses = clsx(
    'text-sm font-medium',
    {
      'text-green-600 dark:text-green-400': trend && trend > 0,
      'text-red-600 dark:text-red-400': trend && trend < 0
    }
  );

  return (
    <Card
      variant="default"
      elevation="low"
      className={cardClasses}
      aria-label={`${label} metric card`}
    >
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </h3>
        <div className="mt-2 flex items-baseline">
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formattedValue}
          </p>
          {trend && (
            <span className={trendClasses}>
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

const formatMetricValue = (value: number, type: keyof typeof DECIMAL_PLACES): string => {
  const decimals = DECIMAL_PLACES[type] || DECIMAL_PLACES.DEFAULT;
  
  switch (type) {
    case 'CTR':
      return `${value.toFixed(decimals)}%`;
    case 'CPC':
      return `$${value.toFixed(decimals)}`;
    case 'ROAS':
      return `${value.toFixed(decimals)}x`;
    default:
      return value.toLocaleString(undefined, {
        maximumFractionDigits: decimals
      });
  }
};

const validateMetric = (value: number, rules?: ValidationRules): boolean => {
  if (!rules) return true;

  const { minValue, maxValue, trendThreshold } = rules;
  
  if (minValue !== undefined && value < minValue) return false;
  if (maxValue !== undefined && value > maxValue) return false;
  if (trendThreshold !== undefined && Math.abs(value) > trendThreshold) return false;
  
  return true;
};

const CampaignMetrics: React.FC<CampaignMetricsProps> = ({
  campaignId,
  period,
  className,
  enableRealtime = true,
  config = {}
}) => {
  const {
    refreshInterval = METRIC_REFRESH_INTERVAL,
    staleness = METRIC_STALENESS_THRESHOLD,
    rules
  } = config;

  const [metrics, setMetrics] = useState<CampaignPerformance | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<Error | null>(null);

  const { fetchCampaignMetrics, loading } = useAnalytics();

  const isStale = useMemo(() => {
    if (!lastUpdate) return false;
    return Date.now() - lastUpdate.getTime() > staleness;
  }, [lastUpdate, staleness]);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await fetchCampaignMetrics([campaignId], period);
      if (data && data.length > 0) {
        setMetrics(data[0]);
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      setError(err as Error);
    }
  }, [campaignId, period, fetchCampaignMetrics]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!enableRealtime) return;

    const intervalId = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(intervalId);
  }, [enableRealtime, refreshInterval, fetchMetrics]);

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4">
        Error loading metrics: {error.message}
      </div>
    );
  }

  const containerClasses = clsx(
    'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4',
    className
  );

  return (
    <div className={containerClasses} role="region" aria-label="Campaign metrics">
      {loading && !metrics && (
        <div className="col-span-full text-center p-4">Loading metrics...</div>
      )}

      {metrics && (
        <>
          <MetricCard
            label="Impressions"
            value={metrics.impressions}
            type="DEFAULT"
            isStale={isStale}
          />
          <MetricCard
            label="Click-Through Rate"
            value={metrics.ctr}
            type="CTR"
            isStale={isStale}
          />
          <MetricCard
            label="Cost Per Click"
            value={metrics.cpc}
            type="CPC"
            isStale={isStale}
          />
          <MetricCard
            label="Return on Ad Spend"
            value={metrics.roas}
            type="ROAS"
            isStale={isStale}
          />
        </>
      )}
    </div>
  );
};

export default CampaignMetrics;