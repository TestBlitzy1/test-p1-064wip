import { useState, useCallback } from 'react'; // v18.2.0
import { validateCampaign } from '../lib/utils/validation';
import { validateEmail } from '../lib/utils/validation';
import { useNotification } from './useNotification';
import type { ErrorResponse } from '../types/common';

// Validation schema type definitions
type ValidationRule<T> = {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T) => boolean | Promise<boolean>;
  message: string;
};

type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

// Form state interface
interface FormState<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  isValid: boolean;
  isDirty: boolean;
}

// Form handlers interface
interface FormHandlers<T> {
  handleChange: (field: keyof T) => (value: T[keyof T]) => Promise<void>;
  handleBlur: (field: keyof T) => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
}

/**
 * Advanced form management hook with validation and error handling
 * @param initialValues - Initial form values
 * @param validationSchema - Form validation schema
 * @param onSubmit - Form submission handler
 */
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationSchema: ValidationSchema<T>,
  onSubmit: (values: T) => Promise<void>
): FormState<T> & FormHandlers<T> {
  // Initialize form state
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string>>({} as Record<keyof T, string>);
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const { error: showError } = useNotification();

  // Validate a single field
  const validateField = useCallback(async (
    field: keyof T,
    value: T[keyof T]
  ): Promise<string> => {
    const rules = validationSchema[field];
    if (!rules) return '';

    // Required field validation
    if (rules.required && !value) {
      return rules.message || 'This field is required';
    }

    // Minimum value/length validation
    if (rules.min !== undefined) {
      const length = typeof value === 'string' ? value.length : value;
      if (length < rules.min) {
        return `Minimum ${typeof value === 'string' ? 'length' : 'value'} is ${rules.min}`;
      }
    }

    // Maximum value/length validation
    if (rules.max !== undefined) {
      const length = typeof value === 'string' ? value.length : value;
      if (length > rules.max) {
        return `Maximum ${typeof value === 'string' ? 'length' : 'value'} is ${rules.max}`;
      }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return rules.message || 'Invalid format';
    }

    // Custom validation
    if (rules.custom) {
      try {
        const isValid = await rules.custom(value);
        if (!isValid) {
          return rules.message || 'Validation failed';
        }
      } catch (err) {
        return 'Validation error occurred';
      }
    }

    return '';
  }, [validationSchema]);

  // Validate all fields
  const validateForm = useCallback(async (formValues: T): Promise<Record<keyof T, string>> => {
    setIsValidating(true);
    const validationErrors: Record<keyof T, string> = {} as Record<keyof T, string>;
    
    try {
      // Validate each field
      await Promise.all(
        Object.keys(formValues).map(async (key) => {
          const field = key as keyof T;
          const error = await validateField(field, formValues[field]);
          if (error) {
            validationErrors[field] = error;
          }
        })
      );

      // Campaign-specific validation if the form contains campaign data
      if ('platformType' in formValues) {
        const campaignValidation = await validateCampaign(formValues as any);
        if (!campaignValidation.isValid) {
          campaignValidation.errors.forEach((error: ErrorResponse) => {
            const field = error.details?.field as keyof T;
            if (field) {
              validationErrors[field] = error.message;
            }
          });
        }
      }

      // Email validation for fields containing 'email'
      Object.keys(formValues).forEach((key) => {
        const field = key as keyof T;
        if (
          field.toString().toLowerCase().includes('email') &&
          typeof formValues[field] === 'string' &&
          !validateEmail(formValues[field] as string)
        ) {
          validationErrors[field] = 'Invalid email address';
        }
      });
    } catch (err) {
      showError('Validation error occurred');
    } finally {
      setIsValidating(false);
    }

    return validationErrors;
  }, [validateField, showError]);

  // Handle field change
  const handleChange = useCallback((field: keyof T) => async (value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);

    const fieldError = await validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: fieldError }));
  }, [validateField]);

  // Handle field blur
  const handleBlur = useCallback(async (field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const fieldError = await validateField(field, values[field]);
    setErrors(prev => ({ ...prev, [field]: fieldError }));
  }, [validateField, values]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validationErrors = await validateForm(values);
      const hasErrors = Object.keys(validationErrors).length > 0;

      if (hasErrors) {
        setErrors(validationErrors);
        setTouched(
          Object.keys(values).reduce((acc, key) => ({
            ...acc,
            [key]: true
          }), {} as Record<keyof T, boolean>)
        );
        showError('Please fix the validation errors');
        return;
      }

      await onSubmit(values);
    } catch (err) {
      showError('Form submission failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateForm, onSubmit, showError]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, string>);
    setTouched({} as Record<keyof T, boolean>);
    setIsSubmitting(false);
    setIsValidating(false);
    setIsDirty(false);
  }, [initialValues]);

  return {
    // Form state
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    isValid: Object.keys(errors).length === 0,
    isDirty,

    // Form handlers
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm
  };
}

export default useForm;