import { AxiosResponse } from 'axios'; // v1.6.x
import { BaseResponse } from './common';
import { Campaign } from './campaigns';
import { User } from './auth';

// HTTP method type
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// API version type
export type ApiVersion = 'v1';

// API environment type
export type ApiEnvironment = 'development' | 'staging' | 'production';

/**
 * API configuration interface
 * @interface ApiConfig
 */
export interface ApiConfig {
  baseUrl: string;
  version: ApiVersion;
  environment: ApiEnvironment;
  timeout: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Rate limiting configuration interface
 * @interface RateLimit
 */
export interface RateLimit {
  requests: number;
  window: number; // Time window in seconds
  retryAfter: number; // Time to wait before retry in seconds
  remaining?: number;
  reset?: number; // Timestamp when limit resets
}

/**
 * API endpoint configuration interface
 * @interface ApiEndpoint
 */
export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  requiresAuth: boolean;
  rateLimit: RateLimit;
  cacheDuration?: number; // Cache duration in seconds
  timeout?: number; // Endpoint-specific timeout
}

/**
 * API response interface extending BaseResponse
 * @interface ApiResponse
 * @extends BaseResponse
 */
export interface ApiResponse<T = any> extends BaseResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: string;
  rateLimit?: RateLimit;
  requestId?: string;
  processingTime?: number;
}

/**
 * API error response interface
 * @interface ApiError
 */
export interface ApiError {
  code: string;
  message: string;
  details: Record<string, any>;
  timestamp: string;
  path?: string;
  requestId?: string;
  suggestedAction?: string;
}

/**
 * API request headers interface
 * @interface ApiHeaders
 */
export interface ApiHeaders {
  'Authorization': string;
  'Content-Type': string;
  'Accept': string;
  'X-API-Key': string;
  'X-Request-ID'?: string;
  'X-Client-Version'?: string;
  'X-Platform'?: string;
}

/**
 * Platform-specific rate limits
 * @interface PlatformRateLimits
 */
export interface PlatformRateLimits {
  linkedin: {
    campaignCreation: RateLimit;
    reporting: RateLimit;
  };
  google: {
    campaignManagement: RateLimit;
    reporting: RateLimit;
  };
  crm: {
    dataSync: RateLimit;
  };
}

/**
 * API response with pagination
 * @interface PaginatedApiResponse
 * @extends ApiResponse
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * API request options
 * @interface ApiRequestOptions
 */
export interface ApiRequestOptions {
  headers?: Partial<ApiHeaders>;
  params?: Record<string, any>;
  timeout?: number;
  signal?: AbortSignal;
  validateStatus?: (status: number) => boolean;
  withCredentials?: boolean;
}

/**
 * API response transformer
 * @interface ApiResponseTransformer
 */
export interface ApiResponseTransformer<T = any, R = any> {
  transform: (response: AxiosResponse<ApiResponse<T>>) => R;
  transformError: (error: ApiError) => Error;
}

/**
 * API retry configuration
 * @interface ApiRetryConfig
 */
export interface ApiRetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition: (error: ApiError) => boolean;
  onRetry?: (retryCount: number, error: ApiError) => void;
}

/**
 * API cache configuration
 * @interface ApiCacheConfig
 */
export interface ApiCacheConfig {
  enabled: boolean;
  duration: number;
  maxSize: number;
  invalidateOnMutation: boolean;
  keyPrefix?: string;
}

/**
 * API batch request configuration
 * @interface ApiBatchRequest
 */
export interface ApiBatchRequest {
  requests: {
    id: string;
    endpoint: ApiEndpoint;
    options?: ApiRequestOptions;
  }[];
  batchSize: number;
  parallel: boolean;
}

/**
 * API health check response
 * @interface ApiHealthCheck
 */
export interface ApiHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    name: string;
    status: 'up' | 'down';
    latency: number;
  }[];
}

/**
 * API metrics
 * @interface ApiMetrics
 */
export interface ApiMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  timestamp: string;
}

/**
 * Type guard for API response
 * @param response - Response to check
 */
export function isApiResponse<T>(response: any): response is ApiResponse<T> {
  return (
    response &&
    typeof response.status === 'number' &&
    typeof response.message === 'string' &&
    'data' in response
  );
}

/**
 * Type guard for API error
 * @param error - Error to check
 */
export function isApiError(error: any): error is ApiError {
  return (
    error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.timestamp === 'string'
  );
}