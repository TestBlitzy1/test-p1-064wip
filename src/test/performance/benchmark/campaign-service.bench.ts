import { Benchmark } from '@benchmark-js/benchmark';
import { faker } from '@faker-js/faker';
import pidusage from 'pidusage';
import { ResourceMonitor } from '@performance-tools/resource-monitor';
import { CampaignGeneratorService } from '../../../backend/campaign_service/services/campaign_generator';
import { generateMockCampaign } from '../../mocks/data/campaign.mock';
import type { Campaign } from '../../../web/src/types/campaigns';

// Benchmark configuration constants
const BENCHMARK_ITERATIONS = 1000;
const CONCURRENT_USERS = [10, 50, 100, 500, 1000, 2000, 5000];
const TIMEOUT_MS = 30000; // 30 seconds max processing time
const WARMUP_DURATION_MS = 30000;
const PERFORMANCE_THRESHOLDS = {
  maxResponseTime: 30000, // 30 seconds
  maxErrorRate: 0.01, // 1% error rate
  maxCPUUsage: 80, // 80% CPU utilization
  maxMemoryUsage: 85 // 85% memory utilization
};

interface BenchmarkResults {
  concurrentUsers: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  resourceMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    loadAverage: number;
  };
}

/**
 * Sets up a benchmark suite with monitoring and validation
 */
function setupBenchmarkSuite(benchmarkConfig: any): Benchmark.Suite {
  const suite = new Benchmark.Suite('Campaign Service Performance Tests');
  
  // Configure benchmark settings
  suite.options({
    minSamples: BENCHMARK_ITERATIONS,
    maxTime: TIMEOUT_MS,
    async: true,
    defer: true,
    onError: (error: Error) => {
      console.error('Benchmark error:', error);
    }
  });

  // Set up resource monitoring
  const monitor = new ResourceMonitor({
    sampleInterval: 1000,
    metrics: ['cpu', 'memory', 'load']
  });

  suite.on('start', () => {
    monitor.start();
  });

  suite.on('complete', () => {
    monitor.stop();
  });

  return suite;
}

/**
 * Benchmarks campaign generation under various load conditions
 */
async function benchmarkCampaignGeneration(concurrentUsers: number): Promise<BenchmarkResults> {
  const monitor = new ResourceMonitor();
  const responseTimes: number[] = [];
  const errors: Error[] = [];
  
  // Start monitoring
  monitor.start();

  try {
    // Warm-up phase
    console.log(`Starting warm-up phase for ${concurrentUsers} concurrent users`);
    await new Promise(resolve => setTimeout(resolve, WARMUP_DURATION_MS));

    // Generate test campaigns
    const campaigns = Array.from({ length: concurrentUsers }, () => 
      generateMockCampaign('LINKEDIN', {
        status: 'QUEUED',
        budget: faker.number.int({ min: 1000, max: 50000 })
      })
    );

    // Initialize service
    const campaignService = new CampaignGeneratorService(
      {} as any, // AI generator mock
      {} as any  // Cache mock
    );

    // Execute concurrent requests
    const startTime = Date.now();
    const requests = campaigns.map(async (campaign) => {
      try {
        const requestStart = Date.now();
        await campaignService.generate_campaign(
          campaign.name,
          campaign.platformType.toLowerCase(),
          campaign.totalBudget,
          { primary_objective: 'AWARENESS' },
          campaign.targetingSettings,
          new Date(campaign.dateRange.startDate),
          new Date(campaign.dateRange.endDate)
        );
        responseTimes.push(Date.now() - requestStart);
      } catch (error) {
        errors.push(error as Error);
      }
    });

    await Promise.all(requests);
    const endTime = Date.now();

    // Calculate metrics
    const totalTime = endTime - startTime;
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Get resource utilization
    const resourceMetrics = await pidusage(process.pid);

    return {
      concurrentUsers,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: sortedTimes[p95Index],
      p99ResponseTime: sortedTimes[p99Index],
      throughput: (concurrentUsers * 1000) / totalTime, // requests per second
      errorRate: errors.length / concurrentUsers,
      resourceMetrics: {
        cpuUsage: resourceMetrics.cpu,
        memoryUsage: (resourceMetrics.memory / os.totalmem()) * 100,
        loadAverage: os.loadavg()[0]
      }
    };

  } finally {
    monitor.stop();
  }
}

