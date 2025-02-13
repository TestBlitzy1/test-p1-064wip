import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TargetingForm from '../../../src/components/targeting/TargetingForm';
import { AudienceSegment, TargetingRule, Platform, AIRecommendation } from '../../../src/types/targeting';
import useTargeting from '../../../src/hooks/useTargeting';

// Mock useTargeting hook
vi.mock('../../../src/hooks/useTargeting');

// Test data constants
const mockPlatformConstraints = {
  maxRules: 10,
  supportedRuleTypes: ['industry', 'company_size', 'job_title', 'location'],
  industry: {
    requiresSubsidiaryFlag: true,
    maxIndustries: 5
  },
  companySize: {
    ranges: [
      { min: 1, max: 10 },
      { min: 11, max: 50 },
      { min: 51, max: 200 }
    ]
  },
  jobTitles: ['CEO', 'CTO', 'Manager'],
  location: {
    countries: ['US', 'UK', 'CA']
  }
};

const mockInitialValues: Partial<AudienceSegment> = {
  id: 'test-segment',
  name: 'Test Segment',
  platform: 'linkedin',
  targetingRules: []
};

const mockAIRecommendations: AIRecommendation[] = [
  {
    id: 'rec-1',
    type: 'industry',
    value: 'Technology',
    confidence: 0.95,
    description: 'Add Technology industry for better reach'
  }
];

// Helper function to render component with test providers
const renderTargetingForm = (props = {}) => {
  const defaultProps = {
    platform: 'linkedin' as Platform,
    initialValues: mockInitialValues,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...props
  };

  return render(<TargetingForm {...defaultProps} />);
};

// Helper function to setup targeting hook mock
const mockTargetingHook = (mockImplementation = {}) => {
  const defaultMock = {
    segments: [],
    platformConstraints: mockPlatformConstraints,
    validateRules: vi.fn().mockResolvedValue(true),
    performanceMetrics: {
      validationTime: 100,
      optimizationTime: 200
    },
    aiInsights: {
      estimatedReach: 50000,
      confidence: 0.85,
      recommendations: mockAIRecommendations
    },
    error: null
  };

  (useTargeting as jest.Mock).mockReturnValue({
    ...defaultMock,
    ...mockImplementation
  });
};

describe('TargetingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargetingHook();
  });

  describe('Rendering', () => {
    it('should render all form fields with correct labels', () => {
      renderTargetingForm();

      expect(screen.getByLabelText(/Industry/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Company Size/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Job Titles/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    });

    it('should show loading state during processing', async () => {
      renderTargetingForm();
      
      const submitButton = screen.getByRole('button', { name: /save targeting/i });
      fireEvent.click(submitButton);

      expect(screen.getByText(/processing/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should display AI recommendations when available', async () => {
      renderTargetingForm();

      await waitFor(() => {
        expect(screen.getByRole('complementary')).toBeInTheDocument();
        expect(screen.getByText(/AI-Powered Recommendations/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      renderTargetingForm();
      
      const submitButton = screen.getByRole('button', { name: /save targeting/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/select at least one industry/i)).toBeInTheDocument();
        expect(screen.getByText(/select at least one company size/i)).toBeInTheDocument();
      });
    });

    it('should enforce platform-specific constraints', async () => {
      mockTargetingHook({
        validateRules: vi.fn().mockResolvedValue(false)
      });

      renderTargetingForm();

      const industrySelect = screen.getByLabelText(/Industry/i);
      await userEvent.selectOptions(industrySelect, ['Technology', 'Healthcare', 'Finance', 'Retail', 'Education', 'Manufacturing']);

      await waitFor(() => {
        expect(screen.getByText(/maximum 5 industries allowed/i)).toBeInTheDocument();
      });
    });
  });

  describe('AI Integration', () => {
    it('should apply AI suggestions when clicked', async () => {
      renderTargetingForm();

      const suggestionButton = await screen.findByRole('button', { name: /apply suggestion/i });
      await userEvent.click(suggestionButton);

      await waitFor(() => {
        expect(screen.getByText(/Technology/i)).toBeInTheDocument();
      });
    });

    it('should update estimated reach when targeting changes', async () => {
      renderTargetingForm();

      const industrySelect = screen.getByLabelText(/Industry/i);
      await userEvent.selectOptions(industrySelect, ['Technology']);

      await waitFor(() => {
        expect(screen.getByText(/50,000 users/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should debounce validation calls', async () => {
      const validateRules = vi.fn().mockResolvedValue(true);
      mockTargetingHook({ validateRules });

      renderTargetingForm();

      const industrySelect = screen.getByLabelText(/Industry/i);
      await userEvent.selectOptions(industrySelect, ['Technology']);
      await userEvent.selectOptions(industrySelect, ['Healthcare']);

      await waitFor(() => {
        expect(validateRules).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderTargetingForm();

      expect(screen.getByRole('form')).toHaveAttribute('aria-label', 'Audience Targeting Form');
      expect(screen.getByRole('complementary')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should maintain focus management', async () => {
      renderTargetingForm();

      const industrySelect = screen.getByLabelText(/Industry/i);
      await userEvent.tab();
      expect(industrySelect).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('should display API errors', async () => {
      mockTargetingHook({
        error: 'Failed to validate targeting rules'
      });

      renderTargetingForm();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to validate targeting rules');
      });
    });

    it('should handle validation errors gracefully', async () => {
      mockTargetingHook({
        validateRules: vi.fn().mockRejectedValue(new Error('Validation failed'))
      });

      renderTargetingForm();

      const submitButton = screen.getByRole('button', { name: /save targeting/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});