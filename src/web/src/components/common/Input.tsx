import React, { forwardRef, useCallback } from 'react';
import classNames from 'classnames'; // v2.3.2
import type { ComponentProps } from '../../types/common';

// Input component props interface extending base ComponentProps
interface InputProps extends ComponentProps {
  id: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

// Style constants for consistent theming
const baseInputClasses = 'w-full px-4 py-2 text-gray-700 bg-white border rounded-md transition-colors duration-200';
const focusClasses = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const disabledClasses = 'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500';
const errorClasses = 'border-red-500 focus:ring-red-500 focus:border-red-500';
const labelClasses = 'block text-sm font-medium text-gray-700 mb-1';
const errorMessageClasses = 'mt-1 text-sm text-red-600';

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  onKeyUp,
  label,
  placeholder,
  error,
  disabled = false,
  required = false,
  autoComplete,
  inputMode,
  pattern,
  minLength,
  maxLength,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  // Generate unique IDs for accessibility
  const errorId = `${id}-error`;
  const labelId = `${id}-label`;
  
  // Handle input focus with enhanced accessibility
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (disabled) return;
    onFocus?.(event);
  }, [disabled, onFocus]);

  // Handle input blur with validation
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (disabled) return;
    onBlur?.(event);
  }, [disabled, onBlur]);

  // Handle keyboard interactions for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    onKeyDown?.(event);
  }, [disabled, onKeyDown]);

  // Compose input classes based on state
  const inputClasses = classNames(
    baseInputClasses,
    focusClasses,
    disabledClasses,
    {
      [errorClasses]: error,
    },
    className
  );

  return (
    <div className="relative">
      {/* Input Label */}
      {label && (
        <label
          htmlFor={id}
          id={labelId}
          className={labelClasses}
        >
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Input Element */}
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onKeyUp={onKeyUp}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        minLength={minLength}
        maxLength={maxLength}
        className={inputClasses}
        aria-invalid={!!error}
        aria-label={ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={classNames(error ? errorId : null, ariaDescribedBy)}
        {...props}
      />

      {/* Error Message */}
      {error && (
        <div
          id={errorId}
          className={errorMessageClasses}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
Input.displayName = 'Input';

// Default props
Input.defaultProps = {
  type: 'text',
  disabled: false,
  required: false,
};

export default Input;