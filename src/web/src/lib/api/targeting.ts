import { z } from 'zod'; // v3.x
import CircuitBreaker from 'opossum'; // v6.x
import Bottleneck from 'bottleneck'; // v2.x
import { logger } from 'winston'; // v3.x
import { Counter, Histogram } from 'prom-client'; // v14.x
import NodeCache from 'node-cache'; // v5.x

import { apiClient } from '../../utils/api-client';
import {
  TargetingRule,
  AudienceSegment,
  PlatformConstraints,
  targetingRuleSchema,
  TargetingEstimateResponse,
  OptimizationSettings,
  TargetingRecommendation
} from '../../types/targeting';

// Constants
const CACHE_TTL = 300; // 5 minutes
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Performance monitoring metrics
const requestLatency = new Histogram({
  name: 'targeting_api_request_duration_seconds',
  help: 'Targeting API request duration in seconds',
  labelNames: ['endpoint']
});

const errorCounter = new Counter({
  name: 'targeting_api_errors_total',
  help: 'Total count of targeting API errors',
  labelNames: ['endpoint', 'error_type']
});

// Cache instance
const cache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: 120,
  useClones: false
});

// Rate limiter
const limiter = new Bottleneck({
  minTime: 100,
  maxConcurrent: 10
});

// Circuit breaker configuration
const breaker = new CircuitBreaker(async (fn: Function) => await fn(), {
  timeout: REQUEST_TIMEOUT,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

// Validation schemas
const audienceSegmentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  platform: z.enum(['linkedin', 'google']),
  targetingRules: z.array(targetingRuleSchema).min(1).max(20)
});

/**
 * Retrieves all audience segments with caching and rate limiting
 */
export async function getAudienceSegments(): Promise<AudienceSegment[]> {
  const cacheKey = 'audience_segments';
  const cached = cache.get<AudienceSegment[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const timer = requestLatency.startTimer({ endpoint: 'getAudienceSegments' });

  try {
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.get<AudienceSegment[]>('/targeting/segments');
        return result.data;
      })
    );

    cache.set(cacheKey, response);
    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'getAudienceSegments', error_type: error.name });
    logger.error('Failed to fetch audience segments', { error });
    throw error;
  }
}

/**
 * Retrieves a single audience segment by ID
 */
export async function getAudienceSegment(id: string): Promise<AudienceSegment> {
  const cacheKey = `audience_segment_${id}`;
  const cached = cache.get<AudienceSegment>(cacheKey);

  if (cached) {
    return cached;
  }

  const timer = requestLatency.startTimer({ endpoint: 'getAudienceSegment' });

  try {
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.get<AudienceSegment>(`/targeting/segments/${id}`);
        return result.data;
      })
    );

    cache.set(cacheKey, response);
    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'getAudienceSegment', error_type: error.name });
    logger.error('Failed to fetch audience segment', { error, segmentId: id });
    throw error;
  }
}

/**
 * Creates a new audience segment with validation
 */
export async function createAudienceSegment(data: Partial<AudienceSegment>): Promise<AudienceSegment> {
  const timer = requestLatency.startTimer({ endpoint: 'createAudienceSegment' });

  try {
    const validated = audienceSegmentSchema.parse(data);
    
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.post<AudienceSegment>('/targeting/segments', validated);
        return result.data;
      })
    );

    cache.del('audience_segments');
    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'createAudienceSegment', error_type: error.name });
    logger.error('Failed to create audience segment', { error, data });
    throw error;
  }
}

/**
 * Updates an existing audience segment with validation
 */
export async function updateAudienceSegment(
  id: string,
  data: Partial<AudienceSegment>
): Promise<AudienceSegment> {
  const timer = requestLatency.startTimer({ endpoint: 'updateAudienceSegment' });

  try {
    const validated = audienceSegmentSchema.partial().parse(data);
    
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.put<AudienceSegment>(`/targeting/segments/${id}`, validated);
        return result.data;
      })
    );

    cache.del(['audience_segments', `audience_segment_${id}`]);
    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'updateAudienceSegment', error_type: error.name });
    logger.error('Failed to update audience segment', { error, segmentId: id, data });
    throw error;
  }
}

/**
 * Deletes an audience segment
 */
export async function deleteAudienceSegment(id: string): Promise<void> {
  const timer = requestLatency.startTimer({ endpoint: 'deleteAudienceSegment' });

  try {
    await limiter.schedule(() =>
      breaker.fire(async () => {
        await apiClient.delete(`/targeting/segments/${id}`);
      })
    );

    cache.del(['audience_segments', `audience_segment_${id}`]);
    timer();
  } catch (error) {
    errorCounter.inc({ endpoint: 'deleteAudienceSegment', error_type: error.name });
    logger.error('Failed to delete audience segment', { error, segmentId: id });
    throw error;
  }
}

/**
 * Retrieves platform-specific targeting constraints
 */
export async function getPlatformConstraints(platform: string): Promise<PlatformConstraints> {
  const cacheKey = `platform_constraints_${platform}`;
  const cached = cache.get<PlatformConstraints>(cacheKey);

  if (cached) {
    return cached;
  }

  const timer = requestLatency.startTimer({ endpoint: 'getPlatformConstraints' });

  try {
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.get<PlatformConstraints>(`/targeting/constraints/${platform}`);
        return result.data;
      })
    );

    cache.set(cacheKey, response, 3600); // Cache for 1 hour
    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'getPlatformConstraints', error_type: error.name });
    logger.error('Failed to fetch platform constraints', { error, platform });
    throw error;
  }
}

/**
 * Validates targeting rules against platform constraints
 */
export async function validateTargetingRules(
  rules: TargetingRule[],
  platform: string
): Promise<boolean> {
  const timer = requestLatency.startTimer({ endpoint: 'validateTargetingRules' });

  try {
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.post<{ isValid: boolean }>(
          '/targeting/validate',
          { rules, platform }
        );
        return result.data;
      })
    );

    timer();
    return response.isValid;
  } catch (error) {
    errorCounter.inc({ endpoint: 'validateTargetingRules', error_type: error.name });
    logger.error('Failed to validate targeting rules', { error, platform });
    throw error;
  }
}

/**
 * Gets audience reach estimates for targeting rules
 */
export async function getAudienceEstimates(
  rules: TargetingRule[],
  platform: string
): Promise<TargetingEstimateResponse> {
  const timer = requestLatency.startTimer({ endpoint: 'getAudienceEstimates' });

  try {
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.post<TargetingEstimateResponse>(
          '/targeting/estimates',
          { rules, platform }
        );
        return result.data;
      })
    );

    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'getAudienceEstimates', error_type: error.name });
    logger.error('Failed to get audience estimates', { error, platform });
    throw error;
  }
}

/**
 * Gets AI-powered targeting recommendations
 */
export async function getTargetingRecommendations(
  segmentId: string,
  settings: OptimizationSettings
): Promise<TargetingRecommendation[]> {
  const timer = requestLatency.startTimer({ endpoint: 'getTargetingRecommendations' });

  try {
    const response = await limiter.schedule(() =>
      breaker.fire(async () => {
        const result = await apiClient.post<TargetingRecommendation[]>(
          `/targeting/segments/${segmentId}/recommendations`,
          settings
        );
        return result.data;
      })
    );

    timer();
    return response;
  } catch (error) {
    errorCounter.inc({ endpoint: 'getTargetingRecommendations', error_type: error.name });
    logger.error('Failed to get targeting recommendations', { error, segmentId });
    throw error;
  }
}