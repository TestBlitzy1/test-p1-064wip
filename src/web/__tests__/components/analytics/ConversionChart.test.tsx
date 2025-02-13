import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import ConversionChart from '../../../src/components/analytics/ConversionChart';
import { useAnalytics } from '../../../src/hooks/useAnalytics';
import type { AnalyticsTimeSeriesData, MetricTimeframe } from '../../../src/types/analytics';

// Mock useAnalytics hook
jest.mock('../../../src/hooks/useAnalytics', () => ({
  useAnalytics: jest.fn()
}));

// Mock ResizeObserver for responsive testing
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));
global.ResizeObserver = mockResizeObserver;

// Test data constants
const TEST_CAMPAIGN_IDS = ['campaign-1', 'campaign-2'];
const TEST_PERIOD = {
  startDate: '2023-01-01',
  endDate: '2023-01-31'
};
const TEST_TIMEFRAME: MetricTimeframe = 'DAILY';

// Mock time series data
const mockTimeSeriesData: AnalyticsTimeSeriesData = {
  timeframe: TEST_TIMEFRAME,
  metrics: [
    {
      type: 'CONVERSIONS',
      value: 2.5,
      timestamp: '2023-01-01T00:00:00Z',
      campaign_id: 'campaign-1'
    },
    {
      type: 'CONVERSIONS',
      value: 3.2,
      timestamp: '2023-01-02T00:00:00Z',
      campaign_id: 'campaign-1'
    }
  ],
  period: TEST_PERIOD
};

describe('ConversionChart', () => {
  let mockFetchTimeSeriesData: jest.Mock;
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock analytics hook
    mockFetchTimeSeriesData = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      fetchTimeSeriesData: mockFetchTimeSeriesData,
      loading: false,
      error: null
    });
    
    // Setup mock successful response
    mockFetchTimeSeriesData.mockResolvedValue(mockTimeSeriesData);
  });

  afterEach(() => {
    // Cleanup after each test
    jest.resetAllMocks();
  });

  it('renders loading state correctly', () => {
    // Mock loading state
    (useAnalytics as jest.Mock).mockReturnValue({
      fetchTimeSeriesData: mockFetchTimeSeriesData,
      loading: true,
      error: null
    });

    render(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={TEST_TIMEFRAME}
        period={TEST_PERIOD}
        height={300}
      />
    );

    // Verify loading spinner is present
    const loadingSpinner = screen.getByRole('status');
    expect(loadingSpinner).toBeInTheDocument();
    expect(loadingSpinner).toHaveClass('animate-spin');
  });

  it('fetches and displays conversion data correctly', async () => {
    render(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={TEST_TIMEFRAME}
        period={TEST_PERIOD}
        height={300}
      />
    );

    // Verify data fetching
    expect(mockFetchTimeSeriesData).toHaveBeenCalledWith(
      TEST_PERIOD,
      ['CONVERSIONS']
    );

    // Wait for chart to render
    await waitFor(() => {
      const chart = screen.getByRole('img', { name: /conversion rate chart/i });
      expect(chart).toBeInTheDocument();
    });

    // Verify data points are rendered
    mockTimeSeriesData.metrics.forEach(metric => {
      const dataPoint = screen.getByRole('graphics-symbol', {
        name: new RegExp(`${metric.value}%`)
      });
      expect(dataPoint).toBeInTheDocument();
    });
  });

  it('handles empty data gracefully', async () => {
    // Mock empty data response
    mockFetchTimeSeriesData.mockResolvedValue({
      ...mockTimeSeriesData,
      metrics: []
    });

    render(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={TEST_TIMEFRAME}
        period={TEST_PERIOD}
        height={300}
      />
    );

    await waitFor(() => {
      const emptyState = screen.getByText(/no conversion data available/i);
      expect(emptyState).toBeInTheDocument();
      expect(emptyState).toHaveClass('text-gray-600');
    });
  });

  it('updates when timeframe changes', async () => {
    const { rerender } = render(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={TEST_TIMEFRAME}
        period={TEST_PERIOD}
        height={300}
      />
    );

    // Change timeframe
    const newTimeframe: MetricTimeframe = 'WEEKLY';
    rerender(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={newTimeframe}
        period={TEST_PERIOD}
        height={300}
      />
    );

    // Verify data is refetched with new timeframe
    await waitFor(() => {
      expect(mockFetchTimeSeriesData).toHaveBeenCalledTimes(2);
    });
  });

  it('handles error states appropriately', async () => {
    // Mock error state
    const testError = new Error('Failed to fetch data');
    (useAnalytics as jest.Mock).mockReturnValue({
      fetchTimeSeriesData: mockFetchTimeSeriesData,
      loading: false,
      error: testError
    });

    render(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={TEST_TIMEFRAME}
        period={TEST_PERIOD}
        height={300}
      />
    );

    // Verify error message
    const errorMessage = screen.getByText(/error loading conversion data/i);
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveClass('text-red-600');

    // Verify retry functionality
    const retryButton = screen.getByRole('button', { name: /try again/i });
    await userEvent.click(retryButton);
    expect(mockFetchTimeSeriesData).toHaveBeenCalledTimes(2);
  });

  it('maintains responsive behavior', async () => {
    render(
      <ConversionChart
        campaignIds={TEST_CAMPAIGN_IDS}
        timeframe={TEST_TIMEFRAME}
        period={TEST_PERIOD}
        height={300}
      />
    );

    // Verify ResizeObserver is initialized
    expect(mockResizeObserver).toHaveBeenCalled();

    // Verify responsive container
    const container = screen.getByRole('img', { name: /conversion rate chart/i });
    expect(container).toHaveStyle({ width: '100%', height: '300px' });
  });
});