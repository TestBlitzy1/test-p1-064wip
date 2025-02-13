import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx'; // v2.0.0
import { ComponentProps } from '../../types/common';

// Interface extending ComponentProps for checkbox-specific props
export interface CheckboxProps extends ComponentProps {
  /** Unique identifier for the checkbox */
  id?: string;
  /** Name attribute for form submission */
  name: string;
  /** Label text displayed next to checkbox */
  label: string;
  /** Current checked state */
  checked: boolean;
  /** Callback fired when checkbox state changes */
  onChange: (checked: boolean) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Whether the checkbox is in an error state */
  error?: boolean;
  /** Helper text displayed below the checkbox */
  helperText?: string;
  /** Custom aria-label for accessibility */
  ariaLabel?: string;
  /** Custom aria-describedby for linking to helper text */
  ariaDescribedBy?: string;
}

// Default style classes with WCAG AA compliant colors and focus states
const defaultCheckboxClasses = 'inline-flex items-center gap-2 cursor-pointer text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 focus-within:ring-2 focus-within:ring-primary-500';

const checkboxInputClasses = 'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const errorClasses = 'border-red-500 text-red-500 focus:ring-red-500';

const helperTextClasses = 'mt-1 text-sm text-gray-500 dark:text-gray-400';

const errorTextClasses = 'mt-1 text-sm text-red-500 dark:text-red-400';

/**
 * Checkbox component that follows WCAG AA accessibility guidelines
 * with support for form integration, error states, and helper text
 */
const Checkbox: React.FC<CheckboxProps> = React.memo(({
  id,
  name,
  label,
  checked,
  onChange,
  disabled = false,
  error = false,
  helperText,
  className,
  ariaLabel,
  ariaDescribedBy,
}) => {
  // Generate unique IDs for accessibility if not provided
  const checkboxId = useMemo(() => id || `checkbox-${name}-${Math.random().toString(36).substr(2, 9)}`, [id, name]);
  const helperTextId = useMemo(() => `${checkboxId}-helper-text`, [checkboxId]);

  // Merge className props with default styles
  const containerClasses = useMemo(() => 
    clsx(
      defaultCheckboxClasses,
      error && 'text-red-500',
      className
    ),
    [error, className]
  );

  const inputClasses = useMemo(() => 
    clsx(
      checkboxInputClasses,
      error && errorClasses
    ),
    [error]
  );

  // Handle keyboard interactions for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!disabled) {
        onChange(!checked);
      }
    }
  }, [checked, disabled, onChange]);

  // Handle change events
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  }, [onChange]);

  return (
    <div className="flex flex-col">
      <label 
        htmlFor={checkboxId}
        className={containerClasses}
      >
        <input
          type="checkbox"
          id={checkboxId}
          name={name}
          checked={checked}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={inputClasses}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy || (helperText ? helperTextId : undefined)}
          aria-invalid={error}
          role="checkbox"
          aria-checked={checked}
        />
        <span className="select-none">{label}</span>
      </label>

      {helperText && (
        <div
          id={helperTextId}
          className={clsx(
            error ? errorTextClasses : helperTextClasses
          )}
          role="note"
        >
          {helperText}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
Checkbox.displayName = 'Checkbox';

export default Checkbox;