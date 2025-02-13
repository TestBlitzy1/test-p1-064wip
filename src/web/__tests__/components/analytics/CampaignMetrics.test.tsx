import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import CampaignMetrics from '../../../src/components/analytics/CampaignMetrics';
import { useAnalytics } from '../../../src/hooks/useAnalytics';

// Mock useAnalytics hook
jest.mock('../../../src/hooks/useAnalytics');

// Mock campaign metrics data
const mockCampaignMetrics = {
  impressions: 125000,
  ctr: 2.4,
  cpc: 3.2,
  roas: 3.8,
  timestamp: '2024-01-20T12:00:00Z'
};

// Mock real-time update data
const mockWebSocketUpdate = {
  type: 'METRICS_UPDATE',
  payload: {
    impressions: 128000,
    ctr: 2.6,
    cpc: 3.1,
    roas: 4.0,
    timestamp: '2024-01-20T12:01:00Z'
  }
};

// Test period
const testPeriod = {
  startDate: '2024-01-01',
  endDate: '2024-01-31'
};

describe('CampaignMetrics Component', () => {
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockImplementation(() => ({
      loading: false,
      error: null,
      fetchCampaignMetrics: jest.fn().mockResolvedValue([mockCampaignMetrics])
    }));
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    (useAnalytics as jest.Mock).mockImplementation(() => ({
      loading: true,
      error: null,
      fetchCampaignMetrics: jest.fn()
    }));

    render(
      <CampaignMetrics
        campaignId="test-campaign"
        period={testPeriod}
      />
    );

    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Campaign metrics' })).toBeInTheDocument();
  });

  it('displays campaign metrics correctly', async () => {
    render(
      <CampaignMetrics
        campaignId="test-campaign"
        period={testPeriod}
      />
    );

    // Wait for metrics to load and verify display
    await waitFor(() => {
      expect(screen.getByText('125,000')).toBeInTheDocument(); // Impressions
      expect(screen.getByText('2.40%')).toBeInTheDocument(); // CTR
      expect(screen.getByText('$3.20')).toBeInTheDocument(); // CPC
      expect(screen.getByText('3.80x')).toBeInTheDocument(); // ROAS
    });

    // Verify metric cards accessibility
    const metricCards = screen.getAllByRole('article');
    expect(metricCards).toHaveLength(4);
    metricCards.forEach(card => {
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('metric card'));
    });
  });

  it('handles real-time metric updates', async () => {
    const mockWebSocket = {
      onmessage: null as any,
      close: jest.fn()
    };

    (useAnalytics as jest.Mock).mockImplementation(() => ({
      loading: false,
      error: null,
      fetchCampaignMetrics: jest.fn().mockResolvedValue([mockCampaignMetrics]),
      useWebSocketConnection: jest.fn().mockReturnValue(mockWebSocket)
    }));

    render(
      <CampaignMetrics
        campaignId="test-campaign"
        period={testPeriod}
        enableRealtime={true}
      />
    );

    // Verify initial metrics
    await waitFor(() => {
      expect(screen.getByText('2.40%')).toBeInTheDocument();
    });

    // Simulate WebSocket update
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage({ data: JSON.stringify(mockWebSocketUpdate) });
    }

    // Verify updated metrics
    await waitFor(() => {
      expect(screen.getByText('2.60%')).toBeInTheDocument();
      expect(screen.getByText('$3.10')).toBeInTheDocument();
      expect(screen.getByText('4.00x')).toBeInTheDocument();
    });
  });

  it('handles error states appropriately', async () => {
    const testError = new Error('Failed to fetch metrics');
    (useAnalytics as jest.Mock).mockImplementation(() => ({
      loading: false,
      error: testError,
      fetchCampaignMetrics: jest.fn().mockRejectedValue(testError)
    }));

    render(
      <CampaignMetrics
        campaignId="test-campaign"
        period={testPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch metrics/i)).toBeInTheDocument();
    });
  });

  it('handles period changes correctly', async () => {
    const fetchMetricsMock = jest.fn().mockResolvedValue([mockCampaignMetrics]);
    (useAnalytics as jest.Mock).mockImplementation(() => ({
      loading: false,
      error: null,
      fetchCampaignMetrics: fetchMetricsMock
    }));

    const { rerender } = render(
      <CampaignMetrics
        campaignId="test-campaign"
        period={testPeriod}
      />
    );

    // Verify initial fetch
    expect(fetchMetricsMock).toHaveBeenCalledWith(
      ['test-campaign'],
      testPeriod
    );

    // Update period
    const newPeriod = {
      startDate: '2024-02-01',
      endDate: '2024-02-28'
    };

    rerender(
      <CampaignMetrics
        campaignId="test-campaign"
        period={newPeriod}
      />
    );

    // Verify metrics are refetched with new period
    await waitFor(() => {
      expect(fetchMetricsMock).toHaveBeenCalledWith(
        ['test-campaign'],
        newPeriod
      );
    });
  });

  it('applies correct styling for stale metrics', async () => {
    const staleConfig = {
      staleness: 1000 // 1 second for testing
    };

    render(
      <CampaignMetrics
        campaignId="test-campaign"
        period={testPeriod}
        config={staleConfig}
      />
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('2.40%')).toBeInTheDocument();
    });

    // Wait for staleness
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Verify stale styling
    const metricCards = screen.getAllByRole('article');
    metricCards.forEach(card => {
      expect(card).toHaveClass('opacity-60');
    });
  });
});