import React, { useCallback, useEffect, useRef, useState } from 'react'; // v18.2.0
import classNames from 'classnames'; // v2.3.2
import { ComponentProps } from '../../types/common';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends ComponentProps {
  // Core props
  value?: string | string[];
  defaultValue?: string | string[];
  options: SelectOption[];
  onChange?: (value: string | string[], event: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLSelectElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLSelectElement>) => void;
  
  // Configuration props
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
  required?: boolean;
  
  // Form and accessibility props
  name?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Select: React.FC<SelectProps> = ({
  // Core props
  value,
  defaultValue,
  options,
  onChange,
  onBlur,
  onFocus,
  
  // Configuration props
  multiple = false,
  disabled = false,
  placeholder = 'Select an option',
  error = false,
  size = 'md',
  required = false,
  
  // Form and accessibility props
  name,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  
  // Base props
  className,
  ...restProps
}) => {
  // Refs
  const selectRef = useRef<HTMLSelectElement>(null);
  
  // State
  const [internalValue, setInternalValue] = useState<string | string[]>(
    defaultValue ?? (multiple ? [] : '')
  );
  const [isFocused, setIsFocused] = useState(false);
  
  // Determine if component is controlled
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Handle value changes
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    event.preventDefault();
    
    let newValue: string | string[];
    
    if (multiple) {
      const selectedOptions = Array.from(event.target.selectedOptions);
      newValue = selectedOptions.map(option => option.value);
    } else {
      newValue = event.target.value;
    }
    
    // Update internal state if uncontrolled
    if (!isControlled) {
      setInternalValue(newValue);
    }
    
    // Call onChange handler if provided
    onChange?.(newValue, event);
  }, [isControlled, multiple, onChange]);

  // Handle focus events
  const handleFocus = useCallback((event: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  }, [onFocus]);

  // Handle blur events
  const handleBlur = useCallback((event: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(false);
    onBlur?.(event);
  }, [onBlur]);

  // Update internal value when controlled value changes
  useEffect(() => {
    if (isControlled) {
      setInternalValue(value);
    }
  }, [isControlled, value]);

  // Generate CSS classes
  const selectClasses = classNames(
    'select-component',
    `select-${size}`,
    {
      'select-error': error,
      'select-disabled': disabled,
      'select-focused': isFocused,
      'select-multiple': multiple,
    },
    className
  );

  return (
    <select
      ref={selectRef}
      id={id}
      name={name}
      value={currentValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      multiple={multiple}
      required={required}
      className={selectClasses}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={error}
      aria-required={required}
      {...restProps}
    >
      {!multiple && (
        <option value="" disabled={required}>
          {placeholder}
        </option>
      )}
      
      {options.map(({ value, label, disabled: optionDisabled }) => (
        <option
          key={value}
          value={value}
          disabled={optionDisabled}
        >
          {label}
        </option>
      ))}
    </select>
  );
};

// Default export for convenient importing
export default Select;