import { jest, describe, beforeAll, afterAll, beforeEach, test, expect } from '@jest/globals'; // v29.0.0
import { testApiClient } from '../utils/test-client';
import { MockLinkedInAdsAdapter } from '../../mocks/services/linkedin-ads.mock';
import type { ApiResponse } from '../../../web/src/types/api';
import type { Campaign, CampaignStatus, TargetingSettings } from '../../../web/src/types/campaigns';

// Test campaign data based on technical specifications
const TEST_CAMPAIGN_DATA = {
  name: 'Test B2B Campaign',
  objective: 'BRAND_AWARENESS',
  budget: {
    amount: 5000,
    currency: 'USD',
    dailyBudget: 500,
    lifetimeBudget: 5000
  },
  targeting: {
    industries: ['Technology', 'SaaS'],
    companySize: ['50-200', '201-500'],
    jobTitles: ['CTO', 'VP Engineering'],
    locations: ['United States', 'Canada'],
    skills: ['Digital Marketing', 'B2B Marketing']
  },
  schedule: {
    startDate: '2024-01-01',
    endDate: '2024-03-31'
  }
};

describe('LinkedIn Ads Integration', () => {
  let mockAdapter: MockLinkedInAdsAdapter;
  let campaignId: string;

  beforeAll(async () => {
    mockAdapter = new MockLinkedInAdsAdapter();
    // Configure test API client with rate limit settings
    testApiClient.setTestAuthToken('test-auth-token');
  });

  afterAll(async () => {
    mockAdapter.reset();
    testApiClient.clearTestAuthToken();
  });

  beforeEach(async () => {
    // Reset rate limiters and test state before each test
    mockAdapter.reset();
    campaignId = '';
  });

  test('should create a LinkedIn campaign successfully', async () => {
    // Test campaign creation with rate limit compliance
    const response = await testApiClient.post<ApiResponse<{ id: string }>>('/api/campaigns/linkedin', {
      ...TEST_CAMPAIGN_DATA,
      platformSettings: {
        linkedin: {
          campaignType: 'SPONSORED_CONTENT',
          objectiveType: 'AWARENESS',
          bidStrategy: 'AUTOMATED',
          format: 'SINGLE_IMAGE'
        }
      }
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    
    campaignId = response.data.id;

    // Validate campaign structure
    const campaignResponse = await testApiClient.get<ApiResponse<Campaign>>(`/api/campaigns/linkedin/${campaignId}`);
    expect(campaignResponse.status).toBe(200);
    expect(campaignResponse.data.status).toBe('ACTIVE' as CampaignStatus);
    expect(campaignResponse.data.targetingSettings).toMatchObject(TEST_CAMPAIGN_DATA.targeting as TargetingSettings);
  });

  test('should handle rate limits correctly', async () => {
    // Simulate hitting rate limit (100 requests/minute for campaign creation)
    const requests = Array.from({ length: 105 }, () => 
      testApiClient.post('/api/campaigns/linkedin', TEST_CAMPAIGN_DATA)
    );

    const results = await Promise.allSettled(requests);
    const rateLimitedRequests = results.filter(r => 
      r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.status === 429
    );

    expect(rateLimitedRequests.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('status', 'fulfilled');
  });

  test('should update an existing LinkedIn campaign', async () => {
    // Create initial campaign
    const createResponse = await testApiClient.post<ApiResponse<{ id: string }>>('/api/campaigns/linkedin', TEST_CAMPAIGN_DATA);
    campaignId = createResponse.data.id;

    // Update campaign
    const updateResponse = await testApiClient.put<ApiResponse<Campaign>>(`/api/campaigns/linkedin/${campaignId}`, {
      status: 'PAUSED',
      budget: {
        ...TEST_CAMPAIGN_DATA.budget,
        dailyBudget: 600
      }
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.budget.dailyBudget).toBe(600);
    expect(updateResponse.data.status).toBe('PAUSED');
  });

  test('should retrieve campaign performance metrics', async () => {
    // Create campaign for performance testing
    const createResponse = await testApiClient.post<ApiResponse<{ id: string }>>('/api/campaigns/linkedin', TEST_CAMPAIGN_DATA);
    campaignId = createResponse.data.id;

    // Get performance metrics with rate limit check (500 requests/minute for reporting)
    const performanceResponse = await testApiClient.get<ApiResponse<any>>(`/api/campaigns/linkedin/${campaignId}/performance`, {
      params: {
        startDate: TEST_CAMPAIGN_DATA.schedule.startDate,
        endDate: TEST_CAMPAIGN_DATA.schedule.endDate,
        metrics: ['impressions', 'clicks', 'conversions', 'spend']
      }
    });

    expect(performanceResponse.status).toBe(200);
    expect(performanceResponse.data).toHaveProperty('metrics');
    expect(performanceResponse.data.metrics).toHaveProperty('impressions');
    expect(performanceResponse.data.metrics).toHaveProperty('clicks');
    expect(performanceResponse.headers).toHaveProperty('x-ratelimit-remaining');
  });

  test('should validate campaign structure before creation', async () => {
    // Test with invalid campaign data
    const invalidCampaign = {
      ...TEST_CAMPAIGN_DATA,
      targeting: {
        industries: [] // Invalid: empty industries
      }
    };

    const response = await testApiClient.post<ApiResponse<any>>('/api/campaigns/linkedin', invalidCampaign);
    
    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
    expect(response.data.error).toContain('industries');
  });

  test('should handle campaign creation retries on failure', async () => {
    // Simulate temporary API failure
    mockAdapter.simulateRateLimit(true);
    
    const response = await testApiClient.post<ApiResponse<{ id: string }>>('/api/campaigns/linkedin', TEST_CAMPAIGN_DATA, {
      retry: {
        attempts: 3,
        delay: 1000
      }
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');
  });
});