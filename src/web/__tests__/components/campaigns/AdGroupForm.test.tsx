import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NotificationContext } from '../../../src/providers/NotificationProvider';
import AdGroupForm from '../../../src/components/campaigns/AdGroupForm';
import type { AdGroup } from '../../../src/types/campaigns';

// Mock data
const mockAdGroup: AdGroup = {
  id: 'test-id',
  name: 'Test Ad Group',
  budget: 1000,
  status: 'DRAFT',
  campaignId: 'test-campaign-id'
};

const mockCampaignBudget = 5000;

// Mock handlers
const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();
const mockNotification = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  show: jest.fn()
};

// Helper function to render component with context
const renderAdGroupForm = (props = {}) => {
  const defaultProps = {
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    campaignBudget: mockCampaignBudget,
    initialData: mockAdGroup,
    formId: 'test-form'
  };

  return render(
    <NotificationContext.Provider value={mockNotification}>
      <AdGroupForm {...defaultProps} {...props} />
    </NotificationContext.Provider>
  );
};

describe('AdGroupForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all form fields with correct attributes', () => {
      renderAdGroupForm();

      // Name field
      const nameInput = screen.getByLabelText(/ad group name/i);
      expect(nameInput).toHaveAttribute('type', 'text');
      expect(nameInput).toHaveAttribute('required');
      expect(nameInput).toHaveValue(mockAdGroup.name);

      // Budget field
      const budgetInput = screen.getByLabelText(/budget/i);
      expect(budgetInput).toHaveAttribute('type', 'number');
      expect(budgetInput).toHaveAttribute('required');
      expect(budgetInput).toHaveValue(mockAdGroup.budget);

      // Status field
      const statusSelect = screen.getByLabelText(/status/i);
      expect(statusSelect).toBeInTheDocument();
      expect(statusSelect).toHaveValue(mockAdGroup.status);
    });

    it('applies proper ARIA attributes for accessibility', () => {
      renderAdGroupForm();

      // Form accessibility
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('noValidate');

      // Input fields accessibility
      const nameInput = screen.getByLabelText(/ad group name/i);
      expect(nameInput).toHaveAttribute('aria-invalid', 'false');
      expect(nameInput).toHaveAttribute('aria-required', 'true');

      // Status select accessibility
      const statusSelect = screen.getByLabelText(/status/i);
      expect(statusSelect).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('Validation', () => {
    it('displays validation errors for invalid inputs', async () => {
      const user = userEvent.setup();
      renderAdGroupForm({ initialData: {} });

      // Submit empty form
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Check for validation messages
      expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/budget is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/status is required/i)).toBeInTheDocument();
    });

    it('validates budget against campaign budget', async () => {
      const user = userEvent.setup();
      renderAdGroupForm();

      // Enter budget exceeding campaign budget
      const budgetInput = screen.getByLabelText(/budget/i);
      await user.clear(budgetInput);
      await user.type(budgetInput, '6000');
      await user.tab();

      // Check for budget validation message
      expect(await screen.findByText(/cannot exceed campaign budget/i)).toBeInTheDocument();
    });

    it('validates name length requirements', async () => {
      const user = userEvent.setup();
      renderAdGroupForm();

      // Test short name
      const nameInput = screen.getByLabelText(/ad group name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'ab');
      await user.tab();

      expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();

      // Test long name
      await user.clear(nameInput);
      await user.type(nameInput, 'a'.repeat(101));
      await user.tab();

      expect(await screen.findByText(/cannot exceed 100 characters/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits valid form data successfully', async () => {
      const user = userEvent.setup();
      renderAdGroupForm();

      // Update form with valid data
      await user.type(screen.getByLabelText(/ad group name/i), 'Updated Ad Group');
      await user.type(screen.getByLabelText(/budget/i), '2000');
      await user.selectOptions(screen.getByLabelText(/status/i), 'ACTIVE');

      // Submit form
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Verify submission
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          ...mockAdGroup,
          name: 'Updated Ad Group',
          budget: 2000,
          status: 'ACTIVE'
        });
      });

      expect(mockNotification.success).toHaveBeenCalledWith('Ad group saved successfully');
    });

    it('handles submission errors appropriately', async () => {
      const user = userEvent.setup();
      const submitError = new Error('Submission failed');
      const mockFailedSubmit = jest.fn().mockRejectedValue(submitError);

      renderAdGroupForm({ onSubmit: mockFailedSubmit });

      // Submit form
      await user.click(screen.getByRole('button', { name: /save/i }));

      // Verify error handling
      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalledWith('Failed to save ad group');
      });
    });
  });

  describe('Form Controls', () => {
    it('disables submit button when form is invalid', async () => {
      const user = userEvent.setup();
      renderAdGroupForm({ initialData: {} });

      const submitButton = screen.getByRole('button', { name: /save/i });
      expect(submitButton).toBeDisabled();

      // Fill form partially
      await user.type(screen.getByLabelText(/ad group name/i), 'Test');
      expect(submitButton).toBeDisabled();
    });

    it('handles cancel action correctly', async () => {
      const user = userEvent.setup();
      renderAdGroupForm();

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderAdGroupForm();

      // Tab through form fields
      await user.tab(); // Focus name input
      expect(screen.getByLabelText(/ad group name/i)).toHaveFocus();

      await user.tab(); // Focus budget input
      expect(screen.getByLabelText(/budget/i)).toHaveFocus();

      await user.tab(); // Focus status select
      expect(screen.getByLabelText(/status/i)).toHaveFocus();
    });

    it('announces validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderAdGroupForm({ initialData: {} });

      await user.click(screen.getByRole('button', { name: /save/i }));

      const errors = await screen.findAllByRole('alert');
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach(error => {
        expect(error).toHaveAttribute('role', 'alert');
      });
    });
  });
});