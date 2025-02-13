import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // v1.6.x
import axiosRetry from 'axios-retry'; // v3.9.x
import { getSession } from 'next-auth/react'; // v4.24.0
import {
  ApiConfig,
  ApiResponse,
  ApiError,
  ApiHeaders,
  ApiRequestOptions,
  ApiRetryConfig,
  ApiCacheConfig,
  RateLimit,
  isApiError
} from '../types/api';

// Constants for configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay
const RATE_LIMIT_THRESHOLD = 0.8; // 80% of rate limit

/**
 * Enhanced HTTP client for secure API communication with comprehensive error handling
 * and performance optimization
 */
export class ApiClient {
  private client: AxiosInstance;
  private config: ApiConfig;
  private rateLimits: Map<string, RateLimit>;
  private cache: Map<string, { data: any; timestamp: number }>;

  constructor(config: ApiConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      ...config
    };
    this.rateLimits = new Map();
    this.cache = new Map();
    this.client = this.createAxiosInstance();
    this.setupInterceptors();
    this.setupRetryLogic();
  }

  /**
   * Creates a configured Axios instance with security headers
   */
  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: `${this.config.baseUrl}/api/${this.config.version}`,
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION,
        'X-Platform': 'web'
      },
      withCredentials: true // Enable cookie handling
    });
    return instance;
  }

  /**
   * Configures request and response interceptors for authentication and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add request ID for tracing
        config.headers['X-Request-ID'] = crypto.randomUUID();
        
        // Check rate limits before request
        const endpoint = config.url || '';
        if (this.isRateLimited(endpoint)) {
          throw new Error('Rate limit exceeded');
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit info
        const rateLimitInfo = {
          requests: parseInt(response.headers['x-ratelimit-limit'] || '0'),
          remaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
          reset: parseInt(response.headers['x-ratelimit-reset'] || '0')
        };
        this.updateRateLimits(response.config.url || '', rateLimitInfo);

        return response;
      },
      (error) => Promise.reject(this.handleApiError(error))
    );
  }

  /**
   * Configures retry logic with exponential backoff
   */
  private setupRetryLogic(): void {
    axiosRetry(this.client, {
      retries: MAX_RETRIES,
      retryDelay: (retryCount) => {
        return retryCount * RETRY_DELAY; // Exponential backoff
      },
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 || // Rate limit
          (error.response?.status || 0) >= 500; // Server errors
      }
    });
  }

  /**
   * Retrieves and validates authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    const session = await getSession();
    if (session?.accessToken) {
      return session.accessToken;
    }
    return null;
  }

  /**
   * Checks if an endpoint is rate limited
   */
  private isRateLimited(endpoint: string): boolean {
    const limits = this.rateLimits.get(endpoint);
    if (!limits) return false;

    return limits.remaining !== undefined &&
           limits.remaining / limits.requests < RATE_LIMIT_THRESHOLD;
  }

  /**
   * Updates rate limit information for an endpoint
   */
  private updateRateLimits(endpoint: string, limits: Partial<RateLimit>): void {
    const current = this.rateLimits.get(endpoint) || {};
    this.rateLimits.set(endpoint, { ...current, ...limits });
  }

  /**
   * Enhanced error handler with detailed error information
   */
  private handleApiError(error: AxiosError): ApiError {
    if (isApiError(error.response?.data)) {
      return error.response.data;
    }

    const apiError: ApiError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      }
    };

    // Log error for monitoring
    console.error('[API Error]', apiError);

    return apiError;
  }

  /**
   * Makes a GET request with caching support
   */
  public async get<T>(
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const cacheKey = `${url}${JSON.stringify(options.params || {})}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data;
    }

    const response = await this.client.get<ApiResponse<T>>(url, {
      ...options,
      params: options.params
    });

    this.cache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  }

  /**
   * Makes a POST request
   */
  public async post<T>(
    url: string,
    data: any,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, options);
    return response.data;
  }

  /**
   * Makes a PUT request
   */
  public async put<T>(
    url: string,
    data: any,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, options);
    return response.data;
  }

  /**
   * Makes a DELETE request
   */
  public async delete<T>(
    url: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, options);
    return response.data;
  }
}

/**
 * Creates and configures an API client instance
 */
export function createApiClient(config: ApiConfig): ApiClient {
  return new ApiClient(config);
}

export { handleApiError } from './api-error-handler';