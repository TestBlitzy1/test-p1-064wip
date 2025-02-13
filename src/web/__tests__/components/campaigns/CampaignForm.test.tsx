import { render, fireEvent, waitFor, screen, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'; // ^0.34.0
import { faker } from '@faker-js/faker'; // ^8.0.0

import CampaignForm from '../../../src/components/campaigns/CampaignForm';
import { Campaign, PlatformType } from '../../../src/types/campaigns';
import { ApiError } from '../../../src/types/api';

// Mock dependencies
vi.mock('../../../src/hooks/useCampaign', () => ({
  useCampaign: () => ({
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    generateCampaignStructure: mockAIGenerator,
  }),
}));

// Test constants
const GENERATION_TIMEOUT = 30000; // 30-second SLA requirement
const VALID_INDUSTRIES = [
  { id: '1', name: 'Technology' },
  { id: '2', name: 'SaaS' },
];
const VALID_LOCATIONS = [
  { country: 'United States', region: 'California' },
  { country: 'Canada', region: 'Ontario' },
];

// Mock functions
const mockOnSubmit = vi.fn();
const mockOnCancel = vi.fn();
const mockAIGenerator = vi.fn();

// Default test props
const defaultProps = {
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
  onProgressUpdate: vi.fn(),
  initialValues: undefined,
};

// Helper function to generate valid form data
const generateValidFormData = (): Partial<Campaign> => ({
  name: faker.company.name(),
  platformType: faker.helpers.arrayElement(['LINKEDIN', 'GOOGLE', 'BOTH'] as PlatformType[]),
  totalBudget: faker.number.int({ min: 1000, max: 10000 }),
  dateRange: {
    startDate: faker.date.future().toISOString(),
    endDate: faker.date.future().toISOString(),
  },
  targetingSettings: {
    industries: VALID_INDUSTRIES,
    locations: VALID_LOCATIONS,
    jobFunctions: [],
    companySizes: [],
  },
});

// Test setup and cleanup
beforeEach(() => {
  vi.useFakeTimers();
  mockOnSubmit.mockReset();
  mockOnCancel.mockReset();
  mockAIGenerator.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

// Helper function to render component
const renderCampaignForm = (customProps = {}) => {
  const user = userEvent.setup();
  const utils = render(<CampaignForm {...defaultProps} {...customProps} />);
  return {
    user,
    ...utils,
  };
};

describe('CampaignForm Component', () => {
  describe('Form Rendering', () => {
    it('renders all required form fields correctly', () => {
      renderCampaignForm();

      // Basic fields
      expect(screen.getByLabelText(/campaign name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/platform/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total budget/i)).toBeInTheDocument();

      // Platform options
      const platformSelect = screen.getByLabelText(/platform/i);
      expect(within(platformSelect).getByText(/linkedin ads/i)).toBeInTheDocument();
      expect(within(platformSelect).getByText(/google ads/i)).toBeInTheDocument();
      expect(within(platformSelect).getByText(/both platforms/i)).toBeInTheDocument();

      // Targeting section
      expect(screen.getByText(/targeting settings/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/industries/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/locations/i)).toBeInTheDocument();
    });

    it('initializes with provided values when editing existing campaign', () => {
      const initialValues = generateValidFormData();
      renderCampaignForm({ initialValues });

      expect(screen.getByLabelText(/campaign name/i)).toHaveValue(initialValues.name);
      expect(screen.getByLabelText(/platform/i)).toHaveValue(initialValues.platformType);
      expect(screen.getByLabelText(/total budget/i)).toHaveValue(initialValues.totalBudget);
    });
  });

  describe('AI Campaign Generation', () => {
    it('generates AI recommendations within 30-second SLA', async () => {
      const { user } = renderCampaignForm();
      const validData = generateValidFormData();

      // Fill form with valid data
      await user.type(screen.getByLabelText(/campaign name/i), validData.name!);
      await user.selectOptions(screen.getByLabelText(/platform/i), validData.platformType!);
      await user.type(screen.getByLabelText(/total budget/i), validData.totalBudget!.toString());

      // Mock AI generation response
      mockAIGenerator.mockResolvedValueOnce({
        data: {
          ...validData,
          id: faker.string.uuid(),
          adFormats: ['SINGLE_IMAGE'],
          platformSettings: {
            linkedin: {
              campaignType: 'SPONSORED_CONTENT',
              objectiveType: 'AWARENESS',
            },
          },
        },
      });

      // Trigger AI generation
      await user.click(screen.getByLabelText(/platform/i));

      // Verify loading state
      expect(screen.getByText(/generating ai recommendations/i)).toBeInTheDocument();

      // Fast-forward timers
      vi.advanceTimersByTime(GENERATION_TIMEOUT);

      // Verify completion within SLA
      await waitFor(() => {
        expect(screen.queryByText(/generating ai recommendations/i)).not.toBeInTheDocument();
      });

      expect(mockAIGenerator).toHaveBeenCalledWith({
        platformType: validData.platformType,
        targetingSettings: validData.targetingSettings,
        budget: validData.totalBudget,
      });
    });

    it('handles AI generation failures gracefully', async () => {
      const { user } = renderCampaignForm();
      const validData = generateValidFormData();

      // Mock AI generation failure
      const error: ApiError = {
        code: 'GENERATION_FAILED',
        message: 'Failed to generate campaign structure',
        details: {},
        timestamp: new Date().toISOString(),
      };
      mockAIGenerator.mockRejectedValueOnce(error);

      // Fill form and trigger generation
      await user.type(screen.getByLabelText(/campaign name/i), validData.name!);
      await user.selectOptions(screen.getByLabelText(/platform/i), validData.platformType!);

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/failed to generate campaign structure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Platform-Specific Validation', () => {
    it('validates LinkedIn-specific requirements', async () => {
      const { user } = renderCampaignForm();
      const validData = generateValidFormData();
      validData.platformType = 'LINKEDIN';

      // Fill form with LinkedIn-specific data
      await user.type(screen.getByLabelText(/campaign name/i), validData.name!);
      await user.selectOptions(screen.getByLabelText(/platform/i), 'LINKEDIN');
      await user.type(screen.getByLabelText(/total budget/i), validData.totalBudget!.toString());

      // Submit form
      await user.click(screen.getByRole('button', { name: /create campaign/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        platformType: 'LINKEDIN',
        targetingSettings: expect.any(Object),
      }));
    });

    it('validates Google Ads-specific requirements', async () => {
      const { user } = renderCampaignForm();
      const validData = generateValidFormData();
      validData.platformType = 'GOOGLE';

      // Fill form with Google Ads-specific data
      await user.type(screen.getByLabelText(/campaign name/i), validData.name!);
      await user.selectOptions(screen.getByLabelText(/platform/i), 'GOOGLE');
      await user.type(screen.getByLabelText(/total budget/i), validData.totalBudget!.toString());

      // Submit form
      await user.click(screen.getByRole('button', { name: /create campaign/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        platformType: 'GOOGLE',
        targetingSettings: expect.any(Object),
      }));
    });
  });

  describe('Form Submission', () => {
    it('handles successful form submission', async () => {
      const { user } = renderCampaignForm();
      const validData = generateValidFormData();

      // Fill form with valid data
      await user.type(screen.getByLabelText(/campaign name/i), validData.name!);
      await user.selectOptions(screen.getByLabelText(/platform/i), validData.platformType!);
      await user.type(screen.getByLabelText(/total budget/i), validData.totalBudget!.toString());

      // Submit form
      await user.click(screen.getByRole('button', { name: /create campaign/i }));

      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining(validData));
    });

    it('handles form cancellation', async () => {
      const { user } = renderCampaignForm();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});