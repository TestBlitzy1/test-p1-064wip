import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import CampaignList from '../../../src/components/campaigns/CampaignList';
import { Campaign, CampaignStatus, PlatformType } from '../../../src/types/campaigns';

// Mock intersection observer for virtualization
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockImplementation((callback) => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
}));
window.IntersectionObserver = mockIntersectionObserver;

// Mock resize observer for responsive tests
const mockResizeObserver = jest.fn();
mockResizeObserver.mockImplementation((callback) => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
}));
window.ResizeObserver = mockResizeObserver;

// Mock campaign hook
jest.mock('../../../src/hooks/useCampaign', () => ({
  useCampaign: () => ({
    updateCampaign: jest.fn()
  })
}));

// Helper function to generate mock campaign data
const mockCampaignData = (count: number, overrides: Partial<Campaign> = {}): Campaign[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `campaign-${index}`,
    name: `Test Campaign ${index}`,
    description: 'Test description',
    platformType: 'LINKEDIN' as PlatformType,
    totalBudget: 10000,
    budgetType: 'DAILY',
    dateRange: {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    },
    status: 'ACTIVE' as CampaignStatus,
    metrics: {
      ctr: 0.024,
      conversions: 156,
      cpc: 3.2
    },
    ...overrides
  }));
};

// Helper function to render CampaignList with test props
const renderCampaignList = (props: Partial<typeof CampaignList.defaultProps> = {}) => {
  const defaultProps = {
    campaigns: mockCampaignData(3),
    loading: false,
    selectedIds: [],
    onSelect: jest.fn(),
    onBulkSelect: jest.fn(),
    filterOptions: {
      platforms: [],
      statuses: [],
      dateRange: { startDate: '', endDate: '' },
      searchQuery: '',
      budgetRange: { min: 0, max: 0 }
    },
    sortOptions: {
      field: 'name' as const,
      direction: 'asc' as const
    },
    viewMode: 'grid' as const
  };

  return {
    user: userEvent.setup(),
    ...render(<CampaignList {...defaultProps} {...props} />)
  };
};

describe('CampaignList Component', () => {
  describe('Rendering', () => {
    it('renders empty state correctly', () => {
      renderCampaignList({ campaigns: [] });
      expect(screen.getByText('No campaigns found')).toBeInTheDocument();
    });

    it('displays loading state', () => {
      renderCampaignList({ loading: true });
      expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
      expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');
    });

    it('renders campaign cards with correct data', () => {
      const campaigns = mockCampaignData(3);
      renderCampaignList({ campaigns });

      campaigns.forEach(campaign => {
        const card = screen.getByText(campaign.name).closest('[role="article"]');
        expect(card).toBeInTheDocument();
        expect(within(card!).getByText(campaign.status)).toBeInTheDocument();
        expect(within(card!).getByText(`${(campaign.metrics.ctr * 100).toFixed(1)}%`)).toBeInTheDocument();
      });
    });
  });

  describe('Interaction', () => {
    it('handles campaign selection', async () => {
      const onSelect = jest.fn();
      const campaigns = mockCampaignData(3);
      const { user } = renderCampaignList({ campaigns, onSelect });

      const firstCard = screen.getByText(campaigns[0].name).closest('[role="article"]');
      await user.click(firstCard!);

      expect(onSelect).toHaveBeenCalledWith(campaigns[0].id);
    });

    it('supports keyboard navigation', async () => {
      const campaigns = mockCampaignData(3);
      renderCampaignList({ campaigns });

      const cards = screen.getAllByRole('article');
      cards[0].focus();

      fireEvent.keyDown(cards[0], { key: 'ArrowRight' });
      await waitFor(() => {
        expect(cards[1]).toHaveFocus();
      });

      fireEvent.keyDown(cards[1], { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(cards[0]).toHaveFocus();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('filters campaigns by platform type', () => {
      const campaigns = [
        ...mockCampaignData(2, { platformType: 'LINKEDIN' }),
        ...mockCampaignData(2, { platformType: 'GOOGLE' })
      ];

      renderCampaignList({
        campaigns,
        filterOptions: {
          platforms: ['LINKEDIN'],
          statuses: [],
          dateRange: { startDate: '', endDate: '' },
          searchQuery: '',
          budgetRange: { min: 0, max: 0 }
        }
      });

      const displayedCampaigns = screen.getAllByRole('article');
      expect(displayedCampaigns).toHaveLength(2);
    });

    it('sorts campaigns by specified field', () => {
      const campaigns = mockCampaignData(3);
      renderCampaignList({
        campaigns,
        sortOptions: {
          field: 'name',
          direction: 'desc'
        }
      });

      const campaignNames = screen.getAllByRole('article').map(article => 
        within(article).getByText(/Test Campaign \d/).textContent
      );
      expect(campaignNames).toEqual([...campaignNames].sort().reverse());
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to different screen sizes', () => {
      const { container } = renderCampaignList();

      // Desktop
      expect(container.querySelector('.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3')).toBeInTheDocument();

      // Trigger resize for tablet
      window.innerWidth = 900;
      fireEvent(window, new Event('resize'));
      expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument();

      // Trigger resize for mobile
      window.innerWidth = 600;
      fireEvent(window, new Event('resize'));
      expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides correct ARIA attributes', () => {
      renderCampaignList();
      
      expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Campaign list');
      
      const cards = screen.getAllByRole('article');
      cards.forEach(card => {
        expect(card).toHaveAttribute('tabindex', '0');
        expect(card).toHaveAttribute('aria-label', expect.stringContaining('Campaign:'));
      });
    });

    it('maintains focus management', async () => {
      const { user } = renderCampaignList();
      
      const firstCard = screen.getAllByRole('article')[0];
      await user.tab();
      expect(firstCard).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(firstCard).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Performance', () => {
    it('virtualizes large lists efficiently', async () => {
      const largeCampaignList = mockCampaignData(100);
      renderCampaignList({ campaigns: largeCampaignList });

      // Check that only a subset of campaigns is rendered
      const renderedCards = screen.getAllByRole('article');
      expect(renderedCards.length).toBeLessThan(largeCampaignList.length);
    });

    it('handles rapid scroll events', async () => {
      const campaigns = mockCampaignData(50);
      const { container } = renderCampaignList({ campaigns });

      // Simulate rapid scrolling
      for (let i = 0; i < 5; i++) {
        fireEvent.scroll(container.firstChild!, { target: { scrollTop: i * 500 } });
      }

      // Verify that the virtualization logic handles the scroll events
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });
  });
});