import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import ROASChart from '../../../src/components/analytics/ROASChart';
import { useAnalytics } from '../../../src/hooks/useAnalytics';

// Mock the useAnalytics hook
jest.mock('../../../src/hooks/useAnalytics');

// Mock ResizeObserver for responsive testing
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock time series data
const mockTimeSeriesData = {
  timeframe: 'DAILY',
  metrics: [
    {
      type: 'ROAS',
      value: 2.5,
      timestamp: '2023-01-01T00:00:00Z',
      campaign_id: 'test-campaign-1'
    },
    {
      type: 'ROAS',
      value: 3.2,
      timestamp: '2023-01-02T00:00:00Z',
      campaign_id: 'test-campaign-1'
    }
  ],
  period: {
    startDate: '2023-01-01',
    endDate: '2023-01-31'
  }
};

describe('ROASChart', () => {
  const defaultProps = {
    campaignIds: ['test-campaign-1'],
    period: {
      startDate: '2023-01-01',
      endDate: '2023-01-31'
    },
    timeframe: 'DAILY',
    height: 400
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock useAnalytics implementation
    (useAnalytics as jest.Mock).mockReturnValue({
      fetchTimeSeriesData: jest.fn().mockResolvedValue(mockTimeSeriesData),
      useWebSocketUpdates: jest.fn().mockReturnValue(() => {})
    });
  });

  it('should render with accessibility features', async () => {
    render(<ROASChart {...defaultProps} />);

    // Verify ARIA labels and roles
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByLabelText('ROAS Chart')).toBeInTheDocument();

    // Verify chart elements
    await waitFor(() => {
      expect(screen.getByRole('graphics-document')).toBeInTheDocument();
      expect(screen.getByRole('graphics-symbol', { name: 'Line chart' })).toBeInTheDocument();
    });

    // Verify axis labels
    expect(screen.getByText('Return on Ad Spend')).toBeInTheDocument();
    expect(screen.getByText('Time Period')).toBeInTheDocument();
  });

  it('should handle data loading states', async () => {
    const { rerender } = render(<ROASChart {...defaultProps} />);

    // Initial loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify data points are rendered
    expect(screen.getAllByRole('graphics-symbol')).toHaveLength(mockTimeSeriesData.metrics.length);
  });

  it('should handle real-time updates', async () => {
    const mockWebSocketUpdate = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({
      fetchTimeSeriesData: jest.fn().mockResolvedValue(mockTimeSeriesData),
      useWebSocketUpdates: jest.fn().mockReturnValue(mockWebSocketUpdate)
    });

    render(<ROASChart {...defaultProps} enableRealTime />);

    // Verify WebSocket subscription
    await waitFor(() => {
      expect(useAnalytics().useWebSocketUpdates).toHaveBeenCalled();
    });

    // Simulate real-time update
    const newData = {
      ...mockTimeSeriesData,
      metrics: [...mockTimeSeriesData.metrics, {
        type: 'ROAS',
        value: 4.0,
        timestamp: '2023-01-03T00:00:00Z',
        campaign_id: 'test-campaign-1'
      }]
    };

    mockWebSocketUpdate(newData);

    // Verify chart updates
    await waitFor(() => {
      expect(screen.getAllByRole('graphics-symbol')).toHaveLength(newData.metrics.length);
    });
  });

  it('should handle responsive behavior', async () => {
    const { container, rerender } = render(<ROASChart {...defaultProps} />);

    // Test different viewport sizes
    const sizes = [
      { width: 320, height: 480 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1920, height: 1080 } // Desktop
    ];

    for (const size of sizes) {
      // Update viewport size
      Object.defineProperty(window, 'innerWidth', { value: size.width });
      Object.defineProperty(window, 'innerHeight', { value: size.height });
      window.dispatchEvent(new Event('resize'));

      // Wait for chart to update
      await waitFor(() => {
        const chart = container.querySelector('.recharts-responsive-container');
        expect(chart).toHaveStyle({ width: '100%' });
      });
    }
  });

  it('should handle error states', async () => {
    const mockError = new Error('Failed to fetch ROAS data');
    (useAnalytics as jest.Mock).mockReturnValue({
      fetchTimeSeriesData: jest.fn().mockRejectedValue(mockError),
      useWebSocketUpdates: jest.fn().mockReturnValue(() => {})
    });

    render(<ROASChart {...defaultProps} />);

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch ROAS data')).toBeInTheDocument();
    });
  });

  it('should handle data point interactions', async () => {
    const onDataPointClick = jest.fn();
    render(<ROASChart {...defaultProps} onDataPointClick={onDataPointClick} />);

    // Wait for chart to render
    await waitFor(() => {
      expect(screen.getAllByRole('graphics-symbol')).toHaveLength(mockTimeSeriesData.metrics.length);
    });

    // Simulate data point click
    const dataPoint = screen.getAllByRole('graphics-symbol')[0];
    await userEvent.click(dataPoint);

    // Verify click handler is called with correct data
    expect(onDataPointClick).toHaveBeenCalledWith(expect.objectContaining({
      timestamp: mockTimeSeriesData.metrics[0].timestamp,
      value: mockTimeSeriesData.metrics[0].value
    }));
  });

  it('should apply theme-based styling', async () => {
    render(<ROASChart {...defaultProps} theme="dark" />);

    // Verify dark theme styles are applied
    await waitFor(() => {
      const chart = screen.getByRole('graphics-document');
      expect(chart).toHaveStyle({
        backgroundColor: expect.stringMatching(/^#|rgb/)
      });
    });
  });
});