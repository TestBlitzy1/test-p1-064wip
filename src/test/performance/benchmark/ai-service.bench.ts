import { benchmark } from '@benchmark-js/benchmark';
import * as clinicjs from 'clinic';
import { CampaignGenerator } from '../../../backend/ai_service/models/campaign_generator';
import { TestState } from '../../types/test';
import { generateMockCampaign } from '../../mocks/data/campaign.mock';

// Benchmark configuration constants
const BENCHMARK_ITERATIONS = 1000;
const BENCHMARK_TIMEOUT = 60000;
const MEMORY_THRESHOLD_MB = 512;
const WARM_UP_ITERATIONS = 50;
const PERFORMANCE_BASELINE = {
  executionTime: 25000, // 25 seconds target for 30s requirement
  memoryUsage: 256, // MB
  throughput: 2 // campaigns per second
};

interface BenchmarkResults {
  executionTime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  throughput: number;
  validationRate: number;
  resourceUtilization: {
    cpu: number;
    gpu?: number;
    memory: number;
  };
}

interface PerformanceReport {
  summary: {
    totalTests: number;
    passRate: number;
    averageExecutionTime: number;
    peakMemoryUsage: number;
    averageThroughput: number;
  };
  platformMetrics: {
    linkedin: BenchmarkResults;
    google: BenchmarkResults;
  };
  recommendations: string[];
  bottlenecks: string[];
}

/**
 * Sets up the benchmark suite with comprehensive configuration
 */
async function setupBenchmarkSuite(
  config: TestConfig,
  environment: TestEnvironment
): Promise<void> {
  // Initialize benchmark suite with high precision timing
  benchmark.options.minTime = 1;
  benchmark.options.maxTime = BENCHMARK_TIMEOUT;
  benchmark.options.initCount = WARM_UP_ITERATIONS;
  
  // Configure memory profiling
  const profiler = clinicjs.flame({
    sampleInterval: 1,
    collectDelay: 0,
    thresholds: {
      all: MEMORY_THRESHOLD_MB * 1024 * 1024 // Convert to bytes
    }
  });

  // Initialize AI model with appropriate device
  const deviceType = process.env.CUDA_VISIBLE_DEVICES ? 'cuda' : 'cpu';
  const campaignGenerator = new CampaignGenerator(
    'models/campaign_generator',
    deviceType,
    undefined,
    true
  );

  // Perform warm-up iterations
  for (let i = 0; i < WARM_UP_ITERATIONS; i++) {
    const mockCampaign = generateMockCampaign('LINKEDIN');
    await campaignGenerator.generate_campaign_structure(
      mockCampaign.name,
      'linkedin',
      mockCampaign.targetingSettings,
      mockCampaign.totalBudget,
      mockCampaign.platformSettings.linkedin
    );
  }
}

/**
 * Benchmarks campaign structure generation performance
 */
async function benchmarkCampaignGeneration(
  platform: string,
  targetAudience: object,
  budget: number
): Promise<BenchmarkResults> {
  const results: BenchmarkResults = {
    executionTime: 0,
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    },
    throughput: 0,
    validationRate: 0,
    resourceUtilization: {
      cpu: 0,
      memory: 0
    }
  };

  const suite = new benchmark.Suite();

  suite.add('Campaign Generation', {
    defer: true,
    fn: async (deferred: any) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      const mockCampaign = generateMockCampaign(platform as any);
      const campaignGenerator = new CampaignGenerator(
        'models/campaign_generator',
        'cpu',
        undefined,
        true
      );

      try {
        const structure = await campaignGenerator.generate_campaign_structure(
          mockCampaign.name,
          platform,
          targetAudience,
          budget,
          mockCampaign.platformSettings
        );

        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();

        // Calculate metrics
        results.executionTime = Number(endTime - startTime) / 1e6; // Convert to ms
        results.memoryUsage = {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external,
          rss: endMemory.rss
        };

        const isValid = await campaignGenerator.validate_structure(structure, platform);
        results.validationRate = isValid ? 1 : 0;

        deferred.resolve();
      } catch (error) {
        deferred.reject(error);
      }
    },
    onComplete: (event: any) => {
      results.throughput = 1000 / event.target.stats.mean; // Campaigns per second
    }
  });

  await new Promise((resolve) => suite.run({ async: true, onComplete: resolve }));
  return results;
}

