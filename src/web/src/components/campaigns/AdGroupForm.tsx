import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.2
import { useForm } from '../../hooks/useForm';
import { Input } from '../common/Input';
import type { AdGroup } from '../../types/campaigns';
import { useNotification } from '../../hooks/useNotification';

// Validation constants
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 100;

// Interface for form props with enhanced accessibility
interface AdGroupFormProps {
  initialData?: Partial<AdGroup>;
  onSubmit: (data: AdGroup) => Promise<void>;
  onCancel: () => void;
  campaignBudget: number;
  isSubmitting?: boolean;
  formId?: string;
  aria?: {
    labelledBy?: string;
    describedBy?: string;
  };
}

// Validation function for ad group form
const validateAdGroupForm = (
  values: Partial<AdGroup>,
  campaignBudget: number
): Record<string, string> => {
  const errors: Record<string, string> = {};

  // Name validation
  if (!values.name) {
    errors.name = 'Ad group name is required';
  } else if (values.name.length < MIN_NAME_LENGTH) {
    errors.name = `Name must be at least ${MIN_NAME_LENGTH} characters`;
  } else if (values.name.length > MAX_NAME_LENGTH) {
    errors.name = `Name cannot exceed ${MAX_NAME_LENGTH} characters`;
  }

  // Budget validation
  if (!values.budget) {
    errors.budget = 'Budget is required';
  } else if (typeof values.budget === 'number') {
    if (values.budget <= 0) {
      errors.budget = 'Budget must be greater than zero';
    } else if (values.budget > campaignBudget) {
      errors.budget = `Budget cannot exceed campaign budget of ${campaignBudget}`;
    }
  } else {
    errors.budget = 'Invalid budget value';
  }

  // Status validation
  if (!values.status) {
    errors.status = 'Status is required';
  }

  return errors;
};

export const AdGroupForm: React.FC<AdGroupFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  campaignBudget,
  isSubmitting = false,
  formId = 'adGroupForm',
  aria
}) => {
  const { success, error: showError } = useNotification();

  // Initialize form with validation
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid,
    isDirty
  } = useForm<Partial<AdGroup>>(
    initialData,
    (formValues) => validateAdGroupForm(formValues, campaignBudget),
    async (formData) => {
      try {
        await onSubmit(formData as AdGroup);
        success('Ad group saved successfully');
      } catch (err) {
        showError('Failed to save ad group');
      }
    }
  );

  // Memoized form field classes
  const inputClasses = useMemo(() => 
    classNames(
      'w-full mb-4',
      'transition-all duration-200',
      { 'opacity-50 pointer-events-none': isSubmitting }
    ),
    [isSubmitting]
  );

  // Handle form submission
  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    handleSubmit(e);
  }, [handleSubmit, isSubmitting]);

  return (
    <form
      id={formId}
      onSubmit={handleFormSubmit}
      className="w-full max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md"
      aria-labelledby={aria?.labelledBy}
      aria-describedby={aria?.describedBy}
      noValidate
    >
      {/* Ad Group Name */}
      <div className={inputClasses}>
        <Input
          id={`${formId}-name`}
          name="name"
          label="Ad Group Name"
          value={values.name || ''}
          onChange={(e) => handleChange('name')(e.target.value)}
          onBlur={() => handleBlur('name')}
          error={touched.name ? errors.name : undefined}
          required
          minLength={MIN_NAME_LENGTH}
          maxLength={MAX_NAME_LENGTH}
          disabled={isSubmitting}
          aria-label="Ad group name"
        />
      </div>

      {/* Ad Group Budget */}
      <div className={inputClasses}>
        <Input
          id={`${formId}-budget`}
          name="budget"
          type="number"
          label="Budget"
          value={values.budget?.toString() || ''}
          onChange={(e) => handleChange('budget')(Number(e.target.value))}
          onBlur={() => handleBlur('budget')}
          error={touched.budget ? errors.budget : undefined}
          required
          min={0}
          max={campaignBudget}
          disabled={isSubmitting}
          aria-label="Ad group budget"
        />
      </div>

      {/* Ad Group Status */}
      <div className={inputClasses}>
        <label
          htmlFor={`${formId}-status`}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Status
        </label>
        <select
          id={`${formId}-status`}
          name="status"
          value={values.status || ''}
          onChange={(e) => handleChange('status')(e.target.value)}
          onBlur={() => handleBlur('status')}
          className={classNames(
            'w-full px-4 py-2 border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            { 'border-red-500': touched.status && errors.status }
          )}
          disabled={isSubmitting}
          required
          aria-label="Ad group status"
          aria-invalid={touched.status && !!errors.status}
        >
          <option value="">Select Status</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
        </select>
        {touched.status && errors.status && (
          <div className="mt-1 text-sm text-red-600" role="alert">
            {errors.status}
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className={classNames(
            'px-4 py-2 text-gray-700 bg-gray-100 rounded-md',
            'hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500',
            { 'opacity-50 cursor-not-allowed': isSubmitting }
          )}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={classNames(
            'px-4 py-2 text-white bg-blue-600 rounded-md',
            'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
            {
              'opacity-50 cursor-not-allowed': isSubmitting || !isValid || !isDirty
            }
          )}
          disabled={isSubmitting || !isValid || !isDirty}
        >
          {isSubmitting ? 'Saving...' : 'Save Ad Group'}
        </button>
      </div>
    </form>
  );
};

export default AdGroupForm;