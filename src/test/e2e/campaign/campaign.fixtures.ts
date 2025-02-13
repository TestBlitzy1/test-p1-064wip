import { faker } from '@faker-js/faker'; // v8.0.0
import { beforeAll, afterAll, jest } from '@jest/globals'; // v29.0.0
import { Campaign, PlatformType, ProcessingStatus, ValidationLevel } from '../../../web/src/types/campaigns';
import { testApiClient } from '../utils/test-client';
import { generateMockCampaign } from '../../mocks/data/campaign.mock';
import { withTransaction } from '../utils/test-database';

// Constants for test configuration
const TEST_CAMPAIGN_ENDPOINT = '/api/v1/campaigns';
const GENERATION_TIMEOUT = 30000; // 30 seconds max processing time
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Creates a test campaign with performance tracking and validation
 * @param platform - Target advertising platform
 * @param adFormats - Array of supported ad formats
 * @returns Promise<Campaign> - Created campaign with metrics
 */
export async function createTestCampaign(
  platform: PlatformType,
  adFormats: string[]
): Promise<Campaign> {
  const startTime = Date.now();
  let campaign: Campaign;

  try {
    // Generate mock campaign data with AI attributes
    const mockCampaign = generateMockCampaign(platform, {
      status: 'QUEUED',
      includeAIOptimizations: true,
      adGroupCount: faker.number.int({ min: 1, max: 3 })
    });

    // Create campaign via API
    const response = await testApiClient.post<Campaign>(
      TEST_CAMPAIGN_ENDPOINT,
      mockCampaign
    );

    campaign = response.data;

    // Wait for AI processing completion
    campaign = await waitForProcessingCompletion(campaign.id);

    // Validate processing time requirement
    const processingTime = Date.now() - startTime;
    if (processingTime > GENERATION_TIMEOUT) {
      throw new Error(`Campaign generation exceeded timeout: ${processingTime}ms`);
    }

    // Verify ad format support
    validateAdFormats(campaign, adFormats);

    return campaign;

  } catch (error) {
    console.error('Failed to create test campaign:', error);
    throw error;
  }
}

/**
 * Sets up multiple test campaigns with isolation and parallel execution
 * @param count - Number of campaigns to create
 * @param platform - Target advertising platform
 * @param config - Additional test configuration
 * @returns Promise<Campaign[]> - Array of created campaigns
 */
export async function setupTestCampaignFixtures(
  count: number,
  platform: PlatformType,
  config: {
    validationLevel?: ValidationLevel;
    adFormats?: string[];
    budget?: number;
  } = {}
): Promise<Campaign[]> {
  return withTransaction(async (client) => {
    const campaigns: Campaign[] = [];
    const creationPromises = Array.from({ length: count }, () =>
      createTestCampaign(
        platform,
        config.adFormats || getDefaultAdFormats(platform)
      )
    );

    try {
      campaigns.push(...await Promise.all(creationPromises));

      // Register cleanup hook
      afterAll(async () => {
        await Promise.all(
          campaigns.map(campaign => cleanupTestCampaign(campaign.id))
        );
      });

      return campaigns;

    } catch (error) {
      console.error('Failed to setup test campaign fixtures:', error);
      throw error;
    }
  });
}

/**
 * Comprehensive cleanup of test campaign and related resources
 * @param campaignId - ID of campaign to cleanup
 */
export async function cleanupTestCampaign(campaignId: string): Promise<void> {
  try {
    await testApiClient.delete(`${TEST_CAMPAIGN_ENDPOINT}/${campaignId}`);
  } catch (error) {
    console.error(`Failed to cleanup test campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Waits for campaign AI processing to complete
 * @param campaignId - Campaign ID to monitor
 * @returns Promise<Campaign> - Campaign with final processing status
 */
async function waitForProcessingCompletion(campaignId: string): Promise<Campaign> {
  let attempts = 0;
  
  while (attempts < MAX_RETRY_ATTEMPTS) {
    const response = await testApiClient.get<Campaign>(
      `${TEST_CAMPAIGN_ENDPOINT}/${campaignId}`
    );
    
    const campaign = response.data;
    
    if (campaign.processingStatus === 'COMPLETED') {
      return campaign;
    }
    
    if (campaign.processingStatus === 'FAILED') {
      throw new Error(`Campaign processing failed: ${campaignId}`);
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  
  throw new Error(`Campaign processing timeout: ${campaignId}`);
}

/**
 * Validates campaign ad format support
 * @param campaign - Campaign to validate
 * @param expectedFormats - Array of expected ad formats
 */
function validateAdFormats(campaign: Campaign, expectedFormats: string[]): void {
  const supportedFormats = campaign.platformSettings.linkedin?.format || 
                          campaign.platformSettings.google?.campaignType;
                          
  if (!supportedFormats) {
    throw new Error('Campaign missing ad format configuration');
  }

  if (!expectedFormats.includes(String(supportedFormats))) {
    throw new Error(
      `Campaign does not support required format(s): ${expectedFormats.join(', ')}`
    );
  }
}

/**
 * Returns default ad formats for platform
 * @param platform - Advertising platform
 * @returns string[] - Array of default ad formats
 */
function getDefaultAdFormats(platform: PlatformType): string[] {
  switch (platform) {
    case 'LINKEDIN':
      return ['SINGLE_IMAGE', 'CAROUSEL', 'VIDEO', 'MESSAGE'];
    case 'GOOGLE':
      return ['SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING'];
    case 'BOTH':
      return ['SINGLE_IMAGE', 'SEARCH'];
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}