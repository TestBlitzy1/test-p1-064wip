import axios from 'axios'; // v1.6.x
import { ApiConfig, ApiEndpoint, RateLimit, ApiError } from '../types/api';
import { API_VERSION, API_ENDPOINTS } from './constants';

// Global configuration constants
const API_TIMEOUT = 30000; // 30 seconds
const RETRY_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 60; // 1 minute window for rate limiting

// Rate limit tracking interface
interface RateLimitInfo {
  count: number;
  timestamp: number;
  windowEnd: number;
}

// Rate limit tracking store
const RATE_LIMIT_STORE = new Map<string, RateLimitInfo>();

/**
 * Platform-specific rate limits based on technical specifications
 */
const PLATFORM_RATE_LIMITS: Record<string, RateLimit> = {
  linkedinAds: {
    requests: 100,
    window: 60,
    retryAfter: 60,
  },
  googleAds: {
    requests: 150,
    window: 60,
    retryAfter: 60,
  },
  dataSync: {
    requests: 50,
    window: 60,
    retryAfter: 120,
  }
};

/**
 * Core API configuration
 */
export const apiConfig: ApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  version: API_VERSION,
  environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
  timeout: API_TIMEOUT,
  retryAttempts: RETRY_ATTEMPTS,
  retryDelay: 1000,
};

/**
 * API endpoints configuration with rate limiting and security settings
 */
export const endpoints: Record<string, ApiEndpoint> = {
  auth: {
    path: API_ENDPOINTS.AUTH.LOGIN,
    method: 'POST',
    requiresAuth: false,
    rateLimit: {
      requests: 5,
      window: 300, // 5 minutes
      retryAfter: 300,
    },
  },
  campaigns: {
    path: API_ENDPOINTS.CAMPAIGNS.BASE,
    method: 'GET',
    requiresAuth: true,
    rateLimit: {
      requests: 100,
      window: 60,
      retryAfter: 60,
    },
  },
  analytics: {
    path: API_ENDPOINTS.ANALYTICS.DASHBOARD,
    method: 'GET',
    requiresAuth: true,
    rateLimit: {
      requests: 200,
      window: 60,
      retryAfter: 60,
    },
  },
  targeting: {
    path: API_ENDPOINTS.TARGETING.AUDIENCE,
    method: 'GET',
    requiresAuth: true,
    rateLimit: {
      requests: 150,
      window: 60,
      retryAfter: 60,
    },
  },
  linkedinAds: {
    path: '/api/linkedin',
    method: 'POST',
    requiresAuth: true,
    rateLimit: PLATFORM_RATE_LIMITS.linkedinAds,
  },
  googleAds: {
    path: '/api/google',
    method: 'POST',
    requiresAuth: true,
    rateLimit: PLATFORM_RATE_LIMITS.googleAds,
  },
};

/**
 * Constructs the full API URL with validation and error handling
 * @param path - API endpoint path
 * @param params - URL parameters
 * @returns Complete API URL
 */
export function getApiUrl(path: string, params: Record<string, string> = {}): string {
  if (!path) {
    throw new Error('API path is required');
  }

  let url = `${apiConfig.baseUrl}/api/${apiConfig.version}${path}`;

  // Replace path parameters
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, encodeURIComponent(value));
  });

  return url;
}

/**
 * Retrieves and validates endpoint configuration with rate limit checking
 * @param endpointKey - Endpoint identifier
 * @returns Validated endpoint configuration
 */
export function getEndpointConfig(endpointKey: string): ApiEndpoint {
  const endpoint = endpoints[endpointKey];
  if (!endpoint) {
    throw new Error(`Invalid endpoint: ${endpointKey}`);
  }

  // Apply environment-specific overrides
  if (apiConfig.environment === 'development') {
    endpoint.rateLimit.requests *= 2; // Double rate limits in development
  }

  return endpoint;
}

/**
 * Checks and updates rate limit status for an endpoint
 * @param endpointKey - Endpoint identifier
 * @returns Whether request is within rate limits
 */
export function checkRateLimit(endpointKey: string): boolean {
  const endpoint = getEndpointConfig(endpointKey);
  const now = Date.now();
  const limitInfo = RATE_LIMIT_STORE.get(endpointKey);

  if (!limitInfo || now >= limitInfo.windowEnd) {
    // Initialize or reset rate limit window
    RATE_LIMIT_STORE.set(endpointKey, {
      count: 1,
      timestamp: now,
      windowEnd: now + (endpoint.rateLimit.window * 1000),
    });
    return true;
  }

  if (limitInfo.count >= endpoint.rateLimit.requests) {
    return false;
  }

  // Update request count
  limitInfo.count += 1;
  RATE_LIMIT_STORE.set(endpointKey, limitInfo);
  return true;
}

// Configure axios defaults
axios.defaults.baseURL = apiConfig.baseUrl;
axios.defaults.timeout = apiConfig.timeout;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['X-API-Version'] = apiConfig.version;