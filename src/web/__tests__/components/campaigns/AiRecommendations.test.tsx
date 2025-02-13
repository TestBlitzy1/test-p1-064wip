import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import AiRecommendations from '../../../src/components/campaigns/AiRecommendations';
import { useCampaign } from '../../../src/hooks/useCampaign';
import { RecommendationType, Campaign } from '../../../src/types/campaigns';

// Mock the useCampaign hook
jest.mock('../../../src/hooks/useCampaign');

// Mock data for testing
const mockRecommendations: RecommendationType[] = [
  {
    id: '1',
    type: 'targeting',
    content: 'Technology Decision Makers',
    confidenceScore: 0.95,
    metrics: {
      potentialReach: 1200000,
      estimatedCtr: 0.024
    },
    platformValidation: {
      isValid: true,
      errors: []
    }
  },
  {
    id: '2',
    type: 'targeting',
    content: 'Senior IT Leaders',
    confidenceScore: 0.88,
    metrics: {
      potentialReach: 800000,
      estimatedCtr: 0.021
    },
    platformValidation: {
      isValid: true,
      errors: []
    }
  }
];

const mockCampaign: Campaign = {
  id: crypto.randomUUID(),
  platformType: 'LINKEDIN',
  optimizationHints: {
    suggestedBidAdjustments: [
      {
        dimension: 'Technology Decision Makers',
        factor: 1.2,
        confidence: 0.95
      },
      {
        dimension: 'Senior IT Leaders',
        factor: 1.1,
        confidence: 0.88
      }
    ]
  }
} as Campaign;

describe('AiRecommendations', () => {
  const mockOnSelect = jest.fn();
  const mockGenerateCampaignStructure = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementation for useCampaign
    (useCampaign as jest.Mock).mockReturnValue({
      generateCampaignStructure: mockGenerateCampaignStructure,
      error: null,
      loading: false
    });

    mockGenerateCampaignStructure.mockResolvedValue(mockCampaign);
  });

  it('should render recommendations within 30-second SLA', async () => {
    // Start performance timer
    const startTime = performance.now();

    render(
      <AiRecommendations
        campaignId="test-campaign"
        platformType="linkedin"
        onSelect={mockOnSelect}
      />
    );

    // Click generate button
    const generateButton = screen.getByRole('button', { name: /generate recommendations/i });
    await userEvent.click(generateButton);

    // Wait for recommendations to appear
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /ai recommendations list/i })).toBeInTheDocument();
    });

    // Verify SLA compliance
    const processingTime = performance.now() - startTime;
    expect(processingTime).toBeLessThan(30000);
  });

  it('should display loading state with progress indicator', async () => {
    render(
      <AiRecommendations
        campaignId="test-campaign"
        platformType="linkedin"
        onSelect={mockOnSelect}
      />
    );

    const generateButton = screen.getByRole('button', { name: /generate recommendations/i });
    await userEvent.click(generateButton);

    // Verify loading spinner and progress bar
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/generating recommendations/i)).toBeInTheDocument();
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('should handle multiple recommendation selection', async () => {
    render(
      <AiRecommendations
        campaignId="test-campaign"
        platformType="linkedin"
        onSelect={mockOnSelect}
      />
    );

    // Generate recommendations
    const generateButton = screen.getByRole('button', { name: /generate recommendations/i });
    await userEvent.click(generateButton);

    // Wait for recommendations to load
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /ai recommendations list/i })).toBeInTheDocument();
    });

    // Select recommendations
    const recommendations = screen.getAllByRole('button').filter(
      button => button.textContent?.includes('Technology Decision Makers') ||
                button.textContent?.includes('Senior IT Leaders')
    );

    // Click multiple recommendations
    await userEvent.click(recommendations[0]);
    await userEvent.click(recommendations[1]);

    // Apply selections
    const applyButton = screen.getByRole('button', { name: /apply selected/i });
    await userEvent.click(applyButton);

    // Verify selection callback
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Technology Decision Makers' }),
        expect.objectContaining({ content: 'Senior IT Leaders' })
      ])
    );
  });

  it('should meet accessibility requirements', async () => {
    const { container } = render(
      <AiRecommendations
        campaignId="test-campaign"
        platformType="linkedin"
        onSelect={mockOnSelect}
      />
    );

    // Check ARIA attributes
    expect(screen.getByRole('button', { name: /generate recommendations/i }))
      .toHaveAttribute('aria-label', 'Generate AI recommendations');

    // Verify keyboard navigation
    const generateButton = screen.getByRole('button', { name: /generate recommendations/i });
    generateButton.focus();
    expect(document.activeElement).toBe(generateButton);

    // Generate recommendations
    await userEvent.click(generateButton);
    await waitFor(() => {
      expect(screen.getByRole('list', { name: /ai recommendations list/i })).toBeInTheDocument();
    });

    // Check recommendation cards for accessibility
    const cards = screen.getAllByRole('button').filter(
      button => button.className.includes('Card')
    );
    cards.forEach(card => {
      expect(card).toHaveAttribute('aria-label');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  it('should handle errors gracefully', async () => {
    // Mock error scenario
    mockGenerateCampaignStructure.mockRejectedValue({
      code: 'GENERATION_ERROR',
      message: 'Failed to generate recommendations'
    });

    render(
      <AiRecommendations
        campaignId="test-campaign"
        platformType="linkedin"
        onSelect={mockOnSelect}
      />
    );

    const generateButton = screen.getByRole('button', { name: /generate recommendations/i });
    await userEvent.click(generateButton);

    // Verify error display
    await waitFor(() => {
      expect(screen.getByText(/failed to generate recommendations/i)).toBeInTheDocument();
    });

    // Verify retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });
});