/**
 * Benchmarks budget optimization algorithm performance
 */
async function benchmarkBudgetOptimization(
  campaignStructure: object,
  totalBudget: number
): Promise<BenchmarkResults> {
  const results: BenchmarkResults = {
    executionTime: 0,
    memoryUsage: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    },
    throughput: 0,
    validationRate: 0,
    resourceUtilization: {
      cpu: 0,
      memory: 0
    }
  };

  const suite = new benchmark.Suite();

  suite.add('Budget Optimization', {
    defer: true,
    fn: async (deferred: any) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();

      const campaignGenerator = new CampaignGenerator(
        'models/campaign_generator',
        'cpu',
        undefined,
        true
      );

      try {
        const optimizedStructure = await campaignGenerator.optimize_budget_allocation(
          campaignStructure,
          totalBudget,
          {}
        );

        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();

        results.executionTime = Number(endTime - startTime) / 1e6;
        results.memoryUsage = {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external,
          rss: endMemory.rss
        };

        deferred.resolve();
      } catch (error) {
        deferred.reject(error);
      }
    }
  });

  await new Promise((resolve) => suite.run({ async: true, onComplete: resolve }));
  return results;
}

/**
 * Generates comprehensive performance analysis report
 */
async function generatePerformanceReport(
  benchmarkResults: BenchmarkResults[]
): Promise<PerformanceReport> {
  const totalTests = benchmarkResults.length;
  const passedTests = benchmarkResults.filter(
    result => result.executionTime < PERFORMANCE_BASELINE.executionTime
  ).length;

  const averageExecutionTime = benchmarkResults.reduce(
    (sum, result) => sum + result.executionTime, 0
  ) / totalTests;

  const peakMemoryUsage = Math.max(
    ...benchmarkResults.map(result => result.memoryUsage.heapUsed)
  );

  const averageThroughput = benchmarkResults.reduce(
    (sum, result) => sum + result.throughput, 0
  ) / totalTests;

  return {
    summary: {
      totalTests,
      passRate: (passedTests / totalTests) * 100,
      averageExecutionTime,
      peakMemoryUsage,
      averageThroughput
    },
    platformMetrics: {
      linkedin: benchmarkResults[0],
      google: benchmarkResults[1]
    },
    recommendations: generateOptimizationRecommendations(benchmarkResults),
    bottlenecks: identifyPerformanceBottlenecks(benchmarkResults)
  };
}

// Export main benchmark function
export default async function runAiServiceBenchmark(
  config: TestConfig,
  environment: TestEnvironment
): Promise<PerformanceReport> {
  await setupBenchmarkSuite(config, environment);

  const linkedInResults = await benchmarkCampaignGeneration(
    'linkedin',
    generateMockCampaign('LINKEDIN').targetingSettings,
    10000
  );

  const googleResults = await benchmarkCampaignGeneration(
    'google',
    generateMockCampaign('GOOGLE').targetingSettings,
    10000
  );

  return generatePerformanceReport([linkedInResults, googleResults]);
}

// Helper functions
function generateOptimizationRecommendations(results: BenchmarkResults[]): string[] {
  const recommendations: string[] = [];
  
  if (results.some(r => r.executionTime > PERFORMANCE_BASELINE.executionTime)) {
    recommendations.push('Consider implementing request batching for campaign generation');
  }

  if (results.some(r => r.memoryUsage.heapUsed > MEMORY_THRESHOLD_MB * 1024 * 1024)) {
    recommendations.push('Optimize memory usage in AI model inference');
  }

  return recommendations;
}

function identifyPerformanceBottlenecks(results: BenchmarkResults[]): string[] {
  const bottlenecks: string[] = [];
  
  if (results.some(r => r.resourceUtilization.cpu > 0.8)) {
    bottlenecks.push('High CPU utilization during campaign generation');
  }

  if (results.some(r => r.validationRate < 0.95)) {
    bottlenecks.push('Campaign validation success rate below threshold');
  }

  return bottlenecks;
}