import { format } from 'date-fns';
import { MetricType } from '../types/analytics';

// Global constants
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

// Cache for number formatters to improve performance
const NUMBER_FORMAT_CACHE = new Map<string, Intl.NumberFormat>();

/**
 * Formats a number with specified decimal places and thousands separators
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  decimals: number = 2,
  locale: string = DEFAULT_LOCALE
): string {
  if (!isFinite(value)) return '—';

  const cacheKey = `number:${locale}:${decimals}`;
  let formatter = NUMBER_FORMAT_CACHE.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    NUMBER_FORMAT_CACHE.set(cacheKey, formatter);
  }

  const formattedValue = formatter.format(value);
  return `<span aria-label="${value.toString()}">${formattedValue}</span>`;
}

/**
 * Formats a number as currency with proper symbol and decimal places
 * @param value - Number to format as currency
 * @param currency - Currency code (default: USD)
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  if (!isFinite(value)) return '—';

  const cacheKey = `currency:${locale}:${currency}`;
  let formatter = NUMBER_FORMAT_CACHE.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    NUMBER_FORMAT_CACHE.set(cacheKey, formatter);
  }

  const formattedValue = formatter.format(value);
  return `<span aria-label="${value} ${currency}">${formattedValue}</span>`;
}

/**
 * Formats a decimal number as percentage
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places (default: 1)
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  decimals: number = 1,
  locale: string = DEFAULT_LOCALE
): string {
  if (!isFinite(value)) return '—';

  // Convert decimal to percentage if less than 1
  const percentValue = value <= 1 ? value * 100 : value;

  const cacheKey = `percent:${locale}:${decimals}`;
  let formatter = NUMBER_FORMAT_CACHE.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    NUMBER_FORMAT_CACHE.set(cacheKey, formatter);
  }

  const formattedValue = formatter.format(percentValue / 100);
  return `<span aria-label="${percentValue}%">${formattedValue}</span>`;
}

/**
 * Formats a metric value based on its type with proper units
 * @param value - Value to format
 * @param metricType - Type of metric
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted metric value with appropriate units
 */
export function formatMetricValue(
  value: number,
  metricType: MetricType,
  locale: string = DEFAULT_LOCALE
): string {
  if (!isFinite(value)) return '—';

  switch (metricType) {
    case 'IMPRESSIONS':
    case 'CLICKS':
    case 'CONVERSIONS':
      return formatNumber(value, 0, locale);

    case 'SPEND':
    case 'REVENUE':
      return formatCurrency(value, DEFAULT_CURRENCY, locale);

    case 'CTR':
      return formatPercentage(value, 2, locale);

    case 'CPC':
      return formatCurrency(value, DEFAULT_CURRENCY, locale);

    case 'ROAS':
      const formattedRoas = formatNumber(value, 2, locale);
      return `<span aria-label="${value}x ROAS">${formattedRoas}x</span>`;

    default:
      return formatNumber(value, 2, locale);
  }
}

/**
 * Truncates text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 50)
 * @param preserveWords - Whether to preserve word boundaries (default: true)
 * @returns Truncated text string
 */
export function truncateText(
  text: string,
  maxLength: number = 50,
  preserveWords: boolean = true
): string {
  if (!text || text.length <= maxLength) return text;

  let truncated = text.slice(0, maxLength);

  if (preserveWords) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.slice(0, lastSpace);
    }
  }

  const result = `${truncated}...`;
  return `<span aria-label="${text}" title="${text}">${result}</span>`;
}