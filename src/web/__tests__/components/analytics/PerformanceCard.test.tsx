import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react'; // v4.7.0
import PerformanceCard from '../../../src/components/analytics/PerformanceCard';
import { useAnalytics } from '../../../src/hooks/useAnalytics';
import type { CampaignMetrics, MetricTrend } from '../../../src/types/analytics';

// Mock useAnalytics hook
jest.mock('../../../src/hooks/useAnalytics', () => ({
  useAnalytics: jest.fn()
}));

// Mock campaign performance data
const mockCampaignData: CampaignMetrics = {
  ctr: 2.4,
  conversions: 82,
  cpc: 3.2,
  roas: 3.8,
  impressions: 125000,
  clicks: 3750,
  spend: 12000,
  revenue: 45600
};

// Mock trend data
const mockTrends: Record<string, MetricTrend> = {
  ctr: { direction: 'up', percentage: 15, color: '#059669' },
  conversions: { direction: 'up', percentage: 12, color: '#059669' },
  cpc: { direction: 'down', percentage: 8, color: '#DC2626' },
  roas: { direction: 'up', percentage: 20, color: '#059669' }
};

// Helper function to render PerformanceCard with test props
const renderPerformanceCard = (
  initialMetrics = mockCampaignData,
  dateRange = { startDate: '2024-01-01', endDate: '2024-01-31' },
  onMetricClick = jest.fn()
) => {
  const mockAnalytics = {
    fetchCampaignMetrics: jest.fn().mockResolvedValue(initialMetrics),
    calculateTrends: jest.fn().mockReturnValue(mockTrends)
  };

  (useAnalytics as jest.Mock).mockReturnValue(mockAnalytics);

  const utils = render(
    <PerformanceCard
      campaignId="test-campaign"
      period={dateRange}
      onMetricClick={onMetricClick}
      refreshInterval={30000}
    />
  );

  return {
    ...utils,
    mockAnalytics,
    user: userEvent.setup()
  };
};

describe('PerformanceCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('renders all performance metrics correctly', () => {
      const { getByText } = renderPerformanceCard();

      expect(getByText('CTR')).toBeInTheDocument();
      expect(getByText('CONVERSIONS')).toBeInTheDocument();
      expect(getByText('CPC')).toBeInTheDocument();
      expect(getByText('ROAS')).toBeInTheDocument();

      // Check formatted values
      expect(getByText('2.40%')).toBeInTheDocument(); // CTR
      expect(getByText('82')).toBeInTheDocument(); // Conversions
      expect(getByText('$3.20')).toBeInTheDocument(); // CPC
      expect(getByText('3.80x')).toBeInTheDocument(); // ROAS
    });

    it('applies WCAG compliant colors for trends', () => {
      const { container } = renderPerformanceCard();
      
      const trendIndicators = container.querySelectorAll('[style*="color"]');
      trendIndicators.forEach(indicator => {
        const style = window.getComputedStyle(indicator);
        const color = style.color;
        expect(color).toMatch(/(#059669|#DC2626|#6B7280)/); // Green, Red, or Neutral
      });
    });
  });

  describe('Real-time Updates', () => {
    it('handles real-time metric updates', async () => {
      const { mockAnalytics } = renderPerformanceCard();

      const updatedMetrics = {
        ...mockCampaignData,
        ctr: 2.8,
        conversions: 90
      };

      mockAnalytics.fetchCampaignMetrics.mockResolvedValueOnce(updatedMetrics);

      // Trigger refresh
      await waitFor(() => {
        expect(mockAnalytics.fetchCampaignMetrics).toHaveBeenCalledTimes(2);
      });

      // Check updated values
      expect(screen.getByText('2.80%')).toBeInTheDocument();
      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('cleans up subscriptions on unmount', () => {
      const { unmount } = renderPerformanceCard();
      const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
      
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('displays error state correctly', () => {
      const { rerender } = renderPerformanceCard();
      
      rerender(
        <PerformanceCard
          campaignId="test-campaign"
          period={{ startDate: '2024-01-01', endDate: '2024-01-31' }}
          error={new Error('Failed to load metrics')}
        />
      );

      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('handles retry action', async () => {
      const onRetry = jest.fn();
      const { user } = renderPerformanceCard();

      const { rerender } = render(
        <PerformanceCard
          campaignId="test-campaign"
          period={{ startDate: '2024-01-01', endDate: '2024-01-31' }}
          error={new Error('Failed to load metrics')}
          onRetry={onRetry}
        />
      );

      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility standards', async () => {
      const { container } = renderPerformanceCard();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { user } = renderPerformanceCard();
      const metrics = screen.getAllByRole('button');

      // Test keyboard navigation
      await user.tab();
      expect(metrics[0]).toHaveFocus();

      await user.tab();
      expect(metrics[1]).toHaveFocus();

      // Test keyboard activation
      await user.keyboard('{Enter}');
      expect(screen.getByLabelText(/conversions metric details/i)).toBeInTheDocument();
    });

    it('provides appropriate ARIA labels', () => {
      renderPerformanceCard();

      // Check ARIA labels for metric buttons
      expect(screen.getByLabelText('CTR metric details')).toBeInTheDocument();
      expect(screen.getByLabelText('CONVERSIONS metric details')).toBeInTheDocument();
      expect(screen.getByLabelText('CPC metric details')).toBeInTheDocument();
      expect(screen.getByLabelText('ROAS metric details')).toBeInTheDocument();

      // Check ARIA labels for trend indicators
      expect(screen.getByLabelText('CTR trend: 15.0% up')).toBeInTheDocument();
      expect(screen.getByLabelText('CPC trend: 8.0% down')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles metric click events', async () => {
      const onMetricClick = jest.fn();
      const { user } = renderPerformanceCard(mockCampaignData, undefined, onMetricClick);

      await user.click(screen.getByText('CTR'));
      expect(onMetricClick).toHaveBeenCalledWith('CTR');

      await user.click(screen.getByText('ROAS'));
      expect(onMetricClick).toHaveBeenCalledWith('ROAS');
    });

    it('shows loading state correctly', () => {
      render(
        <PerformanceCard
          campaignId="test-campaign"
          period={{ startDate: '2024-01-01', endDate: '2024-01-31' }}
          isLoading={true}
        />
      );

      expect(screen.getByLabelText('Loading performance metrics')).toBeInTheDocument();
      expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
    });
  });
});