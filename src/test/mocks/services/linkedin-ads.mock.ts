import { jest } from 'jest';
import { TestState } from '../../types/test';
import { ApiResponse } from '../../../web/src/types/api';

// API version and base URL for mocking
const MOCK_API_VERSION = 'v2';
const MOCK_BASE_URL = 'https://mock.linkedin.com/v2/adAccounts';

// Rate limits as per technical specification A.1.1
const MOCK_RATE_LIMITS = {
  campaign: { requests: 100, period: 60 }, // 100 requests per minute for campaigns
  analytics: { requests: 500, period: 60 }  // 500 requests per minute for reporting
};

/**
 * Mock adapter for simulating LinkedIn Ads API interactions in tests
 * Implements rate limiting and validation rules as per technical specification
 */
export class MockLinkedInAdsAdapter {
  private _mockCampaigns: Map<string, any>;
  private _mockPerformanceData: Map<string, any>;
  private _rateLimiter: {
    campaign: { count: number; lastReset: number };
    analytics: { count: number; lastReset: number };
  };

  constructor() {
    // Initialize storage for mock data
    this._mockCampaigns = new Map();
    this._mockPerformanceData = new Map();
    
    // Initialize rate limiters
    this._rateLimiter = {
      campaign: { count: 0, lastReset: Date.now() },
      analytics: { count: 0, lastReset: Date.now() }
    };
  }

  /**
   * Checks if the rate limit has been exceeded for a specific operation type
   * @param type - Operation type (campaign or analytics)
   * @returns boolean indicating if rate limit is exceeded
   */
  private _checkRateLimit(type: 'campaign' | 'analytics'): boolean {
    const now = Date.now();
    const limit = MOCK_RATE_LIMITS[type];
    const limiter = this._rateLimiter[type];

    // Reset counter if period has elapsed
    if (now - limiter.lastReset >= limit.period * 1000) {
      limiter.count = 0;
      limiter.lastReset = now;
    }

    // Check if limit exceeded
    if (limiter.count >= limit.requests) {
      return false;
    }

    limiter.count++;
    return true;
  }

  /**
   * Validates campaign data structure
   * @param campaignData - Campaign data to validate
   * @throws Error if validation fails
   */
  private _validateCampaignData(campaignData: any): void {
    if (!campaignData.name || typeof campaignData.name !== 'string') {
      throw new Error('Campaign name is required and must be a string');
    }

    if (!campaignData.targetingSettings) {
      throw new Error('Targeting settings are required');
    }

    if (!campaignData.platformSettings?.linkedin) {
      throw new Error('LinkedIn platform settings are required');
    }
  }

  /**
   * Creates a mock campaign on LinkedIn Ads
   * @param campaignData - Campaign configuration data
   * @returns Promise resolving to campaign creation response
   */
  async createCampaign(campaignData: any): Promise<ApiResponse<{ id: string }>> {
    // Check rate limit
    if (!this._checkRateLimit('campaign')) {
      return {
        data: null,
        status: 429,
        message: 'Rate limit exceeded',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // Validate campaign data
      this._validateCampaignData(campaignData);

      // Generate mock campaign ID
      const campaignId = `mock-campaign-${Date.now()}`;

      // Store campaign data
      this._mockCampaigns.set(campaignId, {
        ...campaignData,
        id: campaignId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });

      return {
        data: { id: campaignId },
        status: 201,
        message: 'Campaign created successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        data: null,
        status: 400,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Updates a mock campaign
   * @param campaignId - ID of campaign to update
   * @param updates - Update data
   * @returns Promise resolving to update operation response
   */
  async updateCampaign(campaignId: string, updates: any): Promise<ApiResponse<boolean>> {
    if (!this._checkRateLimit('campaign')) {
      return {
        data: false,
        status: 429,
        message: 'Rate limit exceeded',
        timestamp: new Date().toISOString()
      };
    }

    const campaign = this._mockCampaigns.get(campaignId);
    if (!campaign) {
      return {
        data: false,
        status: 404,
        message: 'Campaign not found',
        timestamp: new Date().toISOString()
      };
    }

    // Update campaign data
    this._mockCampaigns.set(campaignId, {
      ...campaign,
      ...updates,
      updatedAt: new Date().toISOString()
    });

    return {
      data: true,
      status: 200,
      message: 'Campaign updated successfully',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Retrieves mock campaign performance metrics
   * @param campaignId - Campaign ID
   * @param metricsConfig - Metrics configuration
   * @returns Promise resolving to performance metrics response
   */
  async getCampaignPerformance(campaignId: string, metricsConfig: any): Promise<ApiResponse<object>> {
    if (!this._checkRateLimit('analytics')) {
      return {
        data: null,
        status: 429,
        message: 'Rate limit exceeded',
        timestamp: new Date().toISOString()
      };
    }

    const campaign = this._mockCampaigns.get(campaignId);
    if (!campaign) {
      return {
        data: null,
        status: 404,
        message: 'Campaign not found',
        timestamp: new Date().toISOString()
      };
    }

    // Generate mock performance data
    const performanceData = {
      impressions: Math.floor(Math.random() * 100000),
      clicks: Math.floor(Math.random() * 5000),
      ctr: Math.random() * 5,
      conversions: Math.floor(Math.random() * 100),
      spend: Math.random() * 10000,
      costPerConversion: Math.random() * 100,
      timestamp: new Date().toISOString()
    };

    this._mockPerformanceData.set(campaignId, performanceData);

    return {
      data: performanceData,
      status: 200,
      message: 'Performance data retrieved successfully',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Resets all mock data and rate limiters
   * Useful for cleaning up between tests
   */
  reset(): void {
    this._mockCampaigns.clear();
    this._mockPerformanceData.clear();
    this._rateLimiter = {
      campaign: { count: 0, lastReset: Date.now() },
      analytics: { count: 0, lastReset: Date.now() }
    };
  }
}