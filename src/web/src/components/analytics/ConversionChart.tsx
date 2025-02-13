import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'; // v2.10.0
import { useAnalytics } from '../../hooks/useAnalytics';
import type { 
  AnalyticsTimeSeriesData, 
  MetricTimeframe,
  AnalyticsMetric 
} from '../../types/analytics';

// Constants for chart configuration
const CHART_MARGIN = { top: 10, right: 30, left: 0, bottom: 0 };
const Y_AXIS_WIDTH = 80;
const ANIMATION_DURATION = 300;
const DEFAULT_HEIGHT = 300;
const TOOLTIP_OFFSET = 10;

interface ConversionChartProps {
  campaignIds: string[];
  timeframe: MetricTimeframe;
  period: {
    startDate: string;
    endDate: string;
  };
  height?: number;
  refreshInterval?: number;
}

/**
 * Enterprise-grade conversion rate visualization component with real-time updates
 * and optimized performance
 */
export const ConversionChart: React.FC<ConversionChartProps> = ({
  campaignIds,
  timeframe,
  period,
  height = DEFAULT_HEIGHT,
  refreshInterval = 1000
}) => {
  // Custom hook for analytics data management
  const { 
    fetchTimeSeriesData, 
    loading, 
    error 
  } = useAnalytics({
    refreshInterval,
    cacheTTL: 60000 // 1 minute cache
  });

  // Local state for chart data
  const [timeSeriesData, setTimeSeriesData] = useState<AnalyticsTimeSeriesData | null>(null);

  /**
   * Formats and validates time series data for chart rendering
   * with performance optimization using memoization
   */
  const formattedData = useMemo(() => {
    if (!timeSeriesData?.metrics) return [];

    return timeSeriesData.metrics
      .filter(metric => metric.type === 'CONVERSIONS')
      .reduce((acc: any[], metric: AnalyticsMetric) => {
        const existingPoint = acc.find(point => 
          point.timestamp === metric.timestamp
        );

        if (existingPoint) {
          existingPoint.value = (existingPoint.value + metric.value) / 2;
        } else {
          acc.push({
            timestamp: new Date(metric.timestamp).toLocaleString(),
            value: metric.value,
            campaign_id: metric.campaign_id
          });
        }

        return acc;
      }, [])
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [timeSeriesData]);

  /**
   * Handles data fetching with error boundaries and retry logic
   */
  const fetchData = useCallback(async () => {
    try {
      const response = await fetchTimeSeriesData(period, ['CONVERSIONS']);
      setTimeSeriesData(response);
    } catch (err) {
      console.error('Error fetching conversion data:', err);
    }
  }, [fetchTimeSeriesData, period]);

  /**
   * Sets up real-time data updates with cleanup
   */
  useEffect(() => {
    fetchData();
    
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchData, refreshInterval]);

  /**
   * Custom tooltip formatter for data point information
   */
  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white p-3 border rounded shadow-lg">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-600">
          Conversion Rate: {payload[0].value.toFixed(2)}%
        </p>
      </div>
    );
  }, []);

  // Loading state
  if (loading && !timeSeriesData) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px] text-red-600">
        Error loading conversion data. Please try again.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Line
        data={formattedData}
        margin={CHART_MARGIN}
      >
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          width={Y_AXIS_WIDTH}
          tick={{ fontSize: 12, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          content={CustomTooltip}
          cursor={false}
          offset={TOOLTIP_OFFSET}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#4F46E5"
          strokeWidth={2}
          dot={false}
          animationDuration={ANIMATION_DURATION}
        />
      </Line>
    </ResponsiveContainer>
  );
};

// Export for component usage
export default ConversionChart;