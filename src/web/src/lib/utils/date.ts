import { format, isValid, parseISO } from 'date-fns'; // v2.30.0
import type { DateRange } from '../types/common';

// Constants for date formatting and validation
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
const ISO_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSxxx";
const DATE_PLACEHOLDER = '--';
const MIN_DATE = new Date('2000-01-01');
const MAX_DATE = new Date('2100-01-01');

/**
 * Formats a date string or Date object into a specified format with robust error handling
 * @param date - The date to format (Date object or ISO string)
 * @param formatString - The desired output format (defaults to yyyy-MM-dd)
 * @returns Formatted date string or placeholder if invalid
 */
export const formatDate = (
  date: Date | string,
  formatString: string = DEFAULT_DATE_FORMAT
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValidDate(dateObj)) {
      return DATE_PLACEHOLDER;
    }

    return format(dateObj, formatString);
  } catch (error) {
    console.error('Date formatting error:', error);
    return DATE_PLACEHOLDER;
  }
};

/**
 * Type guard that validates if the provided date is valid and within acceptable range
 * @param date - The date to validate (Date object or ISO string)
 * @returns Boolean indicating if the date is valid
 */
export const isValidDate = (date: Date | string): boolean => {
  try {
    if (!date) return false;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(dateObj)) return false;
    
    // Check if date is within acceptable range
    if (dateObj < MIN_DATE || dateObj > MAX_DATE) return false;
    
    // Additional validation for non-NaN date
    return !isNaN(dateObj.getTime());
  } catch (error) {
    console.error('Date validation error:', error);
    return false;
  }
};

/**
 * Creates a strongly-typed DateRange object from start and end dates
 * @param startDate - The start date of the range
 * @param endDate - The end date of the range
 * @returns DateRange object with validated dates
 * @throws Error if dates are invalid or start date is after end date
 */
export const getDateRange = (
  startDate: Date | string,
  endDate: Date | string
): DateRange => {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  if (!isValidDate(start) || !isValidDate(end)) {
    throw new Error('Invalid date range: dates must be valid');
  }

  if (start > end) {
    throw new Error('Invalid date range: start date must be before or equal to end date');
  }

  return {
    startDate: format(start, ISO_DATE_FORMAT),
    endDate: format(end, ISO_DATE_FORMAT)
  };
};

/**
 * Generates a DateRange object relative to current date
 * @param days - Number of days to look back from current date
 * @returns DateRange object with calculated start and end dates
 * @throws Error if days parameter is invalid
 */
export const getRelativeDateRange = (days: number): DateRange => {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('Days parameter must be a positive integer');
  }

  const endDate = new Date();
  // Set to end of day in UTC
  endDate.setUTCHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  // Set to start of day in UTC
  startDate.setUTCHours(0, 0, 0, 0);

  return getDateRange(startDate, endDate);
};

/**
 * Common date format patterns for use across the application
 */
export const dateFormats = {
  display: 'MMM d, yyyy',
  input: 'yyyy-MM-dd',
  analytics: 'MMM d, yyyy HH:mm',
  iso: ISO_DATE_FORMAT,
  api: DEFAULT_DATE_FORMAT
} as const;

/**
 * Date validation error messages
 */
export const dateErrors = {
  invalid: 'Invalid date format',
  range: 'Invalid date range',
  future: 'Date cannot be in the future',
  past: 'Date cannot be before 2000',
  required: 'Date is required'
} as const;