import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateCTR,
  calculateCPC,
  calculateROAS,
  formatMetricValue,
  aggregateMetrics
} from '../../src/lib/utils/analytics';
import { MetricType, AnalyticsMetric } from '../../src/types/analytics';

// Performance benchmarking setup
const PERFORMANCE_THRESHOLD = 100; // 100ms threshold for calculations
let startTime: number;

beforeAll(() => {
  startTime = Date.now();
});

afterAll(() => {
  const duration = Date.now() - startTime;
  console.log(`Total test suite duration: ${duration}ms`);
});

describe('calculateCTR', () => {
  it('should calculate CTR correctly for valid inputs', () => {
    expect(calculateCTR(1000, 50)).toBe(5.00);
    expect(calculateCTR(10000, 250)).toBe(2.50);
    expect(calculateCTR(1000000, 25000)).toBe(2.50);
  });

  it('should handle zero impressions', () => {
    expect(calculateCTR(0, 0)).toBe(0);
  });

  it('should throw error for negative inputs', () => {
    expect(() => calculateCTR(-1000, 50)).toThrow('Invalid impressions');
    expect(() => calculateCTR(1000, -50)).toThrow('Invalid clicks');
  });

  it('should throw error when clicks exceed impressions', () => {
    expect(() => calculateCTR(100, 150)).toThrow('Clicks cannot exceed impressions');
  });

  it('should maintain precision up to 2 decimal places', () => {
    expect(calculateCTR(3333, 100)).toBe(3.00);
    expect(calculateCTR(7777, 100)).toBe(1.29);
  });

  it('should handle large numbers without precision loss', () => {
    expect(calculateCTR(1000000000, 25000000)).toBe(2.50);
  });

  it('should perform calculations within performance threshold', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      calculateCTR(1000000, 25000);
    }
    expect(Date.now() - start).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});

describe('calculateCPC', () => {
  it('should calculate CPC correctly for different currencies', () => {
    expect(calculateCPC(1000, 500, 'USD')).toBe(2.00);
    expect(calculateCPC(1000, 500, 'EUR')).toBe(2.00);
    expect(calculateCPC(1000, 500, 'GBP')).toBe(2.00);
  });

  it('should handle zero clicks', () => {
    expect(calculateCPC(1000, 0, 'USD')).toBe(0);
  });

  it('should throw error for negative inputs', () => {
    expect(() => calculateCPC(-1000, 500, 'USD')).toThrow('Invalid spend');
    expect(() => calculateCPC(1000, -500, 'USD')).toThrow('Invalid clicks');
  });

  it('should respect currency decimal places', () => {
    expect(calculateCPC(1000, 333, 'JPY')).toBe(3);  // JPY has 0 decimal places
    expect(calculateCPC(1000, 333, 'USD')).toBe(3.00);  // USD has 2 decimal places
  });

  it('should handle large monetary values', () => {
    expect(calculateCPC(1000000, 250000, 'USD')).toBe(4.00);
  });

  it('should perform calculations within performance threshold', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      calculateCPC(1000000, 250000, 'USD');
    }
    expect(Date.now() - start).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});

describe('calculateROAS', () => {
  it('should calculate ROAS correctly', () => {
    expect(calculateROAS(2000, 1000)).toBe(2.00);
    expect(calculateROAS(5000, 1000)).toBe(5.00);
  });

  it('should handle zero spend', () => {
    expect(calculateROAS(1000, 0)).toBe(0);
  });

  it('should throw error for negative inputs', () => {
    expect(() => calculateROAS(-2000, 1000)).toThrow('Invalid revenue');
    expect(() => calculateROAS(2000, -1000)).toThrow('Invalid spend');
  });

  it('should maintain precision up to 2 decimal places', () => {
    expect(calculateROAS(1000, 333)).toBe(3.00);
    expect(calculateROAS(1000, 777)).toBe(1.29);
  });

  it('should handle large monetary values', () => {
    expect(calculateROAS(2000000, 1000000)).toBe(2.00);
  });

  it('should perform calculations within performance threshold', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      calculateROAS(2000000, 1000000);
    }
    expect(Date.now() - start).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});

describe('formatMetricValue', () => {
  it('should format percentage metrics correctly', () => {
    expect(formatMetricValue(5.25, 'CTR')).toBe('5.25%');
    expect(formatMetricValue(2.50, 'CONVERSION_RATE')).toBe('2.50%');
  });

  it('should format currency metrics correctly', () => {
    expect(formatMetricValue(1000.50, 'CPC', 'en-US', 'USD')).toBe('$1,000.50');
    expect(formatMetricValue(1000.50, 'SPEND', 'en-GB', 'GBP')).toBe('£1,000.50');
    expect(formatMetricValue(1000.50, 'REVENUE', 'de-DE', 'EUR')).toBe('1.000,50 €');
  });

  it('should format ROAS with multiplier', () => {
    expect(formatMetricValue(2.5, 'ROAS')).toBe('2.50x');
  });

  it('should handle different locales correctly', () => {
    expect(formatMetricValue(1000.50, 'SPEND', 'fr-FR', 'EUR')).toBe('1 000,50 €');
    expect(formatMetricValue(1000.50, 'SPEND', 'ja-JP', 'JPY')).toBe('￥1,001');
  });

  it('should throw error for negative values', () => {
    expect(() => formatMetricValue(-5.25, 'CTR')).toThrow('Invalid value');
  });

  it('should perform formatting within performance threshold', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      formatMetricValue(1000.50, 'SPEND', 'en-US', 'USD');
    }
    expect(Date.now() - start).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});

describe('aggregateMetrics', () => {
  const testMetrics: AnalyticsMetric[] = [
    { type: 'CTR' as MetricType, value: 2.5, timestamp: '2023-01-01', campaign_id: '1' },
    { type: 'CTR' as MetricType, value: 3.5, timestamp: '2023-01-02', campaign_id: '1' },
    { type: 'CTR' as MetricType, value: 4.5, timestamp: '2023-01-03', campaign_id: '1' }
  ];

  it('should calculate sum correctly', () => {
    expect(aggregateMetrics(testMetrics, 'CTR', 'SUM')).toBe(10.5);
  });

  it('should calculate average correctly', () => {
    expect(aggregateMetrics(testMetrics, 'CTR', 'AVERAGE')).toBe(3.5);
  });

  it('should calculate weighted average correctly', () => {
    const weightedMetrics: AnalyticsMetric[] = testMetrics.map((m, i) => ({
      ...m,
      weight: i + 1
    }));
    expect(aggregateMetrics(weightedMetrics, 'CTR', 'WEIGHTED_AVERAGE')).toBe(3.83);
  });

  it('should calculate median correctly', () => {
    expect(aggregateMetrics(testMetrics, 'CTR', 'MEDIAN')).toBe(3.5);
  });

  it('should throw error for empty metrics array', () => {
    expect(() => aggregateMetrics([], 'CTR', 'SUM')).toThrow('No metrics provided');
  });

  it('should throw error for invalid metric type', () => {
    expect(() => aggregateMetrics(testMetrics, 'INVALID' as MetricType, 'SUM'))
      .toThrow('No metrics found for type');
  });

  it('should perform aggregation within performance threshold', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      aggregateMetrics(testMetrics, 'CTR', 'WEIGHTED_AVERAGE');
    }
    expect(Date.now() - start).toBeLessThan(PERFORMANCE_THRESHOLD);
  });
});