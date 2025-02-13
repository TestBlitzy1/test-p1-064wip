import React, { useState, useCallback, useMemo } from 'react';
import ReactDatePicker from 'react-datepicker'; // v4.x
import classNames from 'classnames'; // v2.x
import { DateRange } from '../../types/common';
import { formatDate, isValidDate, dateFormats, dateErrors } from '../../lib/utils/date';

// Import required CSS for react-datepicker
import 'react-datepicker/dist/react-datepicker.css';

interface ValidationError {
  message: string;
  type: 'error' | 'warning';
}

interface DatePickerProps {
  /** Enable date range selection mode */
  isRange?: boolean;
  /** Date format string for display */
  dateFormat?: string;
  /** Placeholder text when no date is selected */
  placeholderText?: string;
  /** Callback for single date selection */
  onChange?: (date: string | null) => void;
  /** Callback for date range selection */
  onRangeChange?: (range: DateRange | null) => void;
  /** Selected date for single date mode */
  value?: string | null;
  /** Selected date range for range mode */
  rangeValue?: DateRange | null;
  /** Disable the date picker */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Show loading state */
  isLoading?: boolean;
  /** Required field */
  required?: boolean;
}

/**
 * A fully accessible date picker component supporting both single date and date range selection.
 * Implements WCAG AA standards and provides comprehensive validation and error handling.
 */
export const CustomDatePicker: React.FC<DatePickerProps> = React.memo(({
  isRange = false,
  dateFormat = dateFormats.display,
  placeholderText,
  onChange,
  onRangeChange,
  value = null,
  rangeValue = null,
  disabled = false,
  className,
  minDate,
  maxDate,
  ariaLabel,
  isLoading = false,
  required = false,
}) => {
  // State for internal date management and validation
  const [error, setError] = useState<ValidationError | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Convert string dates to Date objects for internal use
  const selectedDate = useMemo(() => (
    value ? new Date(value) : null
  ), [value]);

  const selectedRange = useMemo(() => ({
    start: rangeValue?.startDate ? new Date(rangeValue.startDate) : null,
    end: rangeValue?.endDate ? new Date(rangeValue.endDate) : null,
  }), [rangeValue]);

  /**
   * Validates a single date against constraints
   */
  const validateDate = useCallback((date: Date | null): ValidationError | null => {
    if (required && !date) {
      return { message: dateErrors.required, type: 'error' };
    }
    if (date && !isValidDate(date)) {
      return { message: dateErrors.invalid, type: 'error' };
    }
    if (date && minDate && date < minDate) {
      return { message: dateErrors.past, type: 'error' };
    }
    if (date && maxDate && date > maxDate) {
      return { message: dateErrors.future, type: 'error' };
    }
    return null;
  }, [required, minDate, maxDate]);

  /**
   * Handles single date selection changes
   */
  const handleDateChange = useCallback((date: Date | null) => {
    const validationError = validateDate(date);
    setError(validationError);

    if (!validationError && onChange) {
      onChange(date ? formatDate(date, dateFormats.api) : null);
    }
  }, [onChange, validateDate]);

  /**
   * Handles date range selection changes
   */
  const handleRangeChange = useCallback((dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    
    // Validate both dates
    const startError = validateDate(start);
    const endError = validateDate(end);
    
    if (startError) {
      setError(startError);
      return;
    }
    
    if (endError) {
      setError(endError);
      return;
    }

    // Validate range logic
    if (start && end && start > end) {
      setError({ message: dateErrors.range, type: 'error' });
      return;
    }

    setError(null);

    if (onRangeChange) {
      if (!start || !end) {
        onRangeChange(null);
      } else {
        onRangeChange({
          startDate: formatDate(start, dateFormats.api),
          endDate: formatDate(end, dateFormats.api),
        });
      }
    }
  }, [onRangeChange, validateDate]);

  // Compute wrapper classes
  const wrapperClasses = classNames(
    'date-picker-wrapper',
    {
      'date-picker--disabled': disabled,
      'date-picker--error': error?.type === 'error',
      'date-picker--warning': error?.type === 'warning',
      'date-picker--focused': isFocused,
      'date-picker--loading': isLoading,
    },
    className
  );

  // Common date picker props
  const commonProps = {
    disabled,
    dateFormat,
    minDate,
    maxDate,
    placeholderText: placeholderText || (isRange ? 'Select date range' : 'Select date'),
    className: 'date-picker-input',
    calendarClassName: 'date-picker-calendar',
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFocused(false);
      }
    },
    'aria-label': ariaLabel || (isRange ? 'Date range picker' : 'Date picker'),
    'aria-invalid': error?.type === 'error',
    'aria-required': required,
  };

  return (
    <div className={wrapperClasses}>
      {isLoading && (
        <div className="date-picker__loading-indicator" aria-hidden="true" />
      )}
      
      {isRange ? (
        <ReactDatePicker
          {...commonProps}
          selectsRange
          startDate={selectedRange.start}
          endDate={selectedRange.end}
          onChange={(dates) => handleRangeChange(dates as [Date | null, Date | null])}
        />
      ) : (
        <ReactDatePicker
          {...commonProps}
          selected={selectedDate}
          onChange={handleDateChange}
        />
      )}

      {error && (
        <div 
          className={`date-picker__error date-picker__error--${error.type}`}
          role="alert"
          aria-live="polite"
        >
          {error.message}
        </div>
      )}
    </div>
  );
});

CustomDatePicker.displayName = 'CustomDatePicker';

export type { DatePickerProps, ValidationError };