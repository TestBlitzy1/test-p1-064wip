import { formatNumber } from 'intl-number-format-cache'; // v1.3.0
import type { DateString } from '../types/common';

// Cache for number formatters to improve performance
const getNumberFormatter = formatNumber();

/**
 * Formats a number as currency with proper localization and symbol placement
 * @param value - Numeric value to format
 * @param currencyCode - ISO 4217 currency code (e.g., 'USD', 'EUR')
 * @param locale - BCP 47 language tag (defaults to user's locale)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: number,
  currencyCode: string = 'USD',
  locale: string = navigator.language
): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  try {
    const formatter = getNumberFormatter(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return formatter(value);
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${currencyCode} ${value.toFixed(2)}`;
  }
};

/**
 * Formats a decimal number as a percentage with specified precision
 * @param value - Decimal value to format (e.g., 0.156 for 15.6%)
 * @param decimalPlaces - Number of decimal places to show
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  decimalPlaces: number = 1
): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  try {
    const formatter = getNumberFormatter(navigator.language, {
      style: 'percent',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });

    return formatter(value);
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return `${(value * 100).toFixed(decimalPlaces)}%`;
  }
};

/**
 * Formats large numbers with K/M/B suffixes for readability
 * @param value - Number to format
 * @param decimalPlaces - Maximum decimal places to show
 * @returns Formatted metric string with appropriate suffix
 */
export const formatMetric = (
  value: number,
  decimalPlaces: number = 1
): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e9) {
    return `${sign}${(value / 1e9).toFixed(decimalPlaces)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${(value / 1e6).toFixed(decimalPlaces)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${(value / 1e3).toFixed(decimalPlaces)}K`;
  }

  try {
    const formatter = getNumberFormatter(navigator.language, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });
    return formatter(value);
  } catch (error) {
    console.error('Metric formatting error:', error);
    return value.toFixed(decimalPlaces);
  }
};

/**
 * Formats ROAS (Return on Ad Spend) values with consistent styling
 * @param value - ROAS value (e.g., 3.8 for 3.8x return)
 * @returns Formatted ROAS string with 'x' suffix
 */
export const formatROAS = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) {
    return '—';
  }

  try {
    const formatter = getNumberFormatter(navigator.language, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    return `${formatter(value)}x`;
  } catch (error) {
    console.error('ROAS formatting error:', error);
    return `${value.toFixed(1)}x`;
  }
};

/**
 * Truncates text to specified length while preserving word boundaries
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || maxLength <= 0 || text.length <= maxLength) {
    return text;
  }

  // Handle RTL text
  const isRTL = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/.test(text);
  const ellipsis = isRTL ? '...' : '...';

  // Account for ellipsis in max length
  const targetLength = maxLength - ellipsis.length;

  // Find last space before targetLength
  const lastSpace = text.lastIndexOf(' ', targetLength);
  const truncateAt = lastSpace > targetLength / 2 ? lastSpace : targetLength;

  return text.slice(0, truncateAt).trim() + ellipsis;
};

/**
 * Formats a date string according to user's locale
 * @param date - Date string or timestamp
 * @param format - Optional format options
 * @returns Formatted date string
 */
export const formatDate = (
  date: DateString | number,
  format: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string => {
  if (!date) {
    return '—';
  }

  try {
    const dateObj = typeof date === 'number' ? new Date(date) : new Date(date);
    return new Intl.DateTimeFormat(navigator.language, format).format(dateObj);
  } catch (error) {
    console.error('Date formatting error:', error);
    return String(date);
  }
};