import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'; // v2.10.0
import { useTheme } from '@mui/material'; // v5.0.0
import debounce from 'lodash/debounce'; // v4.17.21
import Card from '../common/Card';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { AnalyticsTimeSeriesData } from '../../types/analytics';

interface ROASChartProps {
  campaignIds: string[];
  period: DateRange;
  timeframe: MetricTimeframe;
  className?: string;
  height?: number;
  enableRealTime?: boolean;
  theme?: 'light' | 'dark';
  onDataPointClick?: (data: ROASDataPoint) => void;
}

interface ROASDataPoint {
  timestamp: string;
  value: number;
  campaignIds: string[];
  metadata?: {
    spend: number;
    revenue: number;
  };
}

interface WindowConfig {
  start: number;
  end: number;
  maxPoints: number;
}

const DEFAULT_HEIGHT = 400;
const DEBOUNCE_DELAY = 250;
const DATA_POINTS_THRESHOLD = 1000;

const ROASChart: React.FC<ROASChartProps> = ({
  campaignIds,
  period,
  timeframe,
  className,
  height = DEFAULT_HEIGHT,
  enableRealTime = false,
  theme = 'light',
  onDataPointClick
}) => {
  const muiTheme = useTheme();
  const chartRef = useRef<any>(null);
  const { fetchTimeSeriesData, useWebSocketUpdates } = useAnalytics();

  // Memoized chart colors based on theme
  const chartColors = useMemo(() => ({
    stroke: theme === 'light' ? muiTheme.palette.primary.main : muiTheme.palette.primary.light,
    grid: theme === 'light' ? muiTheme.palette.grey[200] : muiTheme.palette.grey[700],
    tooltip: theme === 'light' ? muiTheme.palette.common.white : muiTheme.palette.grey[800],
    text: theme === 'light' ? muiTheme.palette.text.primary : muiTheme.palette.text.primary
  }), [theme, muiTheme]);

  // Format data for chart consumption with windowing support
  const formatChartData = useCallback((data: AnalyticsTimeSeriesData, windowConfig: WindowConfig): ROASDataPoint[] => {
    if (!data?.metrics?.length) return [];

    const roasMetrics = data.metrics.filter(metric => metric.type === 'ROAS');
    const groupedData = new Map<string, ROASDataPoint>();

    roasMetrics.forEach(metric => {
      const timestamp = new Date(metric.timestamp).getTime();
      if (timestamp >= windowConfig.start && timestamp <= windowConfig.end) {
        const key = metric.timestamp;
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            timestamp: metric.timestamp,
            value: metric.value,
            campaignIds: [metric.campaign_id],
            metadata: {
              spend: 0,
              revenue: 0
            }
          });
        } else {
          const existing = groupedData.get(key)!;
          existing.value = (existing.value + metric.value) / 2; // Average ROAS
          existing.campaignIds.push(metric.campaign_id);
        }
      }
    });

    return Array.from(groupedData.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-windowConfig.maxPoints);
  }, []);

  // Handle real-time data updates
  const handleDataUpdate = useCallback((update: any) => {
    if (!chartRef.current) return;

    const newData = formatChartData(update, {
      start: new Date(period.startDate).getTime(),
      end: new Date(period.endDate).getTime(),
      maxPoints: DATA_POINTS_THRESHOLD
    });

    chartRef.current.setData(newData);
  }, [period, formatChartData]);

  // Debounced window resize handler
  const handleResize = useMemo(() => 
    debounce(() => {
      if (chartRef.current) {
        chartRef.current.update();
      }
    }, DEBOUNCE_DELAY),
    []
  );

  // Initialize chart data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchTimeSeriesData(period, ['ROAS']);
        const formattedData = formatChartData(data, {
          start: new Date(period.startDate).getTime(),
          end: new Date(period.endDate).getTime(),
          maxPoints: DATA_POINTS_THRESHOLD
        });
        if (chartRef.current) {
          chartRef.current.setData(formattedData);
        }
      } catch (error) {
        console.error('Failed to fetch ROAS data:', error);
      }
    };

    fetchData();
  }, [period, campaignIds, timeframe, fetchTimeSeriesData, formatChartData]);

  // Setup real-time updates
  useEffect(() => {
    if (enableRealTime) {
      const unsubscribe = useWebSocketUpdates(handleDataUpdate);
      return () => unsubscribe();
    }
  }, [enableRealTime, handleDataUpdate, useWebSocketUpdates]);

  // Setup resize listener
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return (
    <Card
      className={className}
      variant="outlined"
      elevation="medium"
      aria-label="ROAS Chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <Line
          ref={chartRef}
          data={[]} // Initial empty data, will be populated by effects
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chartColors.grid}
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            stroke={chartColors.text}
            tickFormatter={(value) => {
              const date = new Date(value);
              return timeframe === 'DAILY'
                ? date.toLocaleDateString()
                : date.toLocaleString();
            }}
          />
          <YAxis
            stroke={chartColors.text}
            tickFormatter={(value) => `${value.toFixed(2)}x`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: chartColors.tooltip,
              border: 'none',
              borderRadius: '4px',
              boxShadow: muiTheme.shadows[2]
            }}
            formatter={(value: number) => [`${value.toFixed(2)}x ROAS`, 'Return on Ad Spend']}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={chartColors.stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 6,
              onClick: (data: any) => onDataPointClick?.(data.payload)
            }}
          />
        </Line>
      </ResponsiveContainer>
    </Card>
  );
};

export default ROASChart;