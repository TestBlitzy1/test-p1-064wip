import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'; // v1.6.0
import { beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { getTestServerUrl } from './test-server';

// Constants for test client configuration
const TEST_REQUEST_TIMEOUT = 5000;
const TEST_MAX_RETRIES = 1;
const TEST_RETRY_DELAY = 1000;

// Custom error types for test scenarios
interface ApiError extends Error {
  statusCode?: number;
  response?: any;
}

// Response type for API calls
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * Test API client for end-to-end testing
 * Provides configured axios instance with test-specific interceptors and error handling
 */
class TestApiClient {
  private axiosInstance: AxiosInstance;
  private retryCount: number;
  private authToken: string | null;
  private isRetrying: boolean;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: getTestServerUrl(),
      timeout: TEST_REQUEST_TIMEOUT,
      validateStatus: (status) => status < 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Client': 'true'
      }
    });

    this.retryCount = 0;
    this.authToken = null;
    this.isRetrying = false;

    this.setupInterceptors();
  }

  /**
   * Configure request and response interceptors for test scenarios
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        config.headers['X-Request-ID'] = `test-${Date.now()}`;
        return config;
      },
      (error) => Promise.reject(this.transformError(error))
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (this.shouldRetry(error) && this.retryCount < TEST_MAX_RETRIES) {
          return this.retryRequest(error.config);
        }
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * Transform API errors into test-friendly format
   */
  private transformError(error: AxiosError): ApiError {
    const apiError: ApiError = new Error(error.message);
    apiError.name = 'TestApiError';
    apiError.statusCode = error.response?.status;
    apiError.response = error.response?.data;
    return apiError;
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: AxiosError): boolean {
    return !this.isRetrying && 
           error.response?.status !== 401 && 
           error.response?.status !== 403 &&
           error.response?.status !== 404;
  }

  /**
   * Retry failed request with exponential backoff
   */
  private async retryRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    this.isRetrying = true;
    this.retryCount++;

    await new Promise(resolve => setTimeout(resolve, TEST_RETRY_DELAY * this.retryCount));

    this.isRetrying = false;
    return this.axiosInstance(config);
  }

  /**
   * Perform GET request with test configuration
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>
      };
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  /**
   * Perform POST request with test configuration
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(url, data, config);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>
      };
    } catch (error) {
      throw this.transformError(error as AxiosError);
    }
  }

  /**
   * Set authentication token for test requests
   */
  setTestAuthToken(token: string): void {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid test auth token');
    }
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearTestAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Reset retry count and status
   */
  resetRetryStatus(): void {
    this.retryCount = 0;
    this.isRetrying = false;
  }
}

// Create singleton instance
const testApiClient = new TestApiClient();

// Reset client state before each test
beforeEach(() => {
  testApiClient.resetRetryStatus();
  testApiClient.clearTestAuthToken();
});

// Export singleton instance
export { testApiClient };

// Export types for test usage
export type { ApiResponse, ApiError };