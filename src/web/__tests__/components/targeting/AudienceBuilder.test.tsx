import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import AudienceBuilder from '../../../src/components/targeting/AudienceBuilder';
import { useTargeting } from '../../../src/hooks/useTargeting';
import type {
  AudienceSegment,
  TargetingRule,
  Platform,
  PlatformConstraints
} from '../../../src/types/targeting';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock useTargeting hook
vi.mock('../../../src/hooks/useTargeting');

// Mock initial test data
const mockPlatformConstraints: PlatformConstraints = {
  platform: 'linkedin',
  maxRules: 20,
  supportedRuleTypes: ['industry', 'company_size', 'job_title', 'location'],
  minReach: 1000,
  maxReach: 1000000,
  ruleSpecificConstraints: {
    industry: {
      maxIndustries: 50,
      requiresSubsidiaryFlag: true
    },
    companySize: {
      minAllowed: 10,
      maxAllowed: 10000
    },
    location: {
      maxLocations: 100,
      supportedRadii: [10, 25, 50, 100]
    }
  }
};

const mockInitialSegment: AudienceSegment = {
  id: 'test-segment-1',
  name: 'Test Segment',
  description: 'Test segment description',
  platform: 'linkedin',
  targetingRules: [],
  estimatedReach: 50000,
  confidence: 0.85,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe('AudienceBuilder', () => {
  // Setup mock functions
  const mockCreateSegment = vi.fn();
  const mockValidateRules = vi.fn();
  const mockOptimizeTargeting = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup useTargeting mock implementation
    (useTargeting as jest.Mock).mockReturnValue({
      segments: [],
      createSegment: mockCreateSegment,
      validateRules: mockValidateRules,
      optimizeTargeting: mockOptimizeTargeting,
      platformConstraints: { linkedin: mockPlatformConstraints },
      performanceMetrics: {
        validationTime: 150,
        optimizationTime: 200
      }
    });

    // Setup default mock responses
    mockValidateRules.mockResolvedValue(true);
    mockCreateSegment.mockResolvedValue({ ...mockInitialSegment, id: 'new-segment-1' });
  });

  it('should render audience builder with accessibility support', async () => {
    const { container } = render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify essential elements are present
    expect(screen.getByText(/Create Audience Segment/i)).toBeInTheDocument();
    expect(screen.getByText(/Targeting Rules/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Rule/i })).toBeInTheDocument();
  });

  it('should validate targeting rules with platform constraints', async () => {
    render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Add a targeting rule
    const addRuleButton = screen.getByRole('button', { name: /Add Rule/i });
    await userEvent.click(addRuleButton);

    // Verify validation is called
    await waitFor(() => {
      expect(mockValidateRules).toHaveBeenCalled();
    });

    // Verify platform constraints are enforced
    await userEvent.click(addRuleButton);
    await userEvent.click(addRuleButton);

    expect(screen.getByText(/Targeting Rules/i)).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: /Targeting rule/i })).toHaveLength(3);
  });

  it('should handle rule validation errors appropriately', async () => {
    mockValidateRules.mockResolvedValueOnce(false);

    render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Add an invalid rule
    await userEvent.click(screen.getByRole('button', { name: /Add Rule/i }));

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Invalid targeting rules configuration/i)).toBeInTheDocument();
    });
  });

  it('should save segment when validation passes', async () => {
    render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Add valid rules
    await userEvent.click(screen.getByRole('button', { name: /Add Rule/i }));
    
    // Click save
    const saveButton = screen.getByRole('button', { name: /Save/i });
    await userEvent.click(saveButton);

    // Verify save flow
    await waitFor(() => {
      expect(mockValidateRules).toHaveBeenCalled();
      expect(mockCreateSegment).toHaveBeenCalled();
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('should display performance metrics', async () => {
    render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Verify performance metrics are displayed
    expect(screen.getByText(/Validation time: 150ms/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated reach: 50,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence score: 85.0%/i)).toBeInTheDocument();
  });

  it('should handle platform-specific rule constraints', async () => {
    render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Add maximum allowed rules
    for (let i = 0; i < mockPlatformConstraints.maxRules + 1; i++) {
      await userEvent.click(screen.getByRole('button', { name: /Add Rule/i }));
    }

    // Verify max rules constraint is enforced
    await waitFor(() => {
      expect(screen.getByText(/Maximum of 20 rules allowed/i)).toBeInTheDocument();
    });
  });

  it('should handle cancellation', async () => {
    render(
      <AudienceBuilder
        platform="linkedin"
        initialSegment={mockInitialSegment}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onError={mockOnError}
      />
    );

    // Click cancel
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Verify cancel callback is called
    expect(mockOnCancel).toHaveBeenCalled();
  });
});