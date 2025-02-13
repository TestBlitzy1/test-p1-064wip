import { benchmark } from '@jest/benchmark'; // @jest/benchmark ^29.0.0
import { faker } from '@faker-js/faker'; // @faker-js/faker ^8.0.0
import { MetricsAggregator } from 'analytics_service/services/aggregation';
import { ReportGenerator } from 'analytics_service/services/reporting';

/**
 * Test data generation utility for analytics benchmarking
 */
async function setupBenchmarkData(
  numCampaigns: number,
  metricsPerCampaign: number,
  loadConfig: {
    timeRange: number;
    distribution: 'normal' | 'uniform';
    variance: number;
  }
): Promise<{ campaigns: any[]; metrics: any[]; validation: boolean }> {
  // Initialize faker with deterministic seed for reproducible tests
  faker.seed(12345);

  const campaigns = [];
  const metrics = [];

  // Generate campaign test data
  for (let i = 0; i < numCampaigns; i++) {
    const campaign = {
      id: faker.string.uuid(),
      platform: faker.helpers.arrayElement(['LINKEDIN', 'GOOGLE']),
      startDate: faker.date.past({ days: loadConfig.timeRange }),
      endDate: faker.date.future({ days: 30 }),
      status: faker.helpers.arrayElement(['ACTIVE', 'PAUSED', 'COMPLETED'])
    };
    campaigns.push(campaign);

    // Generate metrics with statistical distribution
    for (let j = 0; j < metricsPerCampaign; j++) {
      const baseMetrics = {
        impressions: faker.number.int({ min: 1000, max: 1000000 }),
        clicks: faker.number.int({ min: 100, max: 50000 }),
        conversions: faker.number.int({ min: 10, max: 1000 }),
        spend: faker.number.float({ min: 100, max: 10000, precision: 0.01 }),
        revenue: faker.number.float({ min: 500, max: 50000, precision: 0.01 })
      };

      // Apply configured distribution
      if (loadConfig.distribution === 'normal') {
        Object.keys(baseMetrics).forEach(key => {
          baseMetrics[key] *= (1 + faker.number.float({ 
            min: -loadConfig.variance,
            max: loadConfig.variance 
          }));
        });
      }

      metrics.push({
        campaignId: campaign.id,
        timestamp: faker.date.between({ 
          from: campaign.startDate,
          to: campaign.endDate 
        }),
        ...baseMetrics
      });
    }
  }

  // Validate generated data
  const validation = metrics.every(m => 
    m.impressions > 0 && 
    m.clicks <= m.impressions &&
    m.conversions <= m.clicks &&
    m.spend > 0 &&
    m.revenue >= 0
  );

  return {
    campaigns,
    metrics,
    validation
  };
}

/**
 * Comprehensive benchmark suite for Analytics Service performance testing
 */
export class AnalyticsServiceBenchmark {
  private metricsAggregator: MetricsAggregator;
  private reportGenerator: ReportGenerator;
  private testData: any;
  private performanceMetrics: {
    responseTime: number[];
    throughput: number[];
    errorRate: number[];
    resourceUtilization: {
      cpu: number[];
      memory: number[];
      dbConnections: number[];
    };
  };
  private resourceMonitor: any;

  constructor(benchmarkConfig: {
    cacheConfig: any;
    dbConfig: any;
    monitoringConfig: any;
  }) {
    // Initialize core services
    this.metricsAggregator = new MetricsAggregator(benchmarkConfig.cacheConfig);
    this.reportGenerator = new ReportGenerator(
      null, // DB session injected during tests
      benchmarkConfig.cacheConfig,
      benchmarkConfig.monitoringConfig
    );

    // Initialize performance tracking
    this.performanceMetrics = {
      responseTime: [],
      throughput: [],
      errorRate: [],
      resourceUtilization: {
        cpu: [],
        memory: [],
        dbConnections: []
      }
    };

    // Initialize resource monitoring
    this.resourceMonitor = {
      startTime: 0,
      measurements: [],
      startMonitoring: () => {
        this.resourceMonitor.startTime = Date.now();
      },
      recordMetrics: (metrics: any) => {
        this.resourceMonitor.measurements.push({
          timestamp: Date.now() - this.resourceMonitor.startTime,
          ...metrics
        });
      }
    };
  }

