import { NextResponse } from 'next/server'; // v14.0.x
import { ApiClient } from '../../../utils/api-client';
import type { ApiHealthCheck, ApiMetrics } from '../../../types/api';

// Constants for health check configuration
const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const CACHE_TTL = 5000; // 5 seconds cache for health check results
const DEGRADED_THRESHOLD = 0.8; // 80% of services must be healthy
const LATENCY_THRESHOLD = 1000; // 1 second max acceptable latency

// Cache for health check results
let healthCheckCache: {
  result: ApiHealthCheck;
  timestamp: number;
} | null = null;

/**
 * Health check endpoint handler for GET requests
 * Performs comprehensive verification of critical system components
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Check cache first
    if (healthCheckCache && Date.now() - healthCheckCache.timestamp < CACHE_TTL) {
      return NextResponse.json(healthCheckCache.result, { status: 200 });
    }

    const startTime = Date.now();
    const apiClient = new ApiClient({
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      version: 'v1',
      environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
      timeout: HEALTH_CHECK_TIMEOUT
    });

    // Check core services health
    const services = await Promise.allSettled([
      checkBackendHealth(apiClient),
      checkDatabaseHealth(apiClient),
      checkCacheHealth(apiClient),
      checkRateLimits(apiClient)
    ]);

    // Process service health results
    const serviceStatuses = services.map((result, index) => ({
      name: getServiceName(index),
      status: result.status === 'fulfilled' ? 'up' : 'down',
      latency: result.status === 'fulfilled' ? result.value : 0
    }));

    // Calculate overall system health
    const healthyServices = serviceStatuses.filter(s => s.status === 'up').length;
    const healthScore = healthyServices / serviceStatuses.length;
    const averageLatency = serviceStatuses.reduce((acc, s) => acc + s.latency, 0) / serviceStatuses.length;

    // Determine system status
    const systemStatus = determineSystemStatus(healthScore, averageLatency);

    // Prepare health check response
    const healthCheck: ApiHealthCheck = {
      status: systemStatus,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      services: serviceStatuses
    };

    // Cache the result
    healthCheckCache = {
      result: healthCheck,
      timestamp: Date.now()
    };

    // Return health check response with appropriate status code
    return NextResponse.json(healthCheck, {
      status: systemStatus === 'healthy' ? 200 : 
             systemStatus === 'degraded' ? 200 : 503,
      headers: {
        'Cache-Control': `private, max-age=${CACHE_TTL / 1000}`,
        'X-Health-Check-Time': `${Date.now() - startTime}ms`
      }
    });

  } catch (error) {
    console.error('[Health Check Error]', error);
    return NextResponse.json({
      status: 'unhealthy',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      services: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

/**
 * Check backend API health
 */
async function checkBackendHealth(apiClient: ApiClient): Promise<number> {
  const start = Date.now();
  await apiClient.get('/health');
  return Date.now() - start;
}

/**
 * Check database health
 */
async function checkDatabaseHealth(apiClient: ApiClient): Promise<number> {
  const start = Date.now();
  await apiClient.get('/health/database');
  return Date.now() - start;
}

/**
 * Check cache service health
 */
async function checkCacheHealth(apiClient: ApiClient): Promise<number> {
  const start = Date.now();
  await apiClient.get('/health/cache');
  return Date.now() - start;
}

/**
 * Check rate limits status
 */
async function checkRateLimits(apiClient: ApiClient): Promise<number> {
  const start = Date.now();
  await apiClient.get('/health/rate-limits');
  return Date.now() - start;
}

/**
 * Get service name by index
 */
function getServiceName(index: number): string {
  const services = ['Backend API', 'Database', 'Cache', 'Rate Limiter'];
  return services[index];
}

/**
 * Determine overall system status based on health score and latency
 */
function determineSystemStatus(
  healthScore: number,
  averageLatency: number
): 'healthy' | 'degraded' | 'unhealthy' {
  if (healthScore >= DEGRADED_THRESHOLD && averageLatency < LATENCY_THRESHOLD) {
    return 'healthy';
  } else if (healthScore >= 0.5) {
    return 'degraded';
  }
  return 'unhealthy';
}