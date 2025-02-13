import React, { ChangeEvent, KeyboardEvent, useRef } from 'react';
import classNames from 'classnames'; // v2.3.2
import { ComponentProps } from '../../types/common';

// Interface for individual radio options
interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
  ariaLabel?: string;
  description?: string;
}

// Props interface extending base component props
interface RadioGroupProps extends ComponentProps {
  name: string;
  value: string;
  options: RadioOption[];
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  dataTestId?: string;
  onChange: (value: string) => void;
}

// Styling constants using Tailwind classes
const radioGroupClasses = 'flex flex-col gap-2 relative';
const radioItemClasses = 'flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed focus-within:ring-2 focus-within:ring-blue-500 rounded-sm p-1';
const radioInputClasses = 'w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 focus:outline-none';
const labelClasses = 'text-sm font-medium text-gray-700 disabled:text-gray-400 select-none';
const errorClasses = 'text-sm text-red-500 mt-1';

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  options,
  label,
  error,
  disabled = false,
  required = false,
  ariaLabel,
  ariaDescribedBy,
  dataTestId,
  className,
  onChange,
}) => {
  const radioRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);

    // Announce selection to screen readers
    const selectedOption = options.find(opt => opt.value === newValue);
    if (selectedOption) {
      const announcement = `Selected: ${selectedOption.label}`;
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.textContent = announcement;
      document.body.appendChild(liveRegion);
      setTimeout(() => document.body.removeChild(liveRegion), 1000);
    }
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    let nextIndex = -1;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        nextIndex = index === options.length - 1 ? 0 : index + 1;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        nextIndex = index === 0 ? options.length - 1 : index - 1;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }

    // Find next non-disabled option
    while (nextIndex !== index && options[nextIndex].disabled) {
      nextIndex = nextIndex === options.length - 1 ? 0 : nextIndex + 1;
    }

    if (nextIndex !== -1 && !options[nextIndex].disabled) {
      radioRefs.current[nextIndex]?.focus();
      onChange(options[nextIndex].value);
    }
  };

  const groupId = `radio-group-${name}`;
  const errorId = `${groupId}-error`;

  return (
    <div
      className={classNames(radioGroupClasses, className)}
      role="radiogroup"
      aria-label={ariaLabel || label}
      aria-describedby={classNames(ariaDescribedBy, error && errorId)}
      aria-invalid={!!error}
      aria-required={required}
      data-testid={dataTestId}
    >
      {label && (
        <span className={labelClasses} id={`${groupId}-label`}>
          {label}
          {required && <span aria-hidden="true" className="text-red-500 ml-1">*</span>}
        </span>
      )}

      <div className="space-y-2">
        {options.map((option, index) => {
          const optionId = `${groupId}-${option.value}`;
          const isDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={classNames(radioItemClasses, {
                'opacity-50': isDisabled
              })}
            >
              <input
                ref={el => radioRefs.current[index] = el}
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={isDisabled}
                onChange={handleChange}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={radioInputClasses}
                aria-label={option.ariaLabel}
                aria-describedby={option.description ? `${optionId}-description` : undefined}
                required={required}
              />
              <span className={labelClasses}>
                {option.label}
              </span>
              {option.description && (
                <span
                  id={`${optionId}-description`}
                  className="text-sm text-gray-500"
                >
                  {option.description}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {error && (
        <div
          id={errorId}
          className={errorClasses}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default RadioGroup;