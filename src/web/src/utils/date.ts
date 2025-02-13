import { format, parseISO, addDays, subDays, isValid } from 'date-fns'; // v2.30.0
import type { DateRange } from '../types/common';

// Cache for memoized date formatting
const formatCache = new Map<string, string>();

// Constants for date validation and formatting
const DATE_FORMAT = {
  DEFAULT: 'yyyy-MM-dd',
  DISPLAY: 'MMM dd, yyyy',
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  ANALYTICS: 'MMM yyyy'
} as const;

const VALIDATION = {
  MIN_CAMPAIGN_DAYS: 1,
  MAX_CAMPAIGN_DAYS: 365,
  MIN_DATE: new Date('2020-01-01'),
  MAX_DATE: new Date('2030-12-31'),
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:?\d{2}|Z)?)?$/
} as const;

interface ValidationOptions {
  checkBusinessHours?: boolean;
  minDuration?: number;
  maxDuration?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Formats a date into a standardized string representation
 * @param date - Date to format (Date object or ISO string)
 * @param formatPattern - Pattern to use for formatting (from DATE_FORMAT)
 * @param locale - Optional locale for internationalization
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  formatPattern: string = DATE_FORMAT.DEFAULT,
  locale?: Locale
): string => {
  if (!date) {
    console.warn('formatDate: Invalid date input');
    return '';
  }

  // Generate cache key
  const cacheKey = `${date.toString()}-${formatPattern}-${locale?.code || 'default'}`;
  
  // Check cache first
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      console.warn('formatDate: Invalid date object after parsing');
      return '';
    }

    const formatted = format(dateObj, formatPattern, { locale });
    formatCache.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    console.error('formatDate: Error formatting date:', error);
    return '';
  }
};

/**
 * Safely parses a date string into a Date object
 * @param dateString - ISO date string to parse
 * @returns Parsed Date object or null if invalid
 */
export const parseDateString = (dateString: string): Date | null => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  // Sanitize input
  const sanitized = dateString.trim();
  if (!VALIDATION.DATE_REGEX.test(sanitized)) {
    return null;
  }

  try {
    const parsed = parseISO(sanitized);
    
    if (!isValid(parsed)) {
      return null;
    }

    // Validate date range
    if (parsed < VALIDATION.MIN_DATE || parsed > VALIDATION.MAX_DATE) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('parseDateString: Error parsing date:', error);
    return null;
  }
};

/**
 * Creates a validated DateRange object from start and end dates
 * @param startDate - Start date (Date object or ISO string)
 * @param endDate - End date (Date object or ISO string)
 * @returns DateRange object or null if invalid
 */
export const createDateRange = (
  startDate: Date | string,
  endDate: Date | string
): DateRange | null => {
  const start = typeof startDate === 'string' ? parseDateString(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDateString(endDate) : endDate;

  if (!start || !end || !isValid(start) || !isValid(end)) {
    console.error('createDateRange: Invalid date input');
    return null;
  }

  if (start > end) {
    console.error('createDateRange: Start date must be before end date');
    return null;
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < VALIDATION.MIN_CAMPAIGN_DAYS || diffDays > VALIDATION.MAX_CAMPAIGN_DAYS) {
    console.error('createDateRange: Date range outside allowed duration');
    return null;
  }

  return {
    startDate: formatDate(start, DATE_FORMAT.ISO),
    endDate: formatDate(end, DATE_FORMAT.ISO)
  };
};

/**
 * Gets a date range relative to current date
 * @param days - Number of days to include in range
 * @param includeToday - Whether to include current date as end date
 * @returns DateRange object
 */
export const getRelativeDateRange = (days: number, includeToday: boolean = true): DateRange => {
  if (days <= 0) {
    throw new Error('getRelativeDateRange: Days must be positive');
  }

  const endDate = includeToday ? new Date() : subDays(new Date(), 1);
  const startDate = subDays(endDate, days - 1);

  return {
    startDate: formatDate(startDate, DATE_FORMAT.ISO),
    endDate: formatDate(endDate, DATE_FORMAT.ISO)
  };
};

/**
 * Validates a date range against business rules
 * @param dateRange - DateRange object to validate
 * @param options - Validation options
 * @returns Validation result with status and errors
 */
export const validateDateRange = (
  dateRange: DateRange,
  options: ValidationOptions = {}
): ValidationResult => {
  const errors: string[] = [];
  const {
    checkBusinessHours = false,
    minDuration = VALIDATION.MIN_CAMPAIGN_DAYS,
    maxDuration = VALIDATION.MAX_CAMPAIGN_DAYS
  } = options;

  const start = parseDateString(dateRange.startDate);
  const end = parseDateString(dateRange.endDate);

  if (!start || !end) {
    errors.push('Invalid date format');
    return { isValid: false, errors };
  }

  // Check if dates are in the past
  const now = new Date();
  if (start < now) {
    errors.push('Start date cannot be in the past');
  }

  // Validate date order
  if (start > end) {
    errors.push('Start date must be before end date');
  }

  // Check duration
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < minDuration) {
    errors.push(`Campaign duration must be at least ${minDuration} day(s)`);
  }
  if (diffDays > maxDuration) {
    errors.push(`Campaign duration cannot exceed ${maxDuration} days`);
  }

  // Business hours validation if required
  if (checkBusinessHours) {
    const startHour = start.getHours();
    const endHour = end.getHours();
    if (startHour < 9 || startHour > 17 || endHour < 9 || endHour > 17) {
      errors.push('Campaign dates must be within business hours (9 AM - 5 PM)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};