/**
 * Benchmarks campaign validation performance
 */
async function benchmarkCampaignValidation(concurrentUsers: number): Promise<BenchmarkResults> {
  const monitor = new ResourceMonitor();
  const responseTimes: number[] = [];
  const errors: Error[] = [];

  monitor.start();

  try {
    // Generate test campaigns
    const campaigns = Array.from({ length: concurrentUsers }, () =>
      generateMockCampaign('LINKEDIN').to_platform_format()
    );

    const campaignService = new CampaignGeneratorService(
      {} as any,
      {} as any
    );

    // Execute concurrent validations
    const startTime = Date.now();
    const validations = campaigns.map(async (campaign) => {
      try {
        const validationStart = Date.now();
        await campaignService.validate_campaign(campaign);
        responseTimes.push(Date.now() - validationStart);
      } catch (error) {
        errors.push(error as Error);
      }
    });

    await Promise.all(validations);
    const endTime = Date.now();

    // Calculate metrics
    const totalTime = endTime - startTime;
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const resourceMetrics = await pidusage(process.pid);

    return {
      concurrentUsers,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: sortedTimes[Math.floor(responseTimes.length * 0.95)],
      p99ResponseTime: sortedTimes[Math.floor(responseTimes.length * 0.99)],
      throughput: (concurrentUsers * 1000) / totalTime,
      errorRate: errors.length / concurrentUsers,
      resourceMetrics: {
        cpuUsage: resourceMetrics.cpu,
        memoryUsage: (resourceMetrics.memory / os.totalmem()) * 100,
        loadAverage: os.loadavg()[0]
      }
    };
  } finally {
    monitor.stop();
  }
}

// Export benchmark suite
export const campaignServiceBenchmark = {
  async runBenchmarks() {
    const results: BenchmarkResults[] = [];
    
    for (const userCount of CONCURRENT_USERS) {
      console.log(`Running benchmark with ${userCount} concurrent users`);
      
      const generationResults = await benchmarkCampaignGeneration(userCount);
      const validationResults = await benchmarkCampaignValidation(userCount);
      
      results.push(generationResults, validationResults);
      
      // Validate against thresholds
      if (generationResults.p95ResponseTime > PERFORMANCE_THRESHOLDS.maxResponseTime ||
          generationResults.errorRate > PERFORMANCE_THRESHOLDS.maxErrorRate ||
          generationResults.resourceMetrics.cpuUsage > PERFORMANCE_THRESHOLDS.maxCPUUsage ||
          generationResults.resourceMetrics.memoryUsage > PERFORMANCE_THRESHOLDS.maxMemoryUsage) {
        console.warn(`Performance thresholds exceeded for ${userCount} users`);
      }
    }
    
    return results;
  },

  getBenchmarkResults(): BenchmarkResults[] {
    return this.results;
  },

  getResourceMetrics() {
    return this.monitor.getMetrics();
  },

  generateReport(results: BenchmarkResults[]) {
    return {
      summary: {
        totalTests: results.length,
        successRate: 1 - (results.reduce((acc, r) => acc + r.errorRate, 0) / results.length),
        averageThroughput: results.reduce((acc, r) => acc + r.throughput, 0) / results.length
      },
      results: results.map(r => ({
        concurrentUsers: r.concurrentUsers,
        metrics: {
          responseTime: {
            average: r.averageResponseTime,
            p95: r.p95ResponseTime,
            p99: r.p99ResponseTime
          },
          throughput: r.throughput,
          errorRate: r.errorRate,
          resourceUtilization: r.resourceMetrics
        }
      }))
    };
  }
};