  /**
   * Benchmark metrics aggregation performance under various loads
   */
  async benchmarkMetricsAggregation(loadConfig: {
    numCampaigns: number;
    metricsPerCampaign: number;
    timeRange: number;
    distribution: 'normal' | 'uniform';
    variance: number;
    concurrentUsers: number;
  }): Promise<{
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    resourceUtilization: any;
    scalability: any;
  }> {
    // Setup test data
    this.testData = await setupBenchmarkData(
      loadConfig.numCampaigns,
      loadConfig.metricsPerCampaign,
      {
        timeRange: loadConfig.timeRange,
        distribution: loadConfig.distribution,
        variance: loadConfig.variance
      }
    );

    // Start resource monitoring
    this.resourceMonitor.startMonitoring();

    // Run concurrent load tests
    const startTime = Date.now();
    const concurrentTests = Array(loadConfig.concurrentUsers).fill(null).map(async () => {
      try {
        const campaign = faker.helpers.arrayElement(this.testData.campaigns);
        const result = await benchmark(
          async () => {
            return await this.metricsAggregator.aggregate_campaign_metrics(
              campaign.id,
              'daily',
              true // Use cache
            );
          },
          {
            maxTime: 5,
            minSamples: 50
          }
        );

        // Record metrics
        this.performanceMetrics.responseTime.push(result.stats.mean);
        this.resourceMonitor.recordMetrics({
          responseTime: result.stats.mean,
          success: true
        });

        return result;
      } catch (error) {
        this.performanceMetrics.errorRate.push(1);
        this.resourceMonitor.recordMetrics({
          error: error.message,
          success: false
        });
        throw error;
      }
    });

    // Wait for all tests to complete
    const results = await Promise.allSettled(concurrentTests);
    const endTime = Date.now();

    // Calculate benchmark metrics
    const successfulTests = results.filter(r => r.status === 'fulfilled').length;
    const totalTime = (endTime - startTime) / 1000; // seconds

    return {
      avgResponseTime: this.calculateAverage(this.performanceMetrics.responseTime),
      throughput: successfulTests / totalTime,
      errorRate: (results.length - successfulTests) / results.length,
      resourceUtilization: {
        cpu: this.calculateResourceStats(this.resourceMonitor.measurements, 'cpu'),
        memory: this.calculateResourceStats(this.resourceMonitor.measurements, 'memory'),
        dbConnections: this.calculateResourceStats(this.resourceMonitor.measurements, 'dbConnections')
      },
      scalability: {
        concurrentUsers: loadConfig.concurrentUsers,
        totalRequests: results.length,
        successfulRequests: successfulTests,
        timeElapsed: totalTime
      }
    };
  }

  /**
   * Benchmark concurrent processing capabilities
   */
  async benchmarkConcurrentProcessing(concurrencyConfig: {
    numConcurrentRequests: number;
    requestDistribution: 'burst' | 'steady';
    duration: number;
  }): Promise<{
    concurrencyMetrics: any;
    systemStability: any;
    resourceImpact: any;
  }> {
    const startTime = Date.now();
    const requests = [];

    // Generate concurrent requests based on distribution
    for (let i = 0; i < concurrencyConfig.numConcurrentRequests; i++) {
      const delay = concurrencyConfig.requestDistribution === 'burst' 
        ? 0 
        : (i * (concurrencyConfig.duration / concurrencyConfig.numConcurrentRequests));

      requests.push(
        new Promise(resolve => setTimeout(async () => {
          try {
            const campaign = faker.helpers.arrayElement(this.testData.campaigns);
            const result = await this.metricsAggregator.analyze_performance_trends(
              campaign.id,
              ['ctr', 'conversion_rate', 'roas'],
              '30d'
            );
            resolve({ success: true, result });
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        }, delay))
      );
    }

    // Execute concurrent requests
    const results = await Promise.all(requests);
    const endTime = Date.now();

    // Calculate concurrency metrics
    const successfulRequests = results.filter(r => r.success).length;
    const totalTime = (endTime - startTime) / 1000;

    return {
      concurrencyMetrics: {
        totalRequests: requests.length,
        successfulRequests,
        failedRequests: requests.length - successfulRequests,
        totalTime,
        requestsPerSecond: requests.length / totalTime
      },
      systemStability: {
        errorRate: (requests.length - successfulRequests) / requests.length,
        avgResponseTime: this.calculateAverage(this.performanceMetrics.responseTime),
        p95ResponseTime: this.calculatePercentile(this.performanceMetrics.responseTime, 95)
      },
      resourceImpact: {
        peakMemoryUsage: Math.max(...this.resourceMonitor.measurements.map(m => m.memory || 0)),
        avgCpuUtilization: this.calculateAverage(
          this.resourceMonitor.measurements.map(m => m.cpu || 0)
        ),
        dbConnectionUtilization: this.calculateAverage(
          this.resourceMonitor.measurements.map(m => m.dbConnections || 0)
        )
      }
    };
  }

  private calculateAverage(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private calculateResourceStats(measurements: any[], metric: string): any {
    const values = measurements.map(m => m[metric] || 0);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: this.calculateAverage(values),
      p95: this.calculatePercentile(values, 95)
    };
  }
}