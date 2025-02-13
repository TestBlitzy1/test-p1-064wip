'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import PerformanceCard from '@/components/analytics/PerformanceCard';
import ConversionChart from '@/components/analytics/ConversionChart';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { MetricType, MetricTimeframe } from '@/types/analytics';
import type { DateRange } from '@/types/common';

// Constants for configuration
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_DATE_RANGE: DateRange = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
  endDate: new Date().toISOString()
};

/**
 * Analytics Dashboard Page Component
 * Provides real-time campaign performance metrics and interactive data visualization
 */
const AnalyticsPage: React.FC = () => {
  // Analytics hook with optimized data fetching
  const {
    fetchCampaignMetrics,
    fetchTimeSeriesData,
    loading,
    error,
    refreshData
  } = useAnalytics({
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    retryAttempts: 3
  });

  // Local state management
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('CTR');
  const [timeframe, setTimeframe] = useState<MetricTimeframe>('DAILY');
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);

  // Redux selectors for campaign data
  const selectedCampaigns = useSelector(state => state.analytics.selectedCampaigns);
  const campaignPerformance = useSelector(state => state.analytics.campaignPerformance);

  /**
   * Memoized performance metrics for optimized rendering
   */
  const performanceMetrics = useMemo(() => {
    if (!campaignPerformance?.length) return null;

    return {
      CTR: campaignPerformance.reduce((acc, curr) => acc + curr.ctr, 0) / campaignPerformance.length,
      CONVERSIONS: campaignPerformance.reduce((acc, curr) => acc + curr.conversions, 0),
      CPC: campaignPerformance.reduce((acc, curr) => acc + curr.cpc, 0) / campaignPerformance.length,
      ROAS: campaignPerformance.reduce((acc, curr) => acc + curr.roas, 0) / campaignPerformance.length
    };
  }, [campaignPerformance]);

  /**
   * Handles metric card click with debouncing
   */
  const handleMetricClick = useCallback((metricType: MetricType) => {
    setSelectedMetric(metricType);
  }, []);

  /**
   * Fetches initial analytics data with error handling
   */
  const fetchInitialData = useCallback(async () => {
    try {
      await Promise.all([
        fetchCampaignMetrics(selectedCampaigns, dateRange),
        fetchTimeSeriesData(dateRange, [selectedMetric])
      ]);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    }
  }, [fetchCampaignMetrics, fetchTimeSeriesData, selectedCampaigns, dateRange, selectedMetric]);

  /**
   * Sets up real-time data updates with cleanup
   */
  useEffect(() => {
    fetchInitialData();

    const intervalId = setInterval(() => {
      refreshData(dateRange);
    }, DEFAULT_REFRESH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchInitialData, refreshData, dateRange]);

  // Error state with retry option
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-error-600 mb-4">
          Failed to load analytics data: {error.message}
        </div>
        <button
          onClick={() => fetchInitialData()}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Performance Metrics Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Campaign Performance
        </h2>
        <PerformanceCard
          campaignId={selectedCampaigns[0]}
          period={dateRange}
          onMetricClick={handleMetricClick}
          refreshInterval={DEFAULT_REFRESH_INTERVAL}
          isLoading={loading}
          error={error}
          onRetry={fetchInitialData}
          className="w-full"
        />
      </section>

      {/* Conversion Chart Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Conversion Trends
          </h2>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as MetricTimeframe)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="HOURLY">Hourly</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <ConversionChart
            campaignIds={selectedCampaigns}
            timeframe={timeframe}
            period={dateRange}
            height={400}
            refreshInterval={DEFAULT_REFRESH_INTERVAL}
          />
        </div>
      </section>
    </main>
  );
};

export default AnalyticsPage;