import { AnalyticsMetric, CampaignPerformance } from '../../types/analytics';

/**
 * Supported aggregation types for metrics
 */
type AggregationType = 'SUM' | 'AVERAGE' | 'WEIGHTED_AVERAGE' | 'MEDIAN';

/**
 * Validates numeric input for calculations
 * @param value - Number to validate
 * @param paramName - Parameter name for error message
 * @throws Error if value is negative or NaN
 */
const validateNumericInput = (value: number, paramName: string): void => {
  if (isNaN(value) || value < 0) {
    throw new Error(`Invalid ${paramName}: must be a non-negative number`);
  }
};

/**
 * Calculates Click-Through Rate (CTR) from impressions and clicks
 * @param impressions - Number of impressions
 * @param clicks - Number of clicks
 * @returns Calculated CTR as a percentage with 2 decimal precision
 * @throws Error if inputs are invalid
 */
export const calculateCTR = (impressions: number, clicks: number): number => {
  validateNumericInput(impressions, 'impressions');
  validateNumericInput(clicks, 'clicks');

  if (impressions === 0) {
    return 0;
  }

  if (clicks > impressions) {
    throw new Error('Clicks cannot exceed impressions');
  }

  return Number(((clicks / impressions) * 100).toFixed(2));
};

/**
 * Calculates Cost Per Click (CPC) with currency support
 * @param spend - Total spend amount
 * @param clicks - Number of clicks
 * @param currencyCode - ISO 4217 currency code
 * @returns Calculated CPC value in specified currency
 * @throws Error if inputs are invalid
 */
export const calculateCPC = (
  spend: number,
  clicks: number,
  currencyCode: string
): number => {
  validateNumericInput(spend, 'spend');
  validateNumericInput(clicks, 'clicks');

  if (clicks === 0) {
    return 0;
  }

  // Get decimal places based on currency
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  });
  const decimalPlaces = formatter.resolvedOptions().maximumFractionDigits;

  return Number((spend / clicks).toFixed(decimalPlaces));
};

/**
 * Formats metric values with internationalization support
 * @param value - Numeric value to format
 * @param metricType - Type of metric for formatting rules
 * @param locale - Locale string (e.g., 'en-US')
 * @param currencyCode - ISO 4217 currency code for monetary values
 * @returns Formatted string with appropriate units
 */
export const formatMetricValue = (
  value: number,
  metricType: string,
  locale: string = 'en-US',
  currencyCode: string = 'USD'
): string => {
  validateNumericInput(value, 'value');

  const formatters = {
    PERCENTAGE: new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    CURRENCY: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }),
    NUMBER: new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }),
  };

  switch (metricType) {
    case 'CTR':
    case 'CONVERSION_RATE':
      return formatters.PERCENTAGE.format(value / 100);
    case 'CPC':
    case 'SPEND':
    case 'REVENUE':
      return formatters.CURRENCY.format(value);
    case 'ROAS':
      return `${formatters.NUMBER.format(value)}x`;
    default:
      return formatters.NUMBER.format(value);
  }
};

/**
 * Aggregates multiple analytics metrics with support for weighted averages
 * @param metrics - Array of analytics metrics to aggregate
 * @param metricType - Type of metric for filtering
 * @param aggregationType - Type of aggregation to perform
 * @returns Aggregated metric value
 * @throws Error if inputs are invalid or no metrics match type
 */
export const aggregateMetrics = (
  metrics: AnalyticsMetric[],
  metricType: string,
  aggregationType: AggregationType = 'WEIGHTED_AVERAGE'
): number => {
  if (!metrics.length) {
    throw new Error('No metrics provided for aggregation');
  }

  const filteredMetrics = metrics.filter(m => m.type === metricType);
  
  if (!filteredMetrics.length) {
    throw new Error(`No metrics found for type: ${metricType}`);
  }

  switch (aggregationType) {
    case 'SUM':
      return filteredMetrics.reduce((sum, metric) => sum + metric.value, 0);
    
    case 'AVERAGE':
      return filteredMetrics.reduce((sum, metric) => sum + metric.value, 0) / filteredMetrics.length;
    
    case 'WEIGHTED_AVERAGE':
      const totalWeight = filteredMetrics.reduce((sum, metric) => sum + (metric.weight || 1), 0);
      return filteredMetrics.reduce((sum, metric) => 
        sum + (metric.value * (metric.weight || 1)), 0) / totalWeight;
    
    case 'MEDIAN': {
      const sortedValues = filteredMetrics
        .map(m => m.value)
        .sort((a, b) => a - b);
      const mid = Math.floor(sortedValues.length / 2);
      return sortedValues.length % 2 === 0
        ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
        : sortedValues[mid];
    }
    
    default:
      throw new Error(`Unsupported aggregation type: ${aggregationType}`);
  }
};

/**
 * Calculates Return on Ad Spend (ROAS)
 * @param revenue - Total revenue
 * @param spend - Total ad spend
 * @returns Calculated ROAS ratio with 2 decimal precision
 * @throws Error if inputs are invalid
 */
export const calculateROAS = (revenue: number, spend: number): number => {
  validateNumericInput(revenue, 'revenue');
  validateNumericInput(spend, 'spend');

  if (spend === 0) {
    return 0;
  }

  return Number((revenue / spend).toFixed(2));
};

/**
 * Calculates campaign performance metrics
 * @param performance - Campaign performance data
 * @returns Object containing calculated metrics
 */
export const calculateCampaignMetrics = (
  performance: CampaignPerformance
): Record<string, number> => {
  const {
    impressions,
    clicks,
    spend,
    revenue,
    currencyCode = 'USD'
  } = performance;

  return {
    ctr: calculateCTR(impressions, clicks),
    cpc: calculateCPC(spend, clicks, currencyCode),
    roas: calculateROAS(revenue, spend)
  };
};