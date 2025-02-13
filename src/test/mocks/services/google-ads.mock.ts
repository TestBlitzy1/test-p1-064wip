import { jest } from 'jest';
import type { Campaign } from '../../web/src/types/campaigns';
import { mockGoogleCampaign } from '../data/campaign.mock';

// API configuration constants
const API_VERSION = 'v14';
const RATE_LIMIT_REQUESTS = 150;
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
const NETWORK_LATENCY_MS = 200;

/**
 * Mock implementation of Google Ads service for testing campaign management features.
 * Simulates API behavior, rate limiting, and performance metrics generation.
 */
export class MockGoogleAdsService {
  private _campaigns: Map<string, Campaign>;
  private _requestCount: number;
  private _lastResetTime: number;
  private _isInitialized: boolean;
  private _performanceMetrics: Map<string, object>;

  constructor() {
    this._campaigns = new Map();
    this._performanceMetrics = new Map();
    this._requestCount = 0;
    this._lastResetTime = Date.now();
    this._isInitialized = true;

    // Initialize with sample campaign data
    const sampleCampaign = { ...mockGoogleCampaign };
    this._campaigns.set(sampleCampaign.id, sampleCampaign);
    this._initializePerformanceMetrics(sampleCampaign.id);
  }

  /**
   * Creates a new campaign in the mock Google Ads system
   * @param campaignData Campaign configuration data
   * @returns Promise<string> Campaign ID
   * @throws Error if rate limit exceeded or validation fails
   */
  async createCampaign(campaignData: Campaign): Promise<string> {
    if (!this.checkRateLimit()) {
      throw new Error(`Rate limit exceeded: ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW}ms`);
    }

    // Validate campaign data
    this._validateCampaignData(campaignData);

    // Generate unique campaign ID
    const campaignId = `gads-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store campaign with platform-specific modifications
    const googleCampaign = {
      ...campaignData,
      id: campaignId,
      platform: 'GOOGLE',
      processingStatus: 'PROCESSING'
    };

    this._campaigns.set(campaignId, googleCampaign);
    this._initializePerformanceMetrics(campaignId);

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, NETWORK_LATENCY_MS));

    // Update campaign status to complete
    googleCampaign.processingStatus = 'COMPLETED';
    this._campaigns.set(campaignId, googleCampaign);

    return campaignId;
  }

  /**
   * Updates an existing campaign with new data
   * @param campaignId Campaign identifier
   * @param updates Partial campaign updates
   * @returns Promise<boolean> Update success status
   * @throws Error if campaign not found or rate limit exceeded
   */
  async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<boolean> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const existingCampaign = this._campaigns.get(campaignId);
    if (!existingCampaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Validate updates
    this._validateCampaignUpdates(updates);

    // Apply updates
    const updatedCampaign = {
      ...existingCampaign,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this._campaigns.set(campaignId, updatedCampaign);
    this._updatePerformanceMetrics(campaignId);

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, NETWORK_LATENCY_MS));

    return true;
  }

  /**
   * Retrieves campaign performance metrics
   * @param campaignId Campaign identifier
   * @returns Promise<object> Campaign performance data
   * @throws Error if campaign not found or rate limit exceeded
   */
  async getCampaignPerformance(campaignId: string): Promise<object> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    if (!this._campaigns.has(campaignId)) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    const metrics = this._performanceMetrics.get(campaignId) || this._generatePerformanceMetrics();

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, NETWORK_LATENCY_MS));

    return metrics;
  }

  /**
   * Implements rolling window rate limit checking
   * @returns boolean Rate limit compliance status
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowElapsed = now - this._lastResetTime;

    if (windowElapsed >= RATE_LIMIT_WINDOW) {
      this._requestCount = 0;
      this._lastResetTime = now;
    }

    this._requestCount++;
    return this._requestCount <= RATE_LIMIT_REQUESTS;
  }

  /**
   * Validates campaign data structure and requirements
   * @param campaignData Campaign data to validate
   * @throws Error if validation fails
   */
  private _validateCampaignData(campaignData: Campaign): void {
    if (!campaignData.name || campaignData.name.length < 3) {
      throw new Error('Invalid campaign name: minimum 3 characters required');
    }

    if (!campaignData.budget || campaignData.budget <= 0) {
      throw new Error('Invalid campaign budget: must be greater than 0');
    }

    if (!campaignData.targetingSettings) {
      throw new Error('Missing targeting settings');
    }
  }

  /**
   * Validates campaign update data
   * @param updates Partial campaign updates
   * @throws Error if validation fails
   */
  private _validateCampaignUpdates(updates: Partial<Campaign>): void {
    if (updates.budget && updates.budget <= 0) {
      throw new Error('Invalid budget update: must be greater than 0');
    }

    if (updates.name && updates.name.length < 3) {
      throw new Error('Invalid name update: minimum 3 characters required');
    }
  }

  /**
   * Initializes performance metrics for a new campaign
   * @param campaignId Campaign identifier
   */
  private _initializePerformanceMetrics(campaignId: string): void {
    this._performanceMetrics.set(campaignId, this._generatePerformanceMetrics());
  }

  /**
   * Generates mock performance metrics
   * @returns object Performance metrics
   */
  private _generatePerformanceMetrics(): object {
    return {
      impressions: Math.floor(Math.random() * 100000),
      clicks: Math.floor(Math.random() * 5000),
      conversions: Math.floor(Math.random() * 500),
      spend: Math.random() * 10000,
      ctr: Math.random() * 0.1,
      cpc: Math.random() * 5,
      conversionRate: Math.random() * 0.05,
      roas: 1 + Math.random() * 4,
      qualityScore: 5 + Math.floor(Math.random() * 5),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Updates performance metrics for an existing campaign
   * @param campaignId Campaign identifier
   */
  private _updatePerformanceMetrics(campaignId: string): void {
    const currentMetrics = this._performanceMetrics.get(campaignId) as any;
    if (!currentMetrics) return;

    const updatedMetrics = {
      ...currentMetrics,
      impressions: currentMetrics.impressions + Math.floor(Math.random() * 1000),
      clicks: currentMetrics.clicks + Math.floor(Math.random() * 50),
      conversions: currentMetrics.conversions + Math.floor(Math.random() * 5),
      spend: currentMetrics.spend + Math.random() * 100,
      timestamp: new Date().toISOString()
    };

    this._performanceMetrics.set(campaignId, updatedMetrics);
  